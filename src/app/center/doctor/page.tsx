import type { Metadata } from "next";
import { Suspense } from "react";
import { DoctorReview } from "./DoctorReview";

export const metadata: Metadata = { title: "의사 확인" };

export default function Page() {
  return <Suspense><DoctorReview /></Suspense>;
}
