import type { Metadata } from "next";
import { ProviderHome } from "./ProviderHome";

export const metadata: Metadata = { title: "내 관리" };

// 1차: 단순한 치료사 홈. 예전 홈(TodayView.tsx)은 파일만 남겨 두었습니다.
export default function ExpertTodayPage() {
  return <ProviderHome />;
}
