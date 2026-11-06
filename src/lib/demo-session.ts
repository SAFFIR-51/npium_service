"use client";
import { useAccount, getAccount } from "./auth-client";
import { useCare } from "./repo";
import { allProviders } from "./workflow";
import { DEMO_ACCOUNTS } from "./session";
import { useSyncExternalStore } from "react";
import { DEMO_MODE, demoProvider, type Role } from "./session";

/**
 * 체험 모드의 "로그인한 역할". 브라우저에만 저장되며 실제 인증이 아닙니다.
 * 인증 연결 후에는 서버 세션의 역할로 교체하고, src/proxy.ts에서 역할별 경로를 막습니다.
 */
const KEY = "npium-demo-role";
const LEGACY_KEY = "nopium-demo-role";
const roles: Role[] = ["guest", "patient", "provider", "center", "hospital", "admin"];
const listeners = new Set<() => void>();

function read(): Role {
  if (!DEMO_MODE) return "guest";
  try {
    const v = (localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY)) as Role | null;
    return v && roles.includes(v) ? v : "guest";
  } catch {
    return "guest";
  }
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** 현재 역할. 사전 렌더링 중에는 null(아직 모름)을 돌려줍니다. */
export function useRole(): Role | null {
  const account = useAccount();
  const demoRole = useSyncExternalStore(subscribe, read, () => null);
  return DEMO_MODE ? demoRole : account === undefined ? null : account?.role ?? "guest";
}

export function setDemoRole(role: Role) {
  try {
    localStorage.setItem(KEY, role);
  } catch {
    /* 저장소를 쓸 수 없으면 이번 화면에서만 유지됩니다. */
  }
  listeners.forEach(l => l());
}

/** 현재 로그인한 제공자. 체험 모드에서는 예시 제공자를 돌려줍니다. */
export function useCurrentProvider() {
  const account = useAccount(), state = useCare();
  const p = allProviders(state).find(p => p.id === account?.providerId);
  return DEMO_MODE ? demoProvider() : p ? { ...p, hospital: "hospital" in p ? p.hospital : undefined, slots: "slots" in p ? p.slots : "등록된 일정 확인" } : null;
}

export function useActor() { const account = useAccount(); const role = useRole(); return DEMO_MODE ? { id: role === "provider" ? DEMO_ACCOUNTS.provider.id : role === "center" ? DEMO_ACCOUNTS.center.id : role === "hospital" ? DEMO_ACCOUNTS.hospital.id : role === "admin" ? DEMO_ACCOUNTS.admin.id : DEMO_ACCOUNTS.patient.id, name: role === "center" ? DEMO_ACCOUNTS.center.name : role === "hospital" ? DEMO_ACCOUNTS.hospital.name : role === "admin" ? DEMO_ACCOUNTS.admin.name : role === "provider" ? demoProvider()?.name ?? "치료사" : DEMO_ACCOUNTS.patient.name, organization: role === "center" ? DEMO_ACCOUNTS.center.organization : role === "hospital" ? DEMO_ACCOUNTS.hospital.organization : "" } : { id: account?.id ?? "", name: account?.name ?? "", organization: account?.organization ?? "" }; }
/** 센터 계정 (센터 직원 = 의사) */
export function useCenterAccount() { const actor = useActor(); return DEMO_MODE ? DEMO_ACCOUNTS.center : { ...actor, title: "센터 의사" }; }
export function useHospitalAccount() { const actor = useActor(); return DEMO_MODE ? DEMO_ACCOUNTS.hospital : { ...actor, title: "병원 담당자", doctors: [actor.name], socialWorker: actor.name }; }
export function usePatientAccount() { const actor = useActor(); return DEMO_MODE ? DEMO_ACCOUNTS.patient : { ...actor, relation: "환자·보호자" }; }
export { getAccount };
