"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ApplyForm } from "./ApplyForm";
import "@/components/center-ui.css";

/**
 * 1차: 신청은 치료사 프로필에서 시작합니다 (/request?expert=…&program=…).
 * 예전 단계형 신청(RequestFlow.tsx)은 화면에서 숨기고 파일만 남겨 두었습니다.
 */
export default function RequestEntry() {
  const params = useSearchParams();
  const expertId = params.get("expert");
  if (!expertId) return <div className="cx-page"><h1>치료사를 먼저 골라 주세요</h1><p className="cx-lead">치료사 프로필에서 원하는 프로그램을 골라 신청할 수 있어요.</p><Link className="cx-btn primary" href="/experts">치료사 찾기</Link></div>;
  return <ApplyForm key={expertId} expertId={expertId} programId={params.get("program") ?? undefined} />;
}
