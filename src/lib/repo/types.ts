import type { Place, PlaceKind } from "@/lib/places";

// NPIUM 도메인 타입. 저장 방식(브라우저 체험 데이터 / 서버)과 무관하게 화면이 공유합니다.

export type CareStatus = "배정 대기" | "승인 대기" | "진행 중" | "종료";

export type Patient = {
  id: string;
  name: string;
  age: number;
  sex: string;
  condition: string;
  area: string;
  hospital: string;
  /** 담당 제공자 이름(표시용). 식별은 providerId를 사용합니다. */
  provider: string;
  providerId?: string;
  status: CareStatus;
  goal: string;
  precautions: string;
  completed: number;
  total: number;
  nextDate: string;
  nextTime: string;
  method: string;
  consent: boolean;
  requestedProviderId?: string;
  requestedProviderName?: string;
  applicant?: string;
  /** 이 대상을 관리하는 환자·보호자 계정. (보호자 연결은 실제 서비스에서 별도 승인·유효 기간을 가집니다) */
  guardianAccountId?: string;
  /** 병원·기관의 계획 검토 결과. 승인 담당자·시각·반려 사유를 남깁니다. (기획서 2장) */
  approval?: PlanApproval;
  /** 담당 의사(재활의학과 전문의 등). 병원 연계형에서 치료사는 이 의사의 지도·처방 범위 안에서 방문합니다. */
  doctor?: string;
  /** 의사가 확인한 방문재활 처방: 기간·주간 횟수·치료 범위 */
  prescription?: Prescription;
  activePrescriptionVersionId?: string;
  /** 자택 주소 (담당 치료사·보호자·병원만 열람). 출입 비밀번호 등은 저장하지 않습니다. */
  homeAddress?: string;
  /** 자택 방문 시 참고 (엘리베이터·주차·계단 등) */
  homeAccess?: string;
  /** 기본 방문 장소 (처방에서 정함) */
  place?: Place;
  /** 다음 회차만 바꾼 장소 (보호자 요청 → 치료사 수락). 회차 보고서 확정 후 지워집니다. */
  nextPlace?: Place;
  /** 프로그램 종료 확인 (병원) */
  closure?: { at: string; by: string; summary: string };
  /** 신청한 센터 프로그램 (src/lib/center.ts) */
  programId?: string;
  /** 첫 회차 전 센터 의사 확인. 확인 전에는 예약이 확정되지 않습니다. */
  doctorCheck?: DoctorCheck;
};

/** 센터 의사의 확인·지도 기록. 치료사는 이 범위 안에서 진행합니다. */
export type DoctorCheck = {
  doctor: string;
  at: string;
  opinion: string;
  contraindications: string[];
  cautions: string[];
};

/** 센터가 여는 프로그램. 치료사 한 명이 맡고, 결제 방식은 프로그램마다 고릅니다. */
export type Program = {
  id: string;
  /** 센터 이름 (Patient.hospital과 같은 값) */
  center: string;
  providerId: string;
  title: string;
  /** 자택 방문 / 센터 수업 / 다른 장소(제휴 공간) */
  method: "방문" | "센터" | "외부";
  /** 다른 장소일 때 제휴 공간 id (src/lib/places.ts CENTERS) */
  placeId?: string;
  minutes: number;
  payment: "회차별" | "이용권";
  /** 회차별 금액 */
  price: number;
  /** 이용권 회차 수와 금액 */
  packSessions?: number;
  packPrice?: number;
  active: boolean;
  note?: string;
};

/** 결제. 실제 결제 연동 전이라 결제 완료는 센터·이용자가 표시합니다. */
export type Payment = {
  id: string;
  patientId: string;
  programId: string;
  kind: "회차" | "이용권";
  sessions: number;
  amount: number;
  status: "결제 대기" | "결제 완료" | "취소";
  createdAt: string;
  paidAt?: string;
  method?: string;
  by: string;
};

/** 이용자가 치료사에게 직접 신청할 때 받는 정보 */
export type ApplyInput = {
  name: string;
  age: number;
  sex: string;
  condition: string;
  area: string;
  goal: string;
  precautions: string;
  nextDate: string;
  nextTime: string;
  applicant: string;
  guardianAccountId?: string;
  homeAddress?: string;
  homeAccess?: string;
  consent: boolean;
};

