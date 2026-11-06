import { experts, type Expert } from "@/lib/data";

/**
 * 개발·체험 모드. 기본값은 켜짐이며, 운영 배포에서는 NEXT_PUBLIC_DEMO_MODE=false 로 끕니다.
 * 켜져 있으면 역할 선택과 체험 데이터 안내가 보이고, 고른 역할의 예시 계정으로 로그인한 것처럼 동작합니다.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";

/** hospital·admin은 1차 화면에서 숨긴 예전 역할입니다. 병원·기관은 center(센터)로 합쳤습니다. */
export type Role = "guest" | "patient" | "provider" | "center" | "hospital" | "admin";
export type WorkRole = Exclude<Role, "guest">;

export const ROLE_INFO: Record<Role, { label: string; home: string; text: string }> = {
  guest: { label: "일반 이용자", home: "/", text: "로그인 전 서비스 둘러보기" },
  patient: { label: "환자·보호자", home: "/my", text: "일정과 관리 기록 확인" },
  provider: { label: "프로그램 제공자", home: "/expert", text: "신청 수락과 회차 기록" },
  center: { label: "병원·기관", home: "/center", text: "센터 관리자 화면 · 회원·의사 확인·프로그램·결제" },
  hospital: { label: "병원·기관", home: "/hospital", text: "연계·승인·보고 확인" },
  admin: { label: "운영 관리자", home: "/admin", text: "수수료·진행 현황·문의 관리" },
};

/** 체험 모드에서 쓰는 예시 계정. 인증이 연결되면 세션 정보로 교체합니다. */
export const DEMO_ACCOUNTS = {
  patient: { id: "demo-guardian", name: "김지은", relation: "보호자" },
  provider: { id: "park" },
  hospital: { id: "demo-hospital", name: "이하늘", title: "연계 코디네이터", organization: "새봄 연합재활센터", doctors: ["정윤호 (재활의학과 전문의)", "김서진 (재활의학과 전문의)"], socialWorker: "오미래 (의료사회복지사)" },
  admin: { id: "demo-admin", name: "NPIUM 운영팀" },
  /** 센터 직원 = 의사 */
  center: { id: "demo-center", name: "정윤호", title: "재활의학과 전문의", organization: "새봄 연합재활센터" },
} as const;

/** 체험 모드에서 사용할 예시 제공자 id. */
/** 체험 역할 선택에 보이는 역할 (1차) */
export const DEMO_ROLES: Role[] = ["guest", "patient", "provider", "center"];

export const DEMO_PROVIDER_ID = DEMO_ACCOUNTS.provider.id;

export function demoProvider(): Expert | null {
  return experts.find(e => e.id === DEMO_PROVIDER_ID) ?? null;
}
