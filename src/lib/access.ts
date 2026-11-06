import type { CareState, Patient } from "@/lib/repo";
import { DEMO_ACCOUNTS, DEMO_MODE, type Role } from "@/lib/session";

/**
 * 역할별 열람 범위 (기획서 5장).
 * 지금은 화면에서만 거르는 체험 구현입니다. 서버 구현에서는 같은 규칙을 모든 조회·수정 요청에서 서버가 검증해야 합니다.
 * - 환자·보호자: 연결된 대상만
 * - 제공자: 담당(또는 배정 요청받은) 대상만 → expert/use-provider-care.ts
 * - 병원·기관: 소속 기관의 연계 대상만 (기관 간 자동 공유 없음)
 * - 운영자: 운영 정보 전체
 */
export function visiblePatients(state: CareState, role: Role | null): Patient[] {
  if (!DEMO_MODE) return role && role !== "guest" ? state.patients : [];
  switch (role) {
    case "patient":
      return state.patients.filter(p => p.guardianAccountId === DEMO_ACCOUNTS.patient.id);
    case "center":
      return state.patients.filter(p => p.hospital === DEMO_ACCOUNTS.center.organization);
    case "hospital":
      return state.patients.filter(p => p.hospital === DEMO_ACCOUNTS.hospital.organization);
    case "admin":
      return state.patients;
    default:
      return [];
  }
}
