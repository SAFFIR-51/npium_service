import type { Metadata } from "next";
import { Suspense } from "react";
import { Programs } from "./Programs";

export const metadata: Metadata = { title: "프로그램 관리" };

export default function Page() {
  return <Suspense><Programs /></Suspense>;
}
