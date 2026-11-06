import type { Metadata } from "next";
import { Suspense } from "react";
import { Settlement } from "./Settlement";

export const metadata: Metadata = { title: "치료사 정산" };

export default function Page() {
  return <Suspense><Settlement /></Suspense>;
}
