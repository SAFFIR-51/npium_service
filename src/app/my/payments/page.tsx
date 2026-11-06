import type { Metadata } from "next";
import { Suspense } from "react";
import { MyPayments } from "./MyPayments";

export const metadata: Metadata = { title: "결제 내역" };

export default function MyPaymentsPage() {
  return <Suspense><MyPayments /></Suspense>;
}
