import type { Metadata } from "next";
import { CenterHome } from "./CenterHome";

export const metadata: Metadata = { title: "센터 홈" };

export default function CenterPage() {
  return <CenterHome />;
}
