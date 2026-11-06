import type { Metadata } from "next";
import { Suspense } from "react";
import { Billing } from "./Billing";

export const metadata: Metadata = { title: "결제 내역" };

export default function Page() {
  return <Suspense><Billing /></Suspense>;
}
