import { experts } from "./data";
import type { CareState, Patient, Prescription, PrescriptionVersion, Report, ProviderControl, Reevaluation, PrescriptionDraft, ProviderRef, QualityReview, Satisfaction, HospitalReview } from "./repo/types";
import { PROVIDER_CHECKS } from "./repo/types";

export const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
export const validDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
export function normalizeWorkflow(s: CareState): CareState {
  return { ...s, reevaluations: s.reevaluations ?? [], prescriptionDrafts: s.prescriptionDrafts ?? [], prescriptionVersions: s.prescriptionVersions ?? [], prescriptionAcknowledgments: s.prescriptionAcknowledgments ?? [], providerControls: s.providerControls ?? {}, registeredProviders: s.registeredProviders ?? [], qualityReviews: s.qualityReviews ?? [], satisfactions: s.satisfactions ?? [], hospitalReviews: s.hospitalReviews ?? [], programs: s.programs ?? [], payments: s.payments ?? [] };
}
export const allProviders = (s: CareState) => [...(s.demo === false ? [] : experts), ...(s.registeredProviders ?? []).filter(p => (s.demo === false || !experts.some(e => e.id === p.id)))];
export function providerEligibility(s: CareState, providerId: string, today: string) {
  const c = s.providerControls?.[providerId];
  if (!c) return "인증 확인 필요";
  if (c.hold) return "배정 보류";
  if (!validDay(c.insuranceUntil) || c.insuranceUntil < today) return "보험 유효기간 확인";
  if (!PROVIDER_CHECKS.every(k => c.checks[k]?.confirmed && c.checks[k]?.reference.trim())) return "인증 보완 필요";
  return "배정 가능";
}
export const latestReport = (s: CareState, patientId: string, period: string, sharedOnly = false) => s.reports.filter(r => r.patientId === patientId && r.period === period && (!sharedOnly || r.shared)).sort((a, b) => (b.version ?? 1) - (a.version ?? 1))[0];
export const latestPrescription = (s: CareState, patientId: string) => s.prescriptionVersions.filter(v => v.patientId === patientId).sort((a, b) => b.version - a.version)[0];
export function prescriptionForDate(s: CareState, p: Patient, date: string): PrescriptionVersion | undefined {
  return s.prescriptionVersions?.filter(v => v.patientId === p.id && v.effectiveFrom <= date).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.version - a.version)[0];
}
export const prescriptionSignature = (p: Patient, s: CareState) => JSON.stringify([p.prescription, p.precautions, latestPrescription(s, p.id)?.id]);
export const reportReviewSignature = (s: CareState, patientId: string, period: string) => JSON.stringify([s.patients.find(p => p.id === patientId), s.records.filter(r => r.patientId === patientId), s.assessments.filter(a => a.patientId === patientId), s.reports.filter(r => r.patientId === patientId && r.period === period)]);
export function reportSnapshot(s: CareState, p: Patient, month: string, at: string) {
  const version = prescriptionForDate(s, p, `${month}-31`);
  const patient = version ? { ...p, prescription: version.prescription, precautions: version.precautions, doctor: version.prescription.doctor, activePrescriptionVersionId: version.id } : p;
  return copy({ patient, records: s.records.filter(r => r.patientId === p.id && r.confirmed && r.date.slice(0, 7) <= month), assessments: s.assessments.filter(a => a.patientId === p.id && a.date.slice(0, 7) <= month), capturedAt: at });
}
export function publishReport(s: CareState, report: Report): CareState {
  return { ...s, reports: [report, ...s.reports.filter(r => r.id !== report.id).map(r => report.supersedesId === r.id ? { ...r, supersededById: report.id } : r)] };
}
export function approvedVersion(s: CareState, p: Patient, rx: Prescription, precautions: string, effectiveFrom: string, by: string, at: string, id: string, links: Partial<PrescriptionVersion> = {}) {
  const v: PrescriptionVersion = { id, patientId: p.id, version: (latestPrescription(s, p.id)?.version ?? 0) + 1, prescription: copy(rx), precautions, effectiveFrom, by, at, ...links };
  return { ...s, prescriptionVersions: [v, ...s.prescriptionVersions] };
}

