"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useRole } from "@/lib/demo-session";
import { ROLE_INFO } from "@/lib/session";

/** 전문가·병원·운영자는 공개 홈 대신 자기 업무 화면에서 시작합니다. */
export function WorkRoleRedirect() {
  const role = useRole();
  const router = useRouter();
  useEffect(() => {
    if (role === "provider" || role === "center" || role === "hospital" || role === "admin") router.replace(ROLE_INFO[role].home);
  }, [role, router]);
  return null;
}
