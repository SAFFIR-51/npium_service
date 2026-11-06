import type { Metadata } from "next";
import { Suspense } from "react";
import { Therapists } from "./Therapists";

export const metadata: Metadata = { title: "치료사 관리" };

export default function Page() {
  return <Suspense><Therapists /></Suspense>;
}