/** 방문재활 처방. 기간·주간 횟수는 병원에서 설정합니다. */
export type Prescription = {
  doctor: string;
  startDate: string;
  endDate: string;
  perWeek: number;
  scope: string[];
  note?: string;
  extendedDays?: number;
  /** 허용 장소 (자택 방문 / 제휴 센터) */
  places?: PlaceKind[];
  /** 진료과 프로토콜 (src/lib/protocols.ts). 고르면 평가 지표·금기·주의사항이 붙습니다. */
  protocolId?: string;
  /** 금기 운동. 프로토콜 기본값에서 병원이 빼거나 직접 추가합니다. */
  contraindications?: string[];
  /** 주의사항 (한 줄에 하나) */
  cautions?: string[];
  /** 주치의 재활 소견 (퇴원 전 연계) */
  doctorOpinion?: string;
  /** 방문재활 동의서 받음 확인 */
  consentChecked?: boolean;
};

/** 지역사회 연계 (병원 사회복지사 → 보건소·통합돌봄 창구 등). 의뢰와 결과를 남깁니다. */
export type Linkage = {
  id: string;
  patientId: string;
  to: string;
  reason: string;
  status: "의뢰" | "연계 완료";
  by: string;
  at: string;
  result?: string;
};

export type PlanApproval = { status: "승인" | "반려"; by: string; at: string; reason?: string };

/** 회차 기록 정정 이력. 확정 후 수정은 덮어쓰지 않고 이전 내용을 보존합니다. */
export type RecordRevision = {
  at: string;
  by: string;
  reason: string;
  content: string;
  next: string;
  walk: string;
  pain: string;
  /** 바뀐 항목 요약 (예: "보행 거리 30m → 32m") */
  changes?: string[];
  /** 정정 직전 보고서 전체 (구조화 항목 포함) */
  snapshot?: Omit<CareRecord, "revisions">;
};

/** 측정값 1건. value가 null이면 "미측정"이며 0과 구분합니다. */
export type Measure = { code: string; value: number | null; note?: string };

/** 회차 보고서. 선생님이 매 회차 작성하고, 쌓인 보고서로 월간 보고와 변화 추이를 만듭니다. */
export type CareRecord = {
  id: string;
  patientId: string;
  date: string;
  title: string;
  /** 진행 내용과 수행 반응 */
  content: string;
  /** 다음 계획 */
  next: string;
  /** (하위 호환) 보행 거리·통증. 새 보고서는 measures를 씁니다. */
  walk: string;
  pain: string;
  confirmed: boolean;
  sessionNo?: number;
  attendance?: "참여" | "부분 참여" | "미참여";
  absenceReason?: string;
  durationMin?: number;
  activities?: string[];
  measures?: Measure[];
  /** 이상 반응·안전 사건. 시각·조치를 남깁니다. (기획서 3장) */
  adverse?: { occurred: boolean; detail?: string; action?: string; reviewedBy?: string; reviewedAt?: string; reviewNote?: string };
  /** 보호자 교육 내용 */
  education?: string;
  /** 실제 진행한 장소 */
  place?: Place;
  /** 병원이 정한 금기 운동을 하지 않았음을 치료사가 확인 */
  contraChecked?: boolean;
  /** 마지막 저장 시각(ISO). */
  updatedAt?: string;
  authorId?: string;
  revisions?: RecordRevision[];
  prescriptionVersionId?: string;
  hospitalAtVisit?: string;
};

/** 월간 경과 보고서. 숫자·회차 기록은 화면에서 자동으로 모으고, 여기에는 치료사가 쓴 부분과 공유 이력만 저장합니다. */
export type Report = {
  id: string;
  patientId: string;
  /** "2026년 10월" */
  period: string;
  shared: boolean;
  /** 종합 소견 (치료사) */
  opinion?: string;
  /** 다음 달 계획 (치료사) */
  plan?: string;
  /** 영역별 판정 덮어쓰기 (자동 판정과 다를 때만) */
  judgments?: Record<string, "개선" | "유지" | "악화">;
  writtenBy?: string;
  writtenAt?: string;
  sharedAt?: string;
  /** 병원 담당의 확인 */
  confirmedBy?: string;
  confirmedAt?: string;
  providedBy?: string;
  providedAt?: string;
  reviewNote?: string;
  snapshot?: { patient: Patient; records: CareRecord[]; assessments: Assessment[]; capturedAt: string };
  version?: number;
  supersedesId?: string;
  supersededById?: string;
  correctionReason?: string;
};

