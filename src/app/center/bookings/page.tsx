import type { Metadata } from "next";
import { Suspense } from "react";
import { Bookings } from "./Bookings";

export const metadata: Metadata = { title: "예약 현황" };

export default function Page() {
  return <Suspense><Bookings /></Suspense>;
}
