import type { Metadata } from "next";
import { Suspense } from "react";
import { Members } from "./Members";

export const metadata: Metadata = { title: "회원 관리" };

export default function Page() {
  return <Suspense><Members /></Suspense>;
}