export type Assessment = {
  id: string;
  patientId: string;
  period: string;
  date: string;
  rom: string;
  strength: string;
  walking: string;
  balance: string;
  adl: string;
  environment: string;
  /** 표준 평가 도구 점수 등 (코드·값, null = 미측정) */
  measures?: Measure[];
  /** 관절 가동범위 (관절·좌우·각도). 코드는 src/lib/assessment.ts */
  romItems?: { code: string; side: "좌" | "우"; deg: number | null }[];
  /** 도수근력검사 0~5등급 (근육·좌우) */
  mmtItems?: { code: string; side: "좌" | "우"; grade: number | null }[];
  /** 주거 환경 위험 요소 체크 */
  homeRisks?: string[];
  by?: string;
};

/** 배정 상태는 프로그램 상태와 분리해서 기록합니다. (기획서 1장) */
export type AssignmentStatus = "제안" | "수락" | "거절" | "확정" | "취소";

export type Assignment = {
  id: string;
  patientId: string;
  providerId: string;
  providerName: string;
  status: AssignmentStatus;
  createdAt: string;
  respondedAt?: string;
  reason?: string;
  proposalId?: string;
  by?: string;
  adjustmentReason?: string;
};

/** 전문가 가입 신청. 비밀번호 등 인증 정보는 여기에 저장하지 않습니다(인증 서비스가 따로 보관). */
export type ProviderApplication = {
  id: string;
  createdAt: string;
  license: string;
  programs: string[];
  methods: string[];
  regions: string[];
  licenseNumber: string;
  years: number;
  insurance: "가입" | "준비 중";
  documentName?: string;
  name: string;
  phone: string;
  email: string;
  marketing: boolean;
  status: "검수 대기" | "승인" | "반려";
  reviewedAt?: string;
  reviewNote?: string;
};

/** 채팅 메시지. threadId 규칙은 src/lib/chat.ts 참고. 건강 정보는 필요한 범위에서만 주고받습니다. */
export type ChatMessage = {
  id: string;
  threadId: string;
  senderKey: string;
  senderName: string;
  text: string;
  at: string;
  /** 읽은 계정 키 목록 */
  readBy: string[];
};

/** 일정 변경·참여 어려움 요청. 바로 바뀌지 않고 담당 전문가가 확인해 확정합니다. 취소·미참여 사유는 따로 남깁니다. (기획서 1·3장) */
export type ScheduleRequest = {
  id: string;
  patientId: string;
  kind: "변경" | "참여 어려움";
  date?: string;
  time?: string;
  reason: string;
  status: "요청" | "확정" | "조정 필요" | "취소";
  /** 장소 변경 요청 (다음 회차만) */
  place?: Place;
  createdAt: string;
  by: string;
  respondedAt?: string;
  response?: string;
};

export type CareState = {
  demo?: boolean;
  providerControlHistory?: ProviderControl[];
  patients: Patient[];
  records: CareRecord[];
  reports: Report[];
  homeTasks: string[];
  assessments: Assessment[];
  assignments: Assignment[];
  applications: ProviderApplication[];
  messages: ChatMessage[];
  scheduleRequests: ScheduleRequest[];
  linkages: Linkage[];
  /** NPIUM ↔ 병원 이용 계약 (수수료 기준) */
  contracts: Contract[];
  /** 기관·월별 청구 상태. 키: `${기관}|${YYYY-MM}` */
  billing: Record<string, BillingEntry>;
  /** 문의(운영팀 문의방) 처리 상태. 키: 채팅 threadId */
  inquiries: Record<string, InquiryMeta>;
  reevaluations: Reevaluation[];
  prescriptionDrafts: PrescriptionDraft[];
  prescriptionVersions: PrescriptionVersion[];
  prescriptionAcknowledgments: PrescriptionAcknowledgment[];
  providerControls: Record<string, ProviderControl>;
  registeredProviders: RegisteredProvider[];
  qualityReviews: QualityReview[];
  satisfactions: Satisfaction[];
  hospitalReviews: HospitalReview[];
  /** 센터 프로그램 */
  programs: Program[];
  /** 결제 내역 */
  payments: Payment[];
};

