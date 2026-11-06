"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToday } from "@/lib/use-today";
import { balanceOf, flowStep, programFor } from "@/lib/center";
import { placeName, upcomingPlace } from "@/lib/places";
import { AdminPage, AdminTable, Badge, Card, FilterBar, dateTime, rowGo, stop } from "../admin-ui";
import { useCenterCare } from "../use-center-care";

type Tab = "전체" | "오늘" | "이번 주" | "기록 누락" | "센터 수업" | "자택 방문";
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** 예약 현황: 확정된 다음 회차. 지난 회차 기록 누락과 센터 수업 시간 겹침을 표시합니다. */
export function Bookings() {
  const { state, patients } = useCenterCare();
  const today = useToday() ?? "", router = useRouter();
  const [tab, setTab] = useState<Tab>("전체");
  const [search, setSearch] = useState({ field: "전체", text: "" });
  const all = patients.filter(p => p.status === "진행 중").sort((a, b) => (a.nextDate + a.nextTime).localeCompare(b.nextDate + b.nextTime));
  const isCenter = (p: (typeof all)[number]) => upcomingPlace(p).kind === "센터";
  const slot = (p: (typeof all)[number]) => `${p.nextDate} ${p.nextTime}`;
  const overlap = (p: (typeof all)[number]) => isCenter(p) && all.filter(o => isCenter(o) && slot(o) === slot(p)).length > 1;
  const late = (p: (typeof all)[number]) => !!today && p.nextDate < today;
  const is: Record<Tab, (p: (typeof all)[number]) => boolean> = { 전체: () => true, 오늘: p => p.nextDate === today, "이번 주": p => p.nextDate >= today && p.nextDate <= addDays(today, 6), "기록 누락": late, "센터 수업": isCenter, "자택 방문": p => !isCenter(p) };
  const searched = all.filter(p => !search.text || (search.field === "회원명" ? p.name : search.field === "치료사" ? p.provider : `${p.name} ${p.provider}`).includes(search.text));
  const rows = searched.filter(is[tab]);
  const go = (id: string) => router.push(`/center/members?view=member&item=${id}`);

  return <AdminPage title="예약 현황" crumbs={["프로그램/예약", "예약 현황"]} desc="의사 확인이 끝나 확정된 회차입니다. 다음 일정은 치료사가 회차 기록을 쓰며 정해요.">
    <FilterBar tabLabel="보기" tabs={(Object.keys(is) as Tab[]).map(t => ({ value: t, count: searched.filter(is[t]).length }))} tab={tab} onTab={setTab} fields={["전체", "회원명", "치료사"]} onSearch={(field, text) => setSearch({ field, text })} />
    <Card flush>
      <AdminTable caption="예약 목록" columns={["번호", "상태", "일시", "회원명", "치료사", { label: "프로그램", align: "l" }, "장소", "회차", "남은 회차", ""]} rows={rows} emptyHint="다른 보기를 눌러 보세요." render={(p, no) => {
        const b = balanceOf(state, p);
        return <tr key={p.id} {...rowGo(() => go(p.id))}>
          <td className="muted">{no}</td>
          <td className="nw">{late(p) ? <Badge>기록 누락</Badge> : overlap(p) ? <Badge>공간 겹침</Badge> : p.nextDate === today ? <Badge tone="green">오늘</Badge> : <Badge>{flowStep(state, p) === "예약 확정" ? "첫 회차" : "예약 확정"}</Badge>}</td>
          <td className="nw">{dateTime(p.nextDate, p.nextTime)}</td><td className="nw"><span className="strong">{p.name}</span></td><td className="nw">{p.provider}</td>
          <td className="l clip" title={programFor(state, p)?.title}>{programFor(state, p)?.title ?? "-"}</td><td className="nw">{placeName(upcomingPlace(p))}</td>
          <td className="nw num">{p.completed + 1}회차</td><td className="nw num">{b.paidSessions ? `${Math.max(0, b.remaining)}회` : <Badge>결제 필요</Badge>}</td>
          <td><button className="ca-act" onClick={stop(() => go(p.id))}>보기</button></td>
        </tr>;
      }} />
    </Card>
  </AdminPage>;
}
