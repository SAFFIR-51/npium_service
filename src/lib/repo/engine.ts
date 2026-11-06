import { describeChanges } from "@/lib/measures";
import { seed } from "./seed";
import { todayLocal } from "../date";
import { captureBilling } from "@/lib/billing";
import { allProviders, approvedVersion, latestReport, normalizeWorkflow, prescriptionForDate, providerEligibility, prescriptionSignature, reportReviewSignature, publishReport, reportSnapshot, transitionWorkflow } from "@/lib/workflow";
import { paymentFor, programById, programFor, programPlace } from "@/lib/center";
import type { CareRecord, CareRepository, CareState, Patient } from "./types";
const nowIso = () => new Date().toISOString();
const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
export function createRepository(read: () => CareState, write: (fn: (s: CareState) => CareState) => void, subscribe: CareRepository["subscribe"] = () => () => {}, serverSnapshot = read): CareRepository {
const patchPatient = (s: CareState, id: string, patch: Partial<Patient>): CareState => ({
  ...s,
  patients: s.patients.map(p => (p.id === id ? { ...p, ...patch } : p)),
});

function workflow(command: Parameters<typeof transitionWorkflow>[1]) {
  const result = transitionWorkflow(read(), command, nowIso(), newId);
  if (result.state !== read()) write(() => result.state);
  return result.result;
}

return { getSnapshot: read, getServerSnapshot: serverSnapshot, subscribe,
  addPatient: patient => write(s => ({ ...s, patients: [patient, ...s.patients] })),
  changePatient: (id, patch) => write(s => patchPatient(s, id, patch)),

  proposeAssignment(patientId, provider, reason = "최초 매칭", by = "NPIUM 운영팀") {
    let applied = false;
    write(s => {
      const patient = s.patients.find(p => p.id === patientId);
      if (!patient || patient.status === "종료" || !reason.trim() || !allProviders(s).some(e => e.id === provider.id) || providerEligibility(s, provider.id, todayLocal()) !== "배정 가능") return s;
      const previous = s.assignments.find(a => a.patientId === patientId);
      if (previous?.status === "제안" || previous?.status === "수락" && previous.proposalId) return s;
      const id = newId("as");
      applied = true;
      return {
        ...patchPatient(s, patientId, { requestedProviderId: provider.id, requestedProviderName: provider.name }),
        assignments: [
          { id, proposalId: id, patientId, providerId: provider.id, providerName: provider.name, status: "제안", createdAt: nowIso(), adjustmentReason: reason.trim(), by },
          ...s.assignments,
        ],
      };
    });
    return applied;
  },

  acceptAssignment(patientId, provider) {
    write(s => {
      const patient = s.patients.find(p => p.id === patientId);
      const proposal = s.assignments.find(a => a.patientId === patientId);
      if (!patient || patient.status === "종료" || proposal?.status !== "제안" || proposal.providerId !== provider.id) return s;
      const at = nowIso();
      return {
        ...s,
        assignments: [
          { ...proposal, id: newId("as"), proposalId: proposal.proposalId ?? proposal.id, status: "수락", createdAt: at, respondedAt: at, by: provider.name },
          ...s.assignments,
        ],
      };
    });
  },

  declineAssignment(patientId, provider, reason) {
    write(s => {
      const at = nowIso();
      const patient = s.patients.find(p => p.id === patientId);
      // 지정·제안받은 제공자가 거절하면 운영자 재배정 대상으로 돌립니다.
      const proposal = s.assignments.find(a => a.patientId === patientId);
      if (!patient || patient.status === "종료" || proposal?.status !== "제안" || proposal.providerId !== provider.id || !reason.trim()) return s;
      const cleared = patient?.requestedProviderId === provider.id
        ? patchPatient(s, patientId, { requestedProviderId: undefined, requestedProviderName: undefined })
        : s;
      return {
        ...cleared,
        assignments: [
          { ...proposal, id: newId("as"), proposalId: proposal.proposalId ?? proposal.id, status: "거절", createdAt: at, respondedAt: at, reason: reason.trim(), by: provider.name },
          ...s.assignments,
        ],
      };
    });
  },

  finalizeAssignment(patientId, expectedAssignmentId, by) {
    let applied = false;
    write(s => {
      const p = s.patients.find(p => p.id === patientId);
      const a = s.assignments.find(a => a.patientId === patientId);
      if (!p || p.status === "종료" || !a || a.id !== expectedAssignmentId || a.status !== "수락" || !by.trim()) return s;
      if (providerEligibility(s, a.providerId, todayLocal()) !== "배정 가능") return s;
      if (s.patients.some(other => other.id !== p.id && other.status !== "종료" && other.providerId === a.providerId && other.nextDate === p.nextDate && other.nextTime === p.nextTime)) return s;
      const at = nowIso();
      applied = true;
      return { ...patchPatient(s, patientId, { providerId: a.providerId, provider: a.providerName, requestedProviderId: undefined, requestedProviderName: undefined, status: p.status === "배정 대기" ? "승인 대기" : p.status }), assignments: [{ ...a, id: newId("as"), status: "확정", by, createdAt: at, respondedAt: at }, ...s.assignments] };
    });
    return applied;
  },

  cancelAssignment(patientId, expectedAssignmentId, by, reason) {
    let applied = false;
    write(s => {
      const p = s.patients.find(p => p.id === patientId);
      const a = s.assignments.find(a => a.patientId === patientId);
      if (!p || p.status === "종료" || !a || a.id !== expectedAssignmentId || !["제안", "수락"].includes(a.status) || !reason.trim()) return s;
      applied = true;
      const at = nowIso();
      return { ...patchPatient(s, patientId, { requestedProviderId: undefined, requestedProviderName: undefined }), assignments: [{ ...a, id: newId("as"), status: "취소", by, reason: reason.trim(), createdAt: at, respondedAt: at }, ...s.assignments] };
    });
    return applied;
  },

  approvePlan(patientId, by, precautions, prescription) {
    write(s => {
      const patient = s.patients.find(p => p.id === patientId);
      if (!patient?.providerId) return s; // 담당 치료사 없이 확인하지 않습니다.
      // 방문 전 평가 없이는 계획을 확인하지 않습니다.
      if (patient.status === "승인 대기" && !s.assessments.some(a => a.patientId === patientId && a.period === "초기 평가")) return s;
      const versioned = prescription ? approvedVersion(s, patient, prescription, precautions, prescription.startDate, by, nowIso(), newId("rx")) : s;
      return patchPatient(versioned, patientId, {
        status: patient.status === "승인 대기" ? "진행 중" : patient.status,
        precautions,
        ...(prescription ? { prescription, doctor: prescription.doctor } : {}),
        approval: { status: "승인", by, at: nowIso() },
      });
    });
  },

  extendPrescription(patientId, days, by) {
    write(s => {
      const p = s.patients.find(x => x.id === patientId);
      const rx = p?.prescription;
      if (!p || !rx) return s;
      const used = rx.extendedDays ?? 0;
      const add = Number.isInteger(days) && days > 0 ? days : 0;
      if (!add) return s;
      const d = new Date(`${rx.endDate}T00:00:00`); d.setDate(d.getDate() + add);
      const endDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return patchPatient(s, patientId, { prescription: { ...rx, endDate, extendedDays: used + add, note: [rx.note, `${by} 연장 ${add}일`].filter(Boolean).join(" · ") } });
    });
  },

  reviewAdverse(recordId, by, note) {
    write(s => ({ ...s, records: s.records.map(r => r.id === recordId && r.adverse?.occurred ? { ...r, adverse: { ...r.adverse, reviewedBy: by, reviewedAt: nowIso(), reviewNote: note } } : r) }));
  },

  closeProgram(patientId, by, summary) {
    write(s => {
      const p = s.patients.find(x => x.id === patientId);
      // 종료 평가(사후 평가) 없이 종료하지 않습니다.
      if (!p || p.status !== "진행 중" || !s.assessments.some(a => a.patientId === patientId && a.period === "사후 평가")) return s;
      return patchPatient(s, patientId, { status: "종료", closure: { at: nowIso(), by, summary } });
    });
  },

  addLinkage: linkage => write(s => ({ ...s, linkages: [{ ...linkage, id: newId("ln"), status: "의뢰", at: nowIso() }, ...s.linkages] })),
  setContract: (organization, patch) => write(s => {
    const has = s.contracts.some(c => c.organization === organization);
    const base = { organization, model: "회차당", unitFee: 0, monthlyFee: 0, since: todayLocal(), manager: "" } as const;
    return { ...s, contracts: has ? s.contracts.map(c => c.organization === organization ? { ...c, ...patch } : c) : [...s.contracts, { ...base, ...patch }] };
  }),
  setBilling: (key, patch) => write(s => {
    const previous = s.billing[key];
    if (previous?.status === "입금 완료" || previous?.status === "청구 완료" && patch.status !== "입금 완료") return s;
    const split = key.lastIndexOf("|"), org = key.slice(0, split), period = key.slice(split + 1);
    const contract = s.contracts.find(c => c.organization === org);
    if (!contract || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period) || patch.status === "청구 완료" && period >= todayLocal().slice(0, 7) || patch.status === "입금 완료" && previous?.status !== "청구 완료") return s;
    const snapshot = previous?.snapshot ?? captureBilling(s, contract, period, nowIso());
    return { ...s, billing: { ...s.billing, [key]: { ...(previous ?? { status: "청구 전" as const }), ...patch, snapshot } } };
  }),
  adjustBilling(key, amount, reason, by) {
    let ok = false;
    write(s => { const b = s.billing[key]; if (!b?.snapshot || !Number.isFinite(amount) || !Number.isInteger(amount) || !amount || !reason.trim() || !by.trim() || b.snapshot.total + (b.adjustments ?? []).reduce((n, a) => n + a.amount, 0) + amount < 0) return s; ok = true; return { ...s, billing: { ...s.billing, [key]: { ...b, adjustments: [...(b.adjustments ?? []), { id: newId("adjust"), amount, reason: reason.trim(), by, at: nowIso() }] } } }; });
    return ok;
  },
  setInquiry: (threadId, patch) => write(s => ({ ...s, inquiries: { ...s.inquiries, [threadId]: { ...{ status: "접수" as const, category: "일반" }, ...s.inquiries[threadId], ...patch, updatedAt: nowIso() } } })),
  completeLinkage: (id, result) => write(s => ({ ...s, linkages: s.linkages.map(l => l.id === id ? { ...l, status: "연계 완료", result } : l) })),

  rejectPlan(patientId, by, reason) {
    write(s => patchPatient(s, patientId, { approval: { status: "반려", by, at: nowIso(), reason } }));
  },

  saveRecord(patientId, input, { confirm, author }) {
    const id = input.id ?? newId("record");
    let saved = false;
    write(s => {
      const patient = s.patients.find(p => p.id === patientId);
      const previous = s.records.find(r => r.id === id);
      if (!patient || previous?.confirmed) return s; // 확정된 기록은 correctRecord로만 바꿉니다.
      const sessionNo = previous?.sessionNo ?? Math.max(patient.completed, ...s.records.filter(r => r.patientId === patientId).map(r => r.sessionNo ?? 0)) + 1;
      const measures = input.measures ?? previous?.measures;
      const pick = (code: string) => { const v = measures?.find(m => m.code === code)?.value; return v === null || v === undefined ? "" : String(v); };
      const { id: _id, nextDate, nextTime, ...fields } = input;
      void _id;
      const appliedVersion = prescriptionForDate(s, patient, input.date ?? previous?.date ?? todayLocal());
      if (confirm && appliedVersion && author && !s.prescriptionAcknowledgments.some(a => a.versionId === appliedVersion.id && a.providerId === author.id)) return s;
      const visitDate = input.date ?? previous?.date ?? todayLocal(), rx = appliedVersion?.prescription ?? patient.prescription;
      if (confirm && rx && (visitDate < rx.startDate || visitDate > rx.endDate)) return s;
      saved = true;
      const record: CareRecord = {
        ...previous,
        ...fields,
        id,
        patientId,
        sessionNo,
        date: input.date ?? previous?.date ?? todayLocal(),
        place: fields.place ?? previous?.place ?? patient.nextPlace ?? patient.place ?? { kind: "자택" },
        title: input.activities ? `${sessionNo}회차 · ${input.activities.length ? input.activities.slice(0, 2).join("·") : "프로그램 진행"}` : previous?.title ?? `${sessionNo}회차 · 프로그램 진행`,
        // 하위 호환 필드는 측정값에서 채웁니다.
        walk: measures ? pick("walk_distance") : input.walk,
        pain: measures ? pick("pain_nrs") : input.pain,
        measures,
        confirmed: confirm,
        updatedAt: nowIso(),
        authorId: author?.id ?? previous?.authorId,
        prescriptionVersionId: appliedVersion?.id ?? previous?.prescriptionVersionId,
        hospitalAtVisit: previous?.hospitalAtVisit ?? patient.hospital,
      };
      const records = [record, ...s.records.filter(r => r.id !== id)];
      if (!confirm) return { ...s, records };
      // 확정: 미참여는 회차 수에 넣지 않고, 다음 일정을 함께 갱신합니다.
      const counted = record.attendance !== "미참여";
      return {
        ...patchPatient(s, patientId, {
          completed: counted ? patient.completed + 1 : patient.completed,
          ...(nextDate && nextTime ? { nextDate, nextTime } : {}),
          nextPlace: undefined, // 이번 회차만 바꾼 장소는 확정 후 기본 장소로 돌아갑니다.
        }),
        records,
      };
    });
    return saved ? id : "";
  },

  correctRecord(recordId, input, reason, author) {
    write(s => {
      const previous = s.records.find(r => r.id === recordId && r.confirmed);
      if (!previous || !reason.trim() || previous.authorId && previous.authorId !== author.id) return s;
      const delta = Number((input.attendance ?? previous.attendance) !== "미참여") - Number(previous.attendance !== "미참여");
      return {
      ...s,
      patients: s.patients.map(p => p.id === previous.patientId ? { ...p, completed: Math.max(0, p.completed + delta) } : p),
      records: s.records.map(r => {
        if (r.id !== recordId || !r.confirmed) return r;
        // 일정은 정정 대상이 아닙니다(일정 변경은 별도 흐름).
        const { nextDate: _d, nextTime: _t, ...fields } = input;
        void _d; void _t;
        const measures = fields.measures ?? r.measures;
        const pick = (code: string) => { const v = measures?.find(m => m.code === code)?.value; return v === null || v === undefined ? "" : String(v); };
        const sessionNo = r.sessionNo;
        const updated: CareRecord = {
          ...r,
          ...fields,
          measures,
          walk: measures ? pick("walk_distance") : fields.walk,
          pain: measures ? pick("pain_nrs") : fields.pain,
          title: fields.activities && sessionNo ? `${sessionNo}회차 · ${fields.activities.length ? fields.activities.slice(0, 2).join("·") : "프로그램 진행"}` : r.title,
          updatedAt: nowIso(),
        };
        const { revisions: prevRevisions, ...snapshot } = r;
        const changes = describeChanges(r, updated);
        return {
          ...updated,
          revisions: [{ at: nowIso(), by: author.name, reason, content: r.content, next: r.next, walk: r.walk, pain: r.pain, changes, snapshot }, ...(prevRevisions ?? [])],
        };
      }),
    }; });
  },

  submitApplication(application) {
    const id = newId("app");
    write(s => ({ ...s, applications: [{ ...application, id, createdAt: nowIso(), status: "검수 대기" }, ...s.applications] }));
    return id;
  },

  reviewApplication(id, status, note) {
    write(s => { const a = s.applications.find(a => a.id === id); if (!a) return s; const provider = { id: `provider-${a.id}`, name: a.name, license: a.license, years: a.years, focus: a.programs, visit: a.methods, area: a.regions.join(" · "), applicationId: a.id }; return { ...s, applications: s.applications.map(a => (a.id === id ? { ...a, status, reviewNote: note, reviewedAt: nowIso() } : a)), registeredProviders: status === "승인" && !s.registeredProviders.some(p => p.applicationId === id) ? [...s.registeredProviders, provider] : s.registeredProviders }; });
  },

  requestSchedule(request) {
    write(s => ({
      ...s,
      // 같은 대상의 처리 전 요청은 새 요청으로 대체합니다.
      scheduleRequests: [{ ...request, id: newId("sr"), status: "요청", createdAt: nowIso() }, ...s.scheduleRequests.filter(r => !(r.patientId === request.patientId && r.status === "요청"))],
    }));
  },

  respondSchedule(id, status, response) {
    write(s => {
      const req = s.scheduleRequests.find(r => r.id === id);
      if (!req || req.status !== "요청") return s;
      const next = status === "확정" && req.kind === "변경" ? patchPatient(s, req.patientId, { ...(req.date && req.time ? { nextDate: req.date, nextTime: req.time } : {}), ...(req.place ? { nextPlace: req.place } : {}) }) : s;
      return { ...next, scheduleRequests: next.scheduleRequests.map(r => (r.id === id ? { ...r, status, response, respondedAt: nowIso() } : r)) };
    });
  },

  cancelScheduleRequest(id) {
    write(s => ({ ...s, scheduleRequests: s.scheduleRequests.map(r => (r.id === id && r.status === "요청" ? { ...r, status: "취소", respondedAt: nowIso() } : r)) }));
  },

  sendMessage(threadId, sender, text) {
    const body = text.trim();
    if (!body) return;
    write(s => ({ ...s, messages: [...s.messages, { id: newId("msg"), threadId, senderKey: sender.key, senderName: sender.name, text: body.slice(0, 2000), at: nowIso(), readBy: [sender.key] }] }));
  },

  markThreadRead(threadId, readerKey) {
    const s0 = read();
    if (!s0.messages.some(m => m.threadId === threadId && !m.readBy.includes(readerKey))) return; // 바뀐 게 없으면 저장하지 않습니다.
    write(s => ({ ...s, messages: s.messages.map(m => (m.threadId === threadId && !m.readBy.includes(readerKey) ? { ...m, readBy: [...m.readBy, readerKey] } : m)) }));
  },

  addAssessment: assessment => write(s => ({ ...s, assessments: [{ id: newId("a"), ...assessment }, ...s.assessments] })),

  shareReport(patientId, period) {
    write(s => {
      const p = s.patients.find(p => p.id === patientId), report = latestReport(s, patientId, period);
      const match = /^(\d{4})년 (\d{1,2})월$/.exec(period);
      if (!p?.consent || !match || report?.shared) return s;
      const month = `${match[1]}-${match[2].padStart(2, "0")}`, at = nowIso();
      if (!s.records.some(r => r.patientId === patientId && r.confirmed && r.date.startsWith(month))) return s;
      return publishReport(s, { ...(report ?? { id: newId("rp"), patientId, period, version: 1 }), shared: true, sharedAt: at, snapshot: reportSnapshot(s, p, month, at) });
    });
  },

  saveReport(patientId, period, fields, share) {
    write(s => {
      const report = latestReport(s, patientId, period);
      if (report?.shared) return s; // 공유된 보고서는 고치지 않습니다.
      const p = s.patients.find(p => p.id === patientId), match = /^(\d{4})년 (\d{1,2})월$/.exec(period), at = nowIso();
      if (!p || !match || share && (!p.consent || !fields.opinion?.trim())) return s;
      const month = `${match[1]}-${match[2].padStart(2, "0")}`;
      if (share && !s.records.some(r => r.patientId === patientId && r.confirmed && r.date.startsWith(month))) return s;
      const next = { ...(report ?? { id: newId("rp"), patientId, period, shared: false, version: 1 }), ...fields, writtenAt: at, ...(share ? { shared: true, sharedAt: at, snapshot: reportSnapshot(s, p, month, at) } : {}) };
      return share ? publishReport(s, next) : { ...s, reports: [next, ...s.reports.filter(r => r.id !== next.id)] };
    });
  },

  confirmReport(patientId, period, by) {
    const report = latestReport(read(), patientId, period, true);
    if (report) workflow({ type: "confirmReportVersion", reportId: report.id, by });
  },

  provideReport(patientId, month, by, note, reviewedSignature) {
    let applied = false;
    write(s => {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !by.trim() || !note.trim()) return s;
      const p = s.patients.find(p => p.id === patientId);
      const period = `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`;
      const report = latestReport(s, patientId, period);
      if (reviewedSignature && reviewedSignature !== reportReviewSignature(s, patientId, period)) return s;
      if (!p?.consent || report?.shared || !s.records.some(r => r.patientId === patientId && r.confirmed && r.date.startsWith(month))) return s;
      const at = nowIso();
      const snapshot = reportSnapshot(s, p, month, at);
      const next = { ...(report ?? { id: newId("rp"), patientId, period, version: 1 }), shared: true, sharedAt: at, providedBy: by, providedAt: at, reviewNote: note.trim(), snapshot };
      applied = true;
      return publishReport(s, next);
    });
    return applied;
  },

  reviseReport: (reportId, reason, by) => workflow({ type: "reviseReport", reportId, reason, by }) === true,
  confirmReportVersion: (reportId, by) => workflow({ type: "confirmReportVersion", reportId, by }) === true,
  saveReevaluation(input) { const value = workflow({ type: "saveReevaluation", input }); return typeof value === "string" ? value : ""; },
  savePrescriptionDraft(input, expectedBaseSignature) { const patient = read().patients.find(p => p.id === input.patientId); if (expectedBaseSignature && (!patient || expectedBaseSignature !== prescriptionSignature(patient, read()))) return ""; const value = workflow({ type: "savePrescriptionDraft", input }); return typeof value === "string" ? value : ""; },
  approvePrescriptionDraft: (id, revision, by) => workflow({ type: "approvePrescriptionDraft", id, revision, by }) === true,
  acknowledgePrescription: (patientId, versionId, provider) => workflow({ type: "acknowledgePrescription", patientId, versionId, provider }) === true,
  setProviderControl: control => workflow({ type: "setProviderControl", control }) === true,
  saveQualityReview: input => workflow({ type: "saveQualityReview", input }) === true,
  saveSatisfaction: input => workflow({ type: "saveSatisfaction", input }) === true,
  saveHospitalReview: input => workflow({ type: "saveHospitalReview", input }) === true,

  toggleHomeTask: taskId =>
    write(s => ({
      ...s,
      homeTasks: s.homeTasks.includes(taskId) ? s.homeTasks.filter(t => t !== taskId) : [...s.homeTasks, taskId],
    })),

  applyToProvider(input, providerId, programId) {
    let id = "";
    write(s => {
      const program = programById(s, programId), provider = allProviders(s).find(e => e.id === providerId);
      if (!program?.active || program.providerId !== providerId || !provider || !input.name.trim() || !input.condition.trim() || !input.nextDate || !input.nextTime || !input.consent) return s;
      id = newId("p");
      const at = nowIso();
      const patient: Patient = {
        ...input, id, name: input.name.trim(), condition: input.condition.trim(),
        hospital: program.center, provider: "", status: "배정 대기", completed: 0,
        total: program.packSessions ?? 8, method: program.method === "방문" ? "방문" : "센터", programId: program.id,
        place: programPlace(program),
        requestedProviderId: provider.id, requestedProviderName: provider.name,
      };
      return { ...s, patients: [patient, ...s.patients], assignments: [{ id: newId("as"), patientId: id, providerId: provider.id, providerName: provider.name, status: "제안", createdAt: at, adjustmentReason: "이용자 신청", by: input.applicant }, ...s.assignments] };
    });
    return id;
  },

  acceptRequest(patientId, provider) {
    let applied = false;
    write(s => {
      const p = s.patients.find(x => x.id === patientId), latest = s.assignments.find(a => a.patientId === patientId);
      if (!p || p.status !== "배정 대기" || latest?.status !== "제안" || latest.providerId !== provider.id) return s;
      const at = nowIso(), proposalId = latest.proposalId ?? latest.id;
      applied = true;
      return {
        ...patchPatient(s, patientId, { providerId: provider.id, provider: provider.name, requestedProviderId: undefined, requestedProviderName: undefined, status: "승인 대기" }),
        assignments: [
          { ...latest, id: newId("as"), proposalId, status: "확정", createdAt: at, respondedAt: at, by: provider.name },
          { ...latest, id: newId("as"), proposalId, status: "수락", createdAt: at, respondedAt: at, by: provider.name },
          ...s.assignments,
        ],
      };
    });
    return applied;
  },

  confirmByDoctor(patientId, check, firstDate, firstTime) {
    let applied = false;
    write(s => {
      const p = s.patients.find(x => x.id === patientId);
      if (!p || p.status !== "승인 대기" || !p.providerId || !check.doctor.trim() || !check.opinion.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(firstDate) || !/^\d{2}:\d{2}$/.test(firstTime)) return s;
      if (s.patients.some(o => o.id !== p.id && o.status !== "종료" && o.providerId === p.providerId && o.nextDate === firstDate && o.nextTime === firstTime)) return s;
      const at = nowIso(), program = programFor(s, p);
      applied = true;
      const cautions = check.cautions.map(c => c.trim()).filter(Boolean), contraindications = check.contraindications.map(c => c.trim()).filter(Boolean);
      const next = patchPatient(s, patientId, {
        status: "진행 중", doctor: check.doctor, nextDate: firstDate, nextTime: firstTime,
        precautions: cautions.join(" · ") || p.precautions,
        doctorCheck: { doctor: check.doctor, opinion: check.opinion.trim(), contraindications, cautions, at },
        approval: { status: "승인", by: check.doctor, at },
        ...(program && !p.programId ? { programId: program.id } : {}),
      });
      if (!program || s.payments.some(x => x.patientId === patientId && x.status !== "취소")) return next;
      const kind = program.payment === "이용권" ? "이용권" as const : "회차" as const;
      return { ...next, payments: [{ id: newId("pay"), patientId, programId: program.id, kind, ...paymentFor(program, kind), status: "결제 대기", createdAt: at, by: check.doctor }, ...next.payments] };
    });
    return applied;
  },

  changeProvider(patientId, provider, reason, by) {
    let applied = false;
    write(s => {
      const p = s.patients.find(x => x.id === patientId), target = allProviders(s).find(e => e.id === provider.id);
      if (!p || p.status === "종료" || !target || p.providerId === target.id || !reason.trim() || !by.trim()) return s;
      if (p.status !== "배정 대기" && s.patients.some(o => o.id !== p.id && o.status !== "종료" && o.providerId === target.id && o.nextDate === p.nextDate && o.nextTime === p.nextTime)) return s;
      const current = programFor(s, p);
      const program = s.programs.find(x => x.providerId === target.id && x.active && x.method === current?.method) ?? s.programs.find(x => x.providerId === target.id && x.active);
      const at = nowIso(), id = newId("as");
      applied = true;
      return {
        ...patchPatient(s, patientId, { providerId: target.id, provider: target.name, requestedProviderId: undefined, requestedProviderName: undefined, status: p.status === "배정 대기" ? "승인 대기" : p.status, ...(program ? { programId: program.id } : {}) }),
        assignments: [{ id, proposalId: id, patientId, providerId: target.id, providerName: target.name, status: "확정", createdAt: at, respondedAt: at, by, adjustmentReason: reason.trim() }, ...s.assignments],
      };
    });
    return applied;
  },

  saveProgram(program) {
    let applied = false;
    write(s => {
      const pack = program.payment === "이용권";
      if (!program.title.trim() || !allProviders(s).some(e => e.id === program.providerId) || !(program.minutes > 0) || !(program.price > 0) || pack && (!(Number(program.packSessions) > 0) || !(Number(program.packPrice) > 0)) || program.method === "외부" && !program.placeId) return s;
      applied = true;
      const value = { ...program, id: program.id || newId("pg"), title: program.title.trim(), ...(pack ? {} : { packSessions: undefined, packPrice: undefined }), ...(program.method === "외부" ? {} : { placeId: undefined }) };
      return { ...s, programs: s.programs.some(x => x.id === value.id) ? s.programs.map(x => x.id === value.id ? value : x) : [...s.programs, value] };
    });
    return applied;
  },

  requestPayment(patientId, programId, kind, by) {
    let id = "";
    write(s => {
      const p = s.patients.find(x => x.id === patientId), program = programById(s, programId);
      if (!p || p.status === "종료" || !program || kind === "이용권" && program.payment !== "이용권" || !by.trim()) return s;
      if (s.payments.some(x => x.patientId === patientId && x.status === "결제 대기")) return s; // 결제 대기는 한 건만 둡니다.
      id = newId("pay");
      return { ...s, payments: [{ id, patientId, programId, kind, ...paymentFor(program, kind), status: "결제 대기", createdAt: nowIso(), by }, ...s.payments] };
    });
    return id;
  },

  markPaid(paymentId, method) {
    let applied = false;
    write(s => {
      const x = s.payments.find(x => x.id === paymentId);
      if (!x || x.status !== "결제 대기" || !method.trim()) return s;
      applied = true;
      return { ...s, payments: s.payments.map(y => y.id === paymentId ? { ...y, status: "결제 완료", paidAt: nowIso(), method: method.trim() } : y) };
    });
    return applied;
  },

  reset: () => write(() => normalizeWorkflow(seed)),
  update: write,
};

}