/** 병원 이용 계약. 회차당 수수료(확정된 방문 회차 × 단가) 또는 월 정액. */
export type Contract = { organization: string; model: "회차당" | "월 정액"; unitFee: number; monthlyFee: number; since: string; manager: string };
export type BillingEntry = { status: "청구 전" | "청구 완료" | "입금 완료"; issuedAt?: string; paidAt?: string; memo?: string; snapshot?: BillingSnapshot; adjustments?: BillingAdjustment[] };
export type BillingSnapshot = { contract: Contract; recordIds: string[]; sourceSignature: string; visits: number; supply: number; vat: number; total: number; capturedAt: string };
export type BillingAdjustment = { id: string; amount: number; reason: string; by: string; at: string };
export type Reevaluation = { id: string; patientId: string; reportId: string; date: string; opinion: string; contraindications: string[]; cautions: string[]; decision: "기존 승인 유지" | "변경안 검토" | "추가 확인 필요"; by: string; at: string };
export type PrescriptionDraft = { id: string; patientId: string; prescription: Prescription; precautions: string; effectiveFrom: string; baseVersionId?: string; baseSignature: string; reportId?: string; reevaluationId?: string; by: string; at: string; status: "작성 중" | "승인"; revision: number };
export type PrescriptionVersion = { id: string; patientId: string; version: number; prescription: Prescription; precautions: string; effectiveFrom: string; by: string; at: string; reportId?: string; reevaluationId?: string; draftId?: string };
export type PrescriptionAcknowledgment = { id: string; patientId: string; versionId: string; providerId: string; by: string; at: string };
export const PROVIDER_CHECKS = ["면허 인증", "경력 검증", "범죄·사고 이력 확인", "보험 가입 확인"] as const;
export type ProviderCheck = (typeof PROVIDER_CHECKS)[number];
export type ProviderControl = { providerId: string; checks: Partial<Record<ProviderCheck, { confirmed: boolean; reference: string }>>; insuranceUntil: string; grade: "미지정" | "Junior" | "Senior" | "Specialist" | "VIP 전담"; hold: boolean; reason: string; by: string; at: string };
export type RegisteredProvider = { id: string; name: string; license: string; years: number; focus: string[]; visit: string[]; area: string; applicationId: string };
export type QualityReview = { id: string; providerId: string; month: string; findings: string; action: "활동 유지" | "보완 요청" | "배정 보류"; by: string; at: string };
export type Satisfaction = { id: string; patientId: string; providerId: string; month: string; score: number; maxScore: number; note: string; by: string; at: string };
export type HospitalReview = { id: string; hospital: string; month: string; findings: string; action: string; followUp: string; by: string; at: string };
export type InquiryMeta = { status: "접수" | "처리 중" | "완료"; category: string; assignee?: string; memo?: string; updatedAt: string };

export type ProviderRef = { id: string; name: string };

export type RecordInput = Pick<CareRecord, "content" | "next" | "walk" | "pain"> &
  Partial<Pick<CareRecord, "attendance" | "absenceReason" | "durationMin" | "activities" | "measures" | "adverse" | "education" | "place" | "contraChecked">> & {
    id?: string;
    /** 진행일 (기본: 오늘) */
    date?: string;
    /** 확정할 때 함께 정하는 다음 일정 */
    nextDate?: string;
    nextTime?: string;
  };

/**
 * 화면이 사용하는 데이터 접근 계약.
 * 지금은 브라우저 체험 구현(local-repository)만 있고, 서버 구현은 같은 계약으로 추가합니다.
 * 서버 구현에서는 각 명령마다 역할·소속·담당 관계를 서버에서 다시 검증해야 합니다. (기획서 5장)
 */
export interface CareRepository {
  getSnapshot(): CareState;
  getServerSnapshot(): CareState;
  subscribe(listener: () => void): () => void;

  addPatient(patient: Patient): void;
  changePatient(id: string, patch: Partial<Patient>): void;

  /** 운영자가 제공자에게 배정을 제안합니다. 제공자가 수락해야 담당이 됩니다. */
  proposeAssignment(patientId: string, provider: ProviderRef, reason?: string, by?: string): boolean;
  acceptAssignment(patientId: string, provider: ProviderRef): void;
  declineAssignment(patientId: string, provider: ProviderRef, reason: string): void;
  finalizeAssignment(patientId: string, expectedAssignmentId: string, by: string): boolean;
  cancelAssignment(patientId: string, expectedAssignmentId: string, by: string, reason: string): boolean;

  /** 병원·기관의 계획 승인. 승인되면 프로그램이 진행 중이 됩니다. */
  approvePlan(patientId: string, by: string, precautions: string, prescription?: Prescription): void;
  /** 기존 호환용 기간 변경. 새 화면은 변경안 승인 절차를 사용합니다. */
  extendPrescription(patientId: string, days: number, by: string): void;
  /** 담당 의사가 이상 반응 기록을 확인합니다. */
  reviewAdverse(recordId: string, by: string, note: string): void;
  /** 종료 평가 후 병원이 프로그램 종료를 확인합니다. */
  closeProgram(patientId: string, by: string, summary: string): void;
  addLinkage(linkage: Omit<Linkage, "id" | "status" | "at">): void;
  completeLinkage(id: string, result: string): void;
  setContract(organization: string, patch: Partial<Contract>): void;
  setBilling(key: string, patch: Partial<BillingEntry>): void;
  setInquiry(threadId: string, patch: Partial<InquiryMeta>): void;
  /** 계획 반려(보완 요청). 상태는 승인 대기로 두고 사유를 제공자에게 전달합니다. */
  rejectPlan(patientId: string, by: string, reason: string): void;

