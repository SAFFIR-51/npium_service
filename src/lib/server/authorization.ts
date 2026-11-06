import { validDay } from "../workflow";
import type { Account } from "../account";
import type { CareState, Patient } from "../repo/types";
import { emptyState } from "../repo/empty";
const deny = () => { throw new Error("이 작업에 대한 접근 권한이 없습니다."); };
export function canReadPatient(s: CareState, a: Account, p: Patient) {
  if (a.role === "admin") return true;
  if (a.role === "hospital" || a.role === "center") return p.hospital === a.organization;
  if (a.role === "patient") return p.guardianAccountId === a.id;
  return p.providerId === a.providerId || s.assignments.find(x => x.patientId === p.id)?.providerId === a.providerId && ["제안", "수락"].includes(s.assignments.find(x => x.patientId === p.id)!.status) || s.records.some(r => r.patientId === p.id && r.authorId === a.providerId);
}
export function canThread(s: CareState, a: Account, thread: string) {
  if (thread.startsWith("support-")) return a.role === "admin" || thread === `support-${a.role === "provider" ? a.providerId : a.id}`;
  const p = s.patients.find(p => thread === `care-${p.id}`);
  return !!p && (a.role === "provider" && p.providerId === a.providerId || a.role === "patient" && p.guardianAccountId === a.id);
}
export function scopedState(s: CareState, a: Account): CareState {
  if (a.role === "admin") return s;
  const patients = s.patients.filter(p => canReadPatient(s, a, p));
  const ids = new Set(patients.map(p => p.id)), consenting = new Set(patients.filter(p => p.consent).map(p => p.id));
  const clinical = (id: string) => a.role !== "hospital" || consenting.has(id);
  const reports = s.reports.filter(r => ids.has(r.patientId) && clinical(r.patientId) && (a.role === "provider" ? s.patients.some(p => p.id === r.patientId && p.providerId === a.providerId) : r.shared));
  const records = a.role === "hospital" ? [...new Map([...reports].sort((a,b) => (a.version ?? 1) - (b.version ?? 1)).flatMap(r => r.snapshot?.records ?? []).map(r => [r.id, r])).values()] : s.records.filter(r => ids.has(r.patientId) && (a.role === "provider" ? s.patients.some(p => p.id === r.patientId && p.providerId === a.providerId) || r.authorId === a.providerId : r.confirmed));
  const assessments = a.role === "hospital" ? [...new Map([...reports].sort((a,b) => (a.version ?? 1) - (b.version ?? 1)).flatMap(r => r.snapshot?.assessments ?? []).map(r => [r.id, r])).values()] : s.assessments.filter(r => ids.has(r.patientId));
  return { ...emptyState, patients, records, assessments, reports, registeredProviders: s.registeredProviders, assignments: s.assignments.filter(r => ids.has(r.patientId) && (a.role !== "provider" || r.providerId === a.providerId)), scheduleRequests: s.scheduleRequests.filter(r => ids.has(r.patientId)), linkages: a.role === "hospital" ? s.linkages.filter(r => ids.has(r.patientId)) : [], messages: s.messages.filter(m => canThread(s, a, m.threadId)), reevaluations: s.reevaluations.filter(r => ids.has(r.patientId) && clinical(r.patientId)), prescriptionDrafts: a.role === "hospital" ? s.prescriptionDrafts.filter(r => ids.has(r.patientId)) : [], prescriptionVersions: s.prescriptionVersions.filter(r => ids.has(r.patientId) && clinical(r.patientId)), prescriptionAcknowledgments: s.prescriptionAcknowledgments.filter(r => ids.has(r.patientId)), satisfactions: s.satisfactions.filter(r => ids.has(r.patientId) && (a.role !== "provider" || r.providerId === a.providerId)), programs: s.programs, payments: s.payments.filter(r => ids.has(r.patientId)) };
}
const allowed: Record<string, Account["role"][]> = {
  addPatient: ["hospital", "patient", "admin"], changePatient: ["hospital", "patient", "admin"],
  proposeAssignment: ["admin"], finalizeAssignment: ["admin"], cancelAssignment: ["admin"], acceptAssignment: ["provider"], declineAssignment: ["provider"],
  rejectPlan: ["hospital", "center"], reviewAdverse: ["hospital"], closeProgram: ["hospital"], addLinkage: ["hospital"], completeLinkage: ["hospital"],
  saveRecord: ["provider"], correctRecord: ["provider"], addAssessment: ["provider"], saveReport: ["provider"],
  provideReport: ["admin"], reviseReport: ["admin"], confirmReportVersion: ["hospital"], saveReevaluation: ["hospital"], savePrescriptionDraft: ["hospital"], approvePrescriptionDraft: ["hospital"], acknowledgePrescription: ["provider"],
  setProviderControl: ["admin"], saveQualityReview: ["admin"], saveSatisfaction: ["admin", "patient"], saveHospitalReview: ["admin"], reviewApplication: ["admin"],
  setContract: ["admin"], setBilling: ["admin"], adjustBilling: ["admin"], setInquiry: ["admin"], requestSchedule: ["patient"], respondSchedule: ["provider"], cancelScheduleRequest: ["patient"],
  sendMessage: ["patient", "provider", "hospital", "center", "admin"], markThreadRead: ["patient", "provider", "hospital", "center", "admin"],
  applyToProvider: ["patient"], acceptRequest: ["provider"], confirmByDoctor: ["center"], changeProvider: ["center"], saveProgram: ["center"], requestPayment: ["center"], markPaid: ["center", "patient"],
};
type Input = Record<string, unknown>;
function object(v: unknown): Input { if (!v || typeof v !== "object" || Array.isArray(v)) return deny(); return v as Input; }
function pick(v: unknown, keys: string[]) { const o = object(v); return Object.fromEntries(keys.filter(k => k in o).map(k => [k, o[k]])); }
const recordKeys = ["id", "date", "content", "next", "walk", "pain", "attendance", "absenceReason", "durationMin", "activities", "measures", "adverse", "education", "place", "contraChecked", "nextDate", "nextTime"];
export function authorize(s: CareState, a: Account, command: string, raw: unknown[]) {
  if (!allowed[command]?.includes(a.role)) deny();
  const args = structuredClone(raw), signer = `${a.name}${a.organization ? ` · ${a.organization}` : ""}`, provider = { id: a.providerId, name: a.name };
  const patient = (id: unknown, assigned = true) => { const p = s.patients.find(p => p.id === id); if (!p || !canReadPatient(s, a, p) || a.role === "provider" && assigned && p.providerId !== a.providerId) return deny(); return p; };
  const reportPatient = (id: unknown) => { const r = s.reports.find(r => r.id === id); if (!r) return deny(); const p = patient(r.patientId); if (a.role === "hospital" && (!p.consent || !r.shared)) deny(); return p; };
  switch (command) {
    case "applyToProvider": {
      const input = pick(args[0], ["name", "age", "sex", "condition", "area", "goal", "precautions", "nextDate", "nextTime", "applicant", "homeAddress", "homeAccess", "consent"]);
      if (typeof args[1] !== "string" || typeof args[2] !== "string" || !Number.isFinite(input.age)) deny();
      args[0] = { ...input, applicant: signer, guardianAccountId: a.id }; break;
    }
    case "acceptRequest": { patient(args[0], false); const latest = s.assignments.find(x => x.patientId === args[0]); if (latest?.providerId !== a.providerId) deny(); args[1] = provider; break; }
    case "confirmByDoctor": { patient(args[0]); args[1] = { ...pick(args[1], ["opinion", "contraindications", "cautions"]), doctor: signer }; break; }
    case "changeProvider": { patient(args[0]); const candidate = s.registeredProviders.find(p => p.id === object(args[1]).id); if (!candidate) deny(); args[1] = { id: candidate!.id, name: candidate!.name }; args[3] = signer; break; }
    case "saveProgram": { const i = pick(args[0], ["id", "providerId", "title", "method", "placeId", "minutes", "payment", "price", "packSessions", "packPrice", "active", "note"]); const old = s.programs.find(x => x.id === i.id); if (old && old.center !== a.organization || !s.registeredProviders.some(p => p.id === i.providerId) || !["방문", "센터", "외부"].includes(String(i.method)) || !["회차별", "이용권"].includes(String(i.payment))) deny(); args[0] = { ...i, id: typeof i.id === "string" ? i.id : "", center: a.organization, active: i.active !== false }; break; }
    case "requestPayment": { patient(args[0]); const pg = s.programs.find(x => x.id === args[1]); if (!pg || pg.center !== a.organization) deny(); args[3] = signer; break; }
    case "markPaid": { const x = s.payments.find(x => x.id === args[0]); if (!x) deny(); patient(x!.patientId, false); args[1] = typeof args[1] === "string" && args[1].trim() ? args[1].slice(0, 40) : deny(); break; }
    case "addPatient": {
      const input = pick(args[0], ["id", "name", "age", "sex", "condition", "area", "hospital", "goal", "precautions", "total", "nextDate", "nextTime", "method", "consent", "homeAddress", "homeAccess", "place", "applicant", "guardianAccountId"]);
      if (typeof input.id !== "string" || s.patients.some(p => p.id === input.id) || typeof input.name !== "string" || !input.name.trim() || typeof input.hospital !== "string" || !input.hospital.trim() || !Number.isFinite(input.age) || !Number.isFinite(input.total)) deny();
      args[0] = { ...input, hospital: a.role === "hospital" ? a.organization : input.hospital, guardianAccountId: a.role === "patient" ? a.id : input.guardianAccountId, provider: "", status: "배정 대기", completed: 0 }; break;
    }
    case "changePatient": {
      patient(args[0]); const keys = a.role === "patient" ? ["consent"] : a.role === "hospital" ? ["place"] : ["guardianAccountId", "nextDate", "nextTime", "homeAddress", "homeAccess"];
      args[1] = pick(args[1], keys); if (!Object.keys(object(args[1])).length) deny(); break;
    }
    case "proposeAssignment": { patient(args[0]); const candidate = s.registeredProviders.find(p => p.id === object(args[1]).id); if (!candidate) deny(); args[1] = { id: candidate!.id, name: candidate!.name }; args[3] = signer; break; }
    case "finalizeAssignment": case "cancelAssignment": patient(args[0]); args[2] = signer; break;
    case "acceptAssignment": case "declineAssignment": { patient(args[0], false); const latest = s.assignments.find(x => x.patientId === args[0]); if (latest?.providerId !== a.providerId) deny(); args[1] = provider; break; }
    case "saveRecord": { const p = patient(args[0]); const i = pick(args[1], recordKeys); if (p.status !== "진행 중" || typeof i.content !== "string" || typeof i.next !== "string" || i.durationMin !== undefined && (!Number.isFinite(i.durationMin) || Number(i.durationMin) < 0)) deny(); const old = s.records.find(r => r.id === i.id); if (old && (old.patientId !== p.id || old.authorId && old.authorId !== a.providerId)) deny(); if (i.adverse) i.adverse = pick(i.adverse, ["occurred", "detail", "action"]); args[1] = i; args[2] = { confirm: object(args[2]).confirm === true, author: provider }; break; }
    case "correctRecord": { const r = s.records.find(r => r.id === args[0]); if (!r || r.authorId !== a.providerId) deny(); patient(r!.patientId, false); args[1] = pick(args[1], recordKeys.filter(k => !["id", "date", "nextDate", "nextTime"].includes(k))); if (object(args[1]).adverse) object(args[1]).adverse = pick(object(args[1]).adverse, ["occurred", "detail", "action"]); args[3] = provider; break; }
    case "addAssessment": { const i = pick(args[0], ["patientId", "period", "date", "rom", "strength", "walking", "balance", "adl", "environment", "measures", "romItems", "mmtItems", "homeRisks"]); patient(i.patientId); args[0] = { ...i, by: signer }; break; }
    case "saveReport": patient(args[0]); args[2] = { ...pick(args[2], ["opinion", "plan", "judgments"]), writtenBy: signer }; args[3] = false; break;
    case "provideReport": if (typeof args[4] !== "string" || !args[4]) deny(); patient(args[0]); args[2] = signer; break;
    case "reviseReport": reportPatient(args[0]); args[2] = signer; break;
    case "confirmReportVersion": reportPatient(args[0]); args[1] = signer; break;
    case "saveReevaluation": { const i = pick(args[0], ["patientId", "reportId", "date", "opinion", "contraindications", "cautions", "decision"]); if (reportPatient(i.reportId).id !== i.patientId) deny(); args[0] = { ...i, by: signer }; break; }
    case "savePrescriptionDraft": { if (typeof args[1] !== "string" || !args[1]) deny(); const i = pick(args[0], ["patientId", "prescription", "precautions", "effectiveFrom", "reportId", "reevaluationId"]); patient(i.patientId); if (i.reportId && reportPatient(i.reportId).id !== i.patientId) deny(); args[0] = { ...i, by: signer }; break; }
    case "approvePrescriptionDraft": { const d = s.prescriptionDrafts.find(d => d.id === args[0]); if (!d) deny(); patient(d!.patientId); args[2] = signer; break; }
    case "acknowledgePrescription": patient(args[0]); args[2] = provider; break;
    case "rejectPlan": case "closeProgram": patient(args[0]); args[1] = signer; break;
    case "reviewAdverse": { const r = s.records.find(r => r.id === args[0]); if (!r) deny(); patient(r!.patientId); args[1] = signer; break; }
    case "addLinkage": { const i = pick(args[0], ["patientId", "to", "reason"]); patient(i.patientId); args[0] = { ...i, by: signer }; break; }
    case "completeLinkage": { const r = s.linkages.find(r => r.id === args[0]); if (!r) deny(); patient(r!.patientId); break; }
    case "requestSchedule": { const i = pick(args[0], ["patientId", "kind", "date", "time", "reason", "place"]); patient(i.patientId); args[0] = { ...i, by: signer }; break; }
    case "respondSchedule": case "cancelScheduleRequest": { const r = s.scheduleRequests.find(r => r.id === args[0]); if (!r) deny(); patient(r!.patientId); break; }
    case "sendMessage": case "markThreadRead": if (typeof args[0] !== "string" || !canThread(s, a, args[0])) deny(); args[1] = command === "sendMessage" ? { key: a.role === "provider" ? a.providerId : a.id, name: signer } : a.role === "provider" ? a.providerId : a.id; break;
    case "saveSatisfaction": { const i = pick(args[0], ["patientId", "providerId", "month", "score", "maxScore", "note"]); const p = patient(i.patientId); if (i.providerId !== p.providerId) deny(); args[0] = { ...i, by: signer }; break; }
    case "setProviderControl": args[0] = { ...pick(args[0], ["providerId", "checks", "insuranceUntil", "grade", "hold", "reason"]), by: signer }; break;
    case "saveQualityReview": args[0] = { ...pick(args[0], ["providerId", "month", "findings", "action"]), by: signer }; break;
    case "saveHospitalReview": args[0] = { ...pick(args[0], ["hospital", "month", "findings", "action", "followUp"]), by: signer }; break;
    case "adjustBilling": args[3] = signer; break;
    case "setBilling": args[1] = pick(args[1], ["status", "issuedAt", "paidAt", "memo"]); break;
    case "setContract": args[1] = pick(args[1], ["model", "unitFee", "monthlyFee", "since", "manager"]); if (object(args[1]).since !== undefined && !validDay(String(object(args[1]).since))) deny(); if (object(args[1]).model !== undefined && !["회차당", "월 정액"].includes(String(object(args[1]).model))) deny(); for (const key of ["unitFee", "monthlyFee"]) { const v = object(args[1])[key]; if (v !== undefined && (!Number.isFinite(v) || Number(v) < 0)) deny(); } break;
  }
  return args;
}
