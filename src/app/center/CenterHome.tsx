"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { won } from "@/lib/data";
import { useToday } from "@/lib/use-today";
import { balanceOf, flowStep, programFor, ymd } from "@/lib/center";
import { placeName, upcomingPlace } from "@/lib/places";
import { AdminPage, AdminTable, Badge, Card, Kpi, Kpis, dateTime, rowGo, stop } from "./admin-ui";
import { useCenterCare } from "./use-center-care";

const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
type Task = { key: string; kind: string; who: string; text: string; at: string; href: string; label: string; order: number };

/** 센터 홈: 숫자 요약 → 지금 할 일(급한 순) → 이번 주 예약 */
export function CenterHome() {
  const { state, me, patients, payments } = useCenterCare();
  const today = useToday(), router = useRouter();
  const step = (id: string) => flowStep(state, patients.find(p => p.id === id)!);
  const latest = (id: string) => state.assignments.find(a => a.patientId === id);
  const waitingProvider = patients.filter(p => step(p.id) === "치료사 수락 대기");
  const assign = patients.filter(p => step(p.id) === "담당 배정 필요");
  const doctor = patients.filter(p => step(p.id) === "의사 확인 대기");
  const pending = payments.filter(x => x.status === "결제 대기");
  const weekEnd = today ? addDays(today, 6) : "";
  const week = today ? patients.filter(p => p.status === "진행 중" && p.nextDate >= today && p.nextDate <= weekEnd).sort((a, b) => (a.nextDate + a.nextTime).localeCompare(b.nextDate + b.nextTime)) : [];
  const todayCount = week.filter(p => p.nextDate === today).length;
  const late = today ? patients.filter(p => p.status === "진행 중" && p.nextDate < today) : [];
  const nameOf = (id: string) => patients.find(p => p.id === id)?.name ?? "";
  const member = (id: string) => `/center/members?view=member&item=${id}`;

  const tasks: Task[] = [
    ...doctor.map(p => ({ key: `d-${p.id}`, kind: "의사 확인 필요", who: p.name, text: `${p.provider} 치료사 수락 · ${programFor(state, p)?.title ?? p.condition}`, at: latest(p.id)?.createdAt ?? p.nextDate, href: `/center/doctor?view=check&item=${p.id}`, label: "확인하기", order: 0 })),
    ...assign.map(p => ({ key: `a-${p.id}`, kind: "담당 배정 필요", who: p.name, text: `${p.condition}${latest(p.id)?.status === "거절" ? ` · ${latest(p.id)?.providerName} 치료사 거절` : ""}`, at: latest(p.id)?.createdAt ?? p.nextDate, href: member(p.id), label: "배정하기", order: 1 })),
    ...late.map(p => ({ key: `l-${p.id}`, kind: "회차 기록 누락", who: p.name, text: `${dateTime(p.nextDate, p.nextTime)} 회차 기록 없음 · ${p.provider} 치료사`, at: p.nextDate, href: member(p.id), label: "보기", order: 2 })),
    ...pending.map(x => ({ key: `p-${x.id}`, kind: "결제 대기", who: nameOf(x.patientId), text: `${won(x.amount)} · ${x.kind === "이용권" ? `${x.sessions}회 이용권` : "1회"}`, at: x.createdAt, href: "/center/billing", label: "결제 확인", order: 3 })),
  ].sort((a, b) => a.order - b.order || a.at.localeCompare(b.at));

  return <AdminPage title="센터 홈" crumbs={["센터 현황"]} desc={today ? `${dateTime(today)} · ${me.name} 의사님, 오늘 처리할 일이 ${tasks.length}건 있어요.` : undefined}>
    <Kpis>
      <Kpi label="의사 확인 대기" value={doctor.length} unit="건" note="첫 회차 전 확인이 필요해요" tone={doctor.length ? "red" : undefined} href="/center/doctor" />
      <Kpi label="치료사 수락 대기" value={waitingProvider.length} unit="건" note={assign.length ? `담당 배정 필요 ${assign.length}건` : "새 신청"} tone={assign.length ? "amber" : undefined} href="/center/members" />
      <Kpi label="이번 주 예약" value={week.length} unit="건" note={`오늘 ${todayCount}건`} tone="green" href="/center/bookings" />
      <Kpi label="결제 대기" value={won(pending.reduce((n, x) => n + x.amount, 0)).replace("원", "")} unit="원" note={`${pending.length}건`} tone={pending.length ? "amber" : undefined} href="/center/billing" />
    </Kpis>

    <Card title="지금 할 일" sub="급한 순서" flush>
      <AdminTable caption="지금 할 일" bar={false} columns={["구분", "회원명", { label: "내용", align: "l" }, "요청일", "처리"]} rows={tasks} empty="지금 처리할 일이 없어요." emptyHint="새 신청이나 결제가 생기면 여기에 보여요." render={t => <tr key={t.key} {...rowGo(() => router.push(t.href))}>
        <td className="nw"><Badge>{t.kind}</Badge></td><td className="nw"><span className="strong">{t.who}</span></td><td className="l">{t.text}</td><td className="nw muted">{ymd(t.at)}</td>
        <td><Link className="ca-act" href={t.href} onClick={e => e.stopPropagation()}>{t.label}</Link></td>
      </tr>} />
    </Card>

    <Card title="이번 주 예약" sub={`${week.length}건`} flush action={<Link className="ca-btn sm" href="/center/bookings">전체 예약 보기</Link>}>
      <AdminTable caption="이번 주 예약" bar={false} columns={["일시", "회원명", "치료사", "장소", "남은 회차", ""]} rows={week} empty="이번 주 예약이 없어요." render={p => { const b = balanceOf(state, p); return <tr key={p.id} {...rowGo(() => router.push(member(p.id)))}>
        <td className="nw">{p.nextDate === today ? <Badge tone="green">오늘</Badge> : null} {dateTime(p.nextDate, p.nextTime)}</td><td className="nw"><span className="strong">{p.name}</span></td><td className="nw">{p.provider}</td><td className="nw">{placeName(upcomingPlace(p))}</td>
        <td className="nw">{b.paidSessions ? `${Math.max(0, b.remaining)}회` : <Badge>결제 필요</Badge>}</td>
        <td><button className="ca-act blue" onClick={stop(() => router.push(member(p.id)))}>보기</button></td>
      </tr>; }} />
    </Card>
  </AdminPage>;
}
