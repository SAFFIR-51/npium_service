import type { CareRecord, CareState, DoctorCheck, Patient, Payment, Program } from "@/lib/repo/types";
import { CENTERS as PLACES, type Place } from "@/lib/places";

/**
 * 센터 관리 (1차).
 * 센터 = 의사들이 연합해서 차린 재활 센터. 센터 직원은 의사이고, 치료사는 한 센터에만 소속됩니다.
 * 흐름: 이용자가 치료사를 찾아 신청 → 치료사 수락 → 센터 의사 확인(첫 회차 전 필수) → 예약 확정·결제 → 회차 진행.
 * 체험용 예시 데이터입니다. 실제 센터·의사 정보가 아닙니다.
 */
export type CareCenter = {
  id: string;
  name: string;
  /** 의료기관이 아니면 '물리치료'가 아닌 운동 지도 프로그램만 열 수 있습니다. */
  kind: "의료기관" | "비의료기관";
  area: string;
  address: string;
  /** 제휴 공간 목록(src/lib/places.ts)에서 이 센터의 공간 id */
  placeId: string;
  doctors: { name: string; title: string }[];
  intro: string;
};

export const CARE_CENTERS: CareCenter[] = [
  {
    id: "saebom",
    name: "새봄 연합재활센터",
    kind: "의료기관",
    area: "서울 송파구",
    address: "서울 송파구 예시로 10, 3층 (체험용 주소)",
    placeId: "saebom",
    doctors: [
      { name: "정윤호", title: "재활의학과 전문의" },
      { name: "김서진", title: "정형외과 전문의" },
    ],
    intro: "재활의학과·정형외과 의사들이 함께 연 센터입니다. 소속 치료사가 센터 의사의 확인을 받아 방문 재활과 센터 수업을 진행합니다.",
  },
];

/** 예전 병원 이름 → 센터 이름 (저장된 체험 데이터 이어받기용) */
export const LEGACY_CENTER_NAMES: Record<string, string> = { "새봄재활의학과": "새봄 연합재활센터" };

export const DEMO_CENTER = CARE_CENTERS[0];
export const centerByName = (name?: string) => CARE_CENTERS.find(c => c.name === name);
/** 치료사 소속 센터. 체험 데이터에서는 모든 치료사가 한 센터에 속합니다. */
export const centerOfProvider = (providerId?: string): CareCenter => { void providerId; return DEMO_CENTER; };
export const doctorLabel = (d: { name: string; title: string }) => `${d.name} (${d.title})`;

/** 체험용 가정값: 치료사 정산 비율 */
export const PROVIDER_SHARE = 0.6;

export const programById = (s: CareState, id?: string) => s.programs.find(p => p.id === id);
export const programsOf = (s: CareState, providerId: string, activeOnly = true) => s.programs.filter(p => p.providerId === providerId && (!activeOnly || p.active));
/** 이용자의 프로그램. 예전 데이터처럼 정해지지 않았으면 담당 치료사의 같은 방식 프로그램을 씁니다. */
export function programFor(s: CareState, p: Patient): Program | undefined {
  return programById(s, p.programId)
    ?? s.programs.find(x => x.providerId === p.providerId && (x.method === "방문") === (p.method !== "센터"))
    ?? s.programs.find(x => x.providerId === p.providerId);
}
/** 다른 장소로 고를 수 있는 제휴 공간 (센터 자체 공간 제외) */
export const otherPlaces = () => PLACES.filter(p => !CARE_CENTERS.some(c => c.placeId === p.id));
/** 프로그램 진행 장소 이름: 자택 방문 / 센터 수업 / 공간 이름 */
export function methodLabel(pg: Pick<Program, "method" | "placeId">) {
  if (pg.method === "방문") return "자택 방문";
  if (pg.method === "센터") return "센터 수업";
  return PLACES.find(x => x.id === pg.placeId)?.name ?? "다른 장소";
}
/** 프로그램의 기본 진행 장소 */
export function programPlace(pg: Program): Place {
  if (pg.method === "방문") return { kind: "자택" };
  if (pg.method === "외부" && pg.placeId) return { kind: "센터", centerId: pg.placeId };
  return { kind: "센터", centerId: (centerByName(pg.center) ?? DEMO_CENTER).placeId };
}
/** 한 회차 금액 (이용권은 1회 환산) */
export const sessionPrice = (pg: Program) => pg.payment === "이용권" && pg.packSessions && pg.packPrice ? Math.round(pg.packPrice / pg.packSessions) : pg.price;
export const paymentLabel = (pg: Program) => pg.payment === "이용권" ? `${pg.packSessions}회 이용권` : "회차별 결제";