  /** 임시 저장 또는 확정. 반환값은 저장된 기록 id. */
  saveRecord(patientId: string, input: RecordInput, options: { confirm: boolean; author?: ProviderRef }): string;
  /** 확정된 기록 정정. 이전 내용은 revisions에 남습니다. */
  correctRecord(recordId: string, input: Omit<RecordInput, "id">, reason: string, author: ProviderRef): void;

  /** 전문가 가입 신청 접수. 운영자 검수 후 활동할 수 있습니다. (기획서 3장 제공자 관리) */
  submitApplication(application: Omit<ProviderApplication, "id" | "createdAt" | "status">): string;
  reviewApplication(id: string, status: "승인" | "반려", note?: string): void;

  requestSchedule(request: Omit<ScheduleRequest, "id" | "status" | "createdAt">): void;
  /** 담당 전문가 응답. 변경 요청을 확정하면 다음 일정이 바뀝니다. */
  respondSchedule(id: string, status: "확정" | "조정 필요", response?: string): void;
  /** 확인 전 요청을 보낸 사람이 취소합니다. */
  cancelScheduleRequest(id: string): void;

  sendMessage(threadId: string, sender: { key: string; name: string }, text: string): void;
  markThreadRead(threadId: string, readerKey: string): void;

  addAssessment(assessment: Omit<Assessment, "id">): void;
  shareReport(patientId: string, period: string): void;
  /** 월간 보고서의 치료사 작성 부분 저장 (share=true면 확정·공유) */
  saveReport(patientId: string, period: string, fields: Pick<Report, "opinion" | "plan" | "judgments" | "writtenBy">, share: boolean): void;
  /** 병원 담당의가 공유된 보고서를 확인 */
  confirmReport(patientId: string, period: string, by: string): void;
  provideReport(patientId: string, month: string, by: string, note: string, reviewedSignature?: string): boolean;
  reviseReport(reportId: string, reason: string, by: string): boolean;
  confirmReportVersion(reportId: string, by: string): boolean;
  saveReevaluation(input: Omit<Reevaluation, "id" | "at">): string;
  savePrescriptionDraft(input: Omit<PrescriptionDraft, "id" | "at" | "baseSignature" | "baseVersionId" | "status" | "revision">, expectedBaseSignature?: string): string;
  approvePrescriptionDraft(id: string, revision: number, by: string): boolean;
  acknowledgePrescription(patientId: string, versionId: string, provider: ProviderRef): boolean;
  setProviderControl(control: Omit<ProviderControl, "at">): boolean;
  saveQualityReview(input: Omit<QualityReview, "id" | "at">): boolean;
  saveSatisfaction(input: Omit<Satisfaction, "id" | "at">): boolean;
  saveHospitalReview(input: Omit<HospitalReview, "id" | "at">): boolean;
  adjustBilling(key: string, amount: number, reason: string, by: string): boolean;
  toggleHomeTask(taskId: string): void;

  // ── 센터 관리 (1차) ──
  /** 이용자가 치료사의 프로그램에 신청합니다. 반환값은 새 이용자 id. */
  applyToProvider(input: ApplyInput, providerId: string, programId: string): string;
  /** 치료사가 신청을 수락하면 담당이 되고, 센터 의사 확인 단계로 넘어갑니다. */
  acceptRequest(patientId: string, provider: ProviderRef): boolean;
  /** 센터 의사가 첫 회차 전에 확인합니다. 확인되면 예약이 확정되고 결제 요청이 만들어집니다. */
  confirmByDoctor(patientId: string, check: Omit<DoctorCheck, "at">, firstDate: string, firstTime: string): boolean;
  /** 센터가 담당 치료사를 바꿉니다. */
  changeProvider(patientId: string, provider: ProviderRef, reason: string, by: string): boolean;
  saveProgram(program: Program): boolean;
  /** 결제 요청을 만듭니다 (다음 이용권·회차). */
  requestPayment(patientId: string, programId: string, kind: Payment["kind"], by: string): string;
  /** 결제 완료 표시 (현장 결제 또는 이용자 결제) */
  markPaid(paymentId: string, method: string): boolean;

  reset(): void;
  /** 하위 호환용 저수준 갱신. 새 코드는 위 명령을 사용합니다. */
  update(fn: (state: CareState) => CareState): void;
}
