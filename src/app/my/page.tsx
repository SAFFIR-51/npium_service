import type { Metadata } from "next";
import { MyHome } from "./MyHome";

export const metadata: Metadata = { title: "내 관리" };

// 1차: 단순한 내 관리 홈. 예전 홈(MyOverview.tsx)은 파일만 남겨 두었습니다.
export default function MyPage() {
  return <MyHome />;
}