/** 의사 확인 기록. 예전 처방 데이터가 있으면 그 내용을 씁니다. */
export function doctorCheckOf(p: Patient): DoctorCheck | undefined {
  if (p.doctorCheck) return p.doctorCheck;
  const rx = p.prescription;
  if (!rx || p.approval?.status !== "승인" && p.status !== "진행 중" && p.status !== "종료") return undefined;
  return { doctor: rx.doctor, at: p.approval?.at ?? rx.startDate, opinion: rx.doctorOpinion ?? "", contraindications: rx.contraindications ?? [], cautions: rx.cautions ?? [] };
}

export const FLOW_STEPS = ["신청", "치료사 수락", "의사 확인", "예약 확정", "진행 중"] as const;
export type FlowStep = "치료사 수락 대기" | "담당 배정 필요" | "의사 확인 대기" | "예약 확정" | "진행 중" | "종료";

export function flowStep(s: CareState, p: Patient): FlowStep {
  if (p.status === "종료") return "종료";
  if (p.status === "배정 대기") {
    const latest = s.assignments.find(a => a.patientId === p.id);
    return latest?.status === "제안" ? "치료사 수락 대기" : "담당 배정 필요";
  }
  if (p.status === "승인 대기") return "의사 확인 대기";
  return p.completed === 0 && !s.records.some(r => r.patientId === p.id && r.confirmed) ? "예약 확정" : "진행 중";
}
/** FLOW_STEPS에서 지금 단계의 위치 (앞 단계는 끝남). 종료는 5 = 모두 끝남 */
export function flowIndex(step: FlowStep) {
  return { "치료사 수락 대기": 1, "담당 배정 필요": 1, "의사 확인 대기": 2, "예약 확정": 3, "진행 중": 4, "종료": 5 }[step];
}
/** 이용자에게 보여 줄 지금 단계 설명 */
export const FLOW_NOTE: Record<FlowStep, string> = {
  "치료사 수락 대기": "치료사가 신청 내용을 확인하고 있어요.",
  "담당 배정 필요": "센터에서 담당 치료사를 정하고 있어요.",
  "의사 확인 대기": "첫 회차 전에 센터 의사가 상태와 주의사항을 확인하고 있어요.",
  "예약 확정": "예약이 확정됐어요. 첫 회차를 기다리고 있어요.",
  "진행 중": "회차가 진행되고 있어요.",
  "종료": "모든 회차가 끝났어요.",
};

/** 결제·이용 회차 현황 */
export function balanceOf(s: CareState, p: Patient) {
  const payments = s.payments.filter(x => x.patientId === p.id && x.status !== "취소").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const paid = payments.filter(x => x.status === "결제 완료");
  const paidSessions = paid.reduce((n, x) => n + x.sessions, 0);
  const used = s.records.filter(r => r.patientId === p.id && r.confirmed && r.attendance !== "미참여").length;
  const pending = payments.filter(x => x.status === "결제 대기");
  return { payments, paid, pending, paidSessions, used, remaining: paidSessions - used, paidAmount: paid.reduce((n, x) => n + x.amount, 0), pendingAmount: pending.reduce((n, x) => n + x.amount, 0) };
}

/** 결제 요청 금액 */
export function paymentFor(pg: Program, kind: Payment["kind"]) {
  return kind === "이용권" && pg.packSessions && pg.packPrice ? { sessions: pg.packSessions, amount: pg.packPrice } : { sessions: 1, amount: pg.price };
}

/** 치료사 정산: 확정된 회차 × 1회 금액 × 정산 비율 (체험용 가정) */
export function settlement(s: CareState, providerId: string, month: string) {
  const patients = new Map(s.patients.map(p => [p.id, p]));
  const rows = s.records.filter((r: CareRecord) => r.confirmed && r.attendance !== "미참여" && r.date.startsWith(month) && (r.authorId ?? patients.get(r.patientId)?.providerId) === providerId).map(r => {
    const p = patients.get(r.patientId)!, pg = p ? programFor(s, p) : undefined;
    const gross = pg ? sessionPrice(pg) : 0;
    return { record: r, patient: p, program: pg, gross, share: Math.round(gross * PROVIDER_SHARE) };
  });
  return { rows, gross: rows.reduce((n, r) => n + r.gross, 0), share: rows.reduce((n, r) => n + r.share, 0) };
}

export const ymd = (iso: string) => iso.slice(0, 10).replaceAll("-", ".");
