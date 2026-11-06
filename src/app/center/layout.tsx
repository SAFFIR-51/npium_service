import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CenterShell } from "./CenterShell";

export const metadata: Metadata = { title: { template: "%s | 센터 · NPIUM", default: "센터 | NPIUM" } };

export default function CenterLayout({ children }: { children: ReactNode }) {
  return <CenterShell>{children}</CenterShell>;
}