type Command =
  | { type: "reviseReport"; reportId: string; reason: string; by: string }
  | { type: "confirmReportVersion"; reportId: string; by: string }
  | { type: "saveReevaluation"; input: Omit<Reevaluation, "id" | "at"> }
  | { type: "savePrescriptionDraft"; input: Omit<PrescriptionDraft, "id" | "at" | "baseSignature" | "baseVersionId" | "status" | "revision"> }
  | { type: "approvePrescriptionDraft"; id: string; revision: number; by: string }
  | { type: "acknowledgePrescription"; patientId: string; versionId: string; provider: ProviderRef }
  | { type: "setProviderControl"; control: Omit<ProviderControl, "at"> }
  | { type: "saveQualityReview"; input: Omit<QualityReview, "id" | "at"> }
  | { type: "saveSatisfaction"; input: Omit<Satisfaction, "id" | "at"> }
  | { type: "saveHospitalReview"; input: Omit<HospitalReview, "id" | "at"> };
export function transitionWorkflow(original: CareState, command: Command, at: string, id: (prefix: string) => string): { state: CareState; result: boolean | string } {
  let s = normalizeWorkflow(original);
  const fail = { state: original, result: false };
  switch (command.type) {
    case "reviseReport": {
      const r = s.reports.find(r => r.id === command.reportId);
      if (!r?.shared || !command.reason.trim() || !command.by.trim() || latestReport(s, r.patientId, r.period)?.id !== r.id) return fail;
      const draft: Report = { id: id("rp"), patientId: r.patientId, period: r.period, shared: false, version: (r.version ?? 1) + 1, supersedesId: r.id, correctionReason: command.reason.trim(), opinion: r.opinion, plan: r.plan, judgments: copy(r.judgments ?? {}), writtenBy: command.by, writtenAt: at };
      return { state: { ...s, reports: [draft, ...s.reports] }, result: true };
    }
    case "confirmReportVersion": {
      const r = s.reports.find(r => r.id === command.reportId);
      if (!r?.shared || !s.patients.find(p => p.id === r.patientId)?.consent) return fail;
      if (r.confirmedAt) return { state: original, result: true };
      return { state: { ...s, reports: s.reports.map(x => x.id === r.id ? { ...x, confirmedBy: command.by, confirmedAt: x.confirmedAt ?? at } : x) }, result: true };
    }
    case "saveReevaluation": {
      const i = command.input, r = s.reports.find(r => r.id === i.reportId && r.shared && r.patientId === i.patientId);
      if (!r || !validDay(i.date) || !i.opinion.trim() || !i.by.trim() || !["기존 승인 유지", "변경안 검토", "추가 확인 필요"].includes(i.decision)) return fail;
      const rid = id("reeval");
      return { state: { ...s, reevaluations: [{ ...copy(i), id: rid, at }, ...s.reevaluations] }, result: rid };
    }
    case "savePrescriptionDraft": {
      const i = command.input, p = s.patients.find(p => p.id === i.patientId);
      if (!p || !validDay(i.effectiveFrom) || !validDay(i.prescription.startDate) || !validDay(i.prescription.endDate) || i.prescription.endDate < i.prescription.startDate || i.effectiveFrom < i.prescription.startDate || i.effectiveFrom > i.prescription.endDate || !i.prescription.scope.length || !i.prescription.doctorOpinion?.trim() || !i.prescription.consentChecked || ![1, 2, 3].includes(i.prescription.perWeek)) return fail;
      const re = i.reevaluationId ? s.reevaluations.find(r => r.id === i.reevaluationId && r.patientId === p.id) : undefined;
      if (i.reevaluationId && (!re || re.reportId !== i.reportId)) return fail;
      const did = id("rx-draft");
      return { state: { ...s, prescriptionDrafts: [{ ...copy(i), id: did, at, baseSignature: prescriptionSignature(p, s), baseVersionId: latestPrescription(s, p.id)?.id, status: "작성 중", revision: 1 }, ...s.prescriptionDrafts] }, result: did };
    }
    case "approvePrescriptionDraft": {
      const d = s.prescriptionDrafts.find(d => d.id === command.id), p = s.patients.find(p => p.id === d?.patientId);
      if (!d || !p?.providerId || d.status !== "작성 중" || d.revision !== command.revision || d.baseSignature !== prescriptionSignature(p, s) || !command.by.trim()) return fail;
      if (p.prescription && !s.prescriptionVersions.some(v => v.patientId === p.id)) s = approvedVersion(s, p, p.prescription, p.precautions, p.prescription.startDate, p.approval?.by || "기존 병원 승인", p.approval?.at || at, id("rx"));
      s = approvedVersion(s, p, d.prescription, d.precautions, d.effectiveFrom, command.by, at, id("rx"), { draftId: d.id, reportId: d.reportId, reevaluationId: d.reevaluationId });
      const active = prescriptionForDate(s, p, new Date(at).toLocaleDateString("sv-SE"));
      return { state: { ...s, patients: s.patients.map(x => x.id === p.id ? { ...x, status: x.status === "배정 대기" || x.status === "승인 대기" ? "진행 중" : x.status, ...(active ? { prescription: active.prescription, precautions: active.precautions, doctor: active.prescription.doctor } : { prescription: d.prescription, precautions: d.precautions, doctor: d.prescription.doctor }), approval: { status: "승인", by: command.by, at } } : x), prescriptionDrafts: s.prescriptionDrafts.map(x => x.id === d.id ? { ...x, status: "승인" } : x) }, result: true };
    }
    case "acknowledgePrescription": {
      if (!s.patients.some(p => p.id === command.patientId && p.providerId === command.provider.id) || !s.prescriptionVersions.some(v => v.id === command.versionId && v.patientId === command.patientId)) return fail;
      if (s.prescriptionAcknowledgments.some(a => a.versionId === command.versionId && a.providerId === command.provider.id)) return { state: s, result: true };
      return { state: { ...s, prescriptionAcknowledgments: [{ id: id("ack"), patientId: command.patientId, versionId: command.versionId, providerId: command.provider.id, by: command.provider.name, at }, ...s.prescriptionAcknowledgments] }, result: true };
    }
    case "setProviderControl": {
      const c = command.control;
      if (!allProviders(s).some(p => p.id === c.providerId) || !validDay(c.insuranceUntil) || c.hold && !c.reason.trim() || PROVIDER_CHECKS.some(k => c.checks[k]?.confirmed && !c.checks[k]?.reference.trim())) return fail;
      return { state: { ...s, providerControls: { ...s.providerControls, [c.providerId]: { ...copy(c), at } }, providerControlHistory: [{ ...copy(c), at }, ...(s.providerControlHistory ?? [])] }, result: true };
    }
    case "saveQualityReview": {
      const i = command.input;
      if (!i.findings.trim() || !/^\d{4}-\d{2}$/.test(i.month) || !allProviders(s).some(p => p.id === i.providerId)) return fail;
      const c: ProviderControl = s.providerControls[i.providerId] ?? { providerId: i.providerId, checks: {}, insuranceUntil: "", grade: "미지정", hold: false, reason: "", by: i.by, at };
      return { state: { ...s, qualityReviews: [{ ...copy(i), id: id("quality"), at }, ...s.qualityReviews], providerControls: i.action === "배정 보류" ? { ...s.providerControls, [i.providerId]: { ...c, hold: true, reason: i.findings, by: i.by, at } } : s.providerControls }, result: true };
    }
    case "saveSatisfaction": {
      const i = command.input;
      if (!s.patients.some(p => p.id === i.patientId) || !allProviders(s).some(p => p.id === i.providerId) || !Number.isFinite(i.score) || !Number.isFinite(i.maxScore) || i.maxScore <= 0 || i.score < 0 || i.score > i.maxScore || !/^\d{4}-\d{2}$/.test(i.month)) return fail;
      return { state: { ...s, satisfactions: [{ ...copy(i), id: id("satisfaction"), at }, ...s.satisfactions] }, result: true };
    }
    case "saveHospitalReview": {
      const i = command.input;
      if (!i.hospital.trim() || !i.findings.trim() || !i.action.trim() || !i.followUp.trim()) return fail;
      return { state: { ...s, hospitalReviews: [{ ...copy(i), id: id("review"), at }, ...s.hospitalReviews] }, result: true };
    }
  }
}
