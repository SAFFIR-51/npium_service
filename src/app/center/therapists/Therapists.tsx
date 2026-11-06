"use client";
import Link from "next/link";
import { useState } from "react";
import { won } from "@/lib/data";
import { useToday } from "@/lib/use-today";
import { programsOf, settlement } from "@/lib/center";
import { AdminPage, AdminTable, Badge, Card, FilterBar } from "../admin-ui";
import { useCenterCare } from "../use-center-care";

/** 치료사 관리: 소속 치료사(한 센터에만 소속). 면허·경력 확인과 채용은 센터가 합니다. */
export function Therapists() {
  const { state, center, providers, patients } = useCenterCare();
  const today = useToday();
  const month = (today ?? "").slice(0, 7);
  const [search, setSearch] = useState({ field: "전체", text: "" });
  const offers = (id: string) => patients.filter(p => { const a = state.assignments.find(x => x.patientId === p.id); return a?.status === "제안" && a.providerId === id; }).length;
  const rows = providers.filter(e => !search.text || (search.field === "이름" ? e.name : search.field === "분야" ? e.focus.join(" ") : `${e.name} ${e.focus.join(" ")} ${e.license}`).includes(search.text));

  return <AdminPage title="치료사 관리" crumbs={["프로그램/예약", "치료사 관리"]} desc={`${center.name} 소속 치료사 ${providers.length}명 · 치료사는 한 센터에만 소속되고, 면허·경력 확인과 채용은 센터가 합니다.`}>
    <FilterBar fields={["전체", "이름", "분야"]} onSearch={(field, text) => setSearch({ field, text })} />
    <Card flush>
      <AdminTable caption="소속 치료사" columns={["번호", "이름", "자격·경력", { label: "분야", align: "l" }, "진행 방식", "프로그램", "새 신청", "진행 중", "이번 달 회차", { label: "정산 예정", align: "r" }, ""]} rows={rows} render={(e, no) => {
        const pay = today ? settlement(state, e.id, month) : null, n = offers(e.id);
        return <tr key={e.id}>
          <td className="muted">{no}</td><td className="nw"><span className="strong">{e.name}</span></td><td className="nw">{e.license}<small>경력 {e.years}년</small></td>
          <td className="l clip" title={e.focus.join(", ")}>{e.focus.join(", ")}</td><td className="nw">{e.visit.filter(v => v !== "비대면 점검").join(" · ")}</td>
          <td className="num">{programsOf(state, e.id).length}개</td><td>{n ? <Badge>{`수락 대기 ${n}`}</Badge> : <span className="muted">-</span>}</td>
          <td className="num">{patients.filter(p => p.providerId === e.id && p.status === "진행 중").length}명</td><td className="num">{pay?.rows.length ?? 0}회</td><td className="r nw">{won(pay?.share ?? 0)}</td>
          <td><Link className="ca-act blue" href={`/experts/${e.id}`}>프로필</Link></td>
        </tr>;
      }} />
    </Card>
    <p className="ca-hint">정산 예정 금액은 체험용 가정값(회차 금액의 60%)이에요.</p>
  </AdminPage>;
}
