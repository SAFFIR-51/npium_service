"use client";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { PlaceInfo } from "@/components/PlaceInfo";
import { SessionReportForm } from "@/components/SessionReportForm";
import { placeName } from "@/lib/places";
import { programStage } from "@/lib/program";
import { flowStep } from "@/lib/center";
import type { Patient } from "@/lib/repo";
import { useToday } from "@/lib/use-today";
import { ExpertSubHeader } from "../ExpertShell";
import { useProviderCare } from "../use-provider-care";

type Kind = "예정" | "완료" | "작성 중" | "보고서 미작성" | "변경 요청" | "처방 종료";
type Ev = { key: string; date: string; time?: string; kind: Kind; patient: Patient; text: string };

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const md = (s: string) => `${Number(s.slice(5, 7))}월 ${Number(s.slice(8, 10))}일`;
const tone: Record<Kind, string> = { "예정": "plan", "완료": "done", "작성 중": "draft", "보고서 미작성": "warn", "변경 요청": "req", "처방 종료": "end" };

/**
 * 전문가 일정표: 한 달 달력 + 고른 날의 회차 목록.
 * 다음 방문(확정 일정)·진행한 회차(보고서)·보호자 변경 요청·처방 종료일을 한곳에서 봅니다.
 * 이후 회차는 다음 방문이 끝나고 보고서에서 정하므로, 아직 정하지 않은 회차는 만들어 보여 주지 않습니다.
 */
export function ScheduleView() {
  const data = useProviderCare();
  const today = useToday();
  const [cursor, setCursor] = useState<{ y: number; m: number } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [record, setRecord] = useState<{ patient: Patient; date?: string } | null>(null);
  if (!data) return null;
  if (!today) return <div className="sg sg-work my-home my-sub-view"><ExpertSubHeader title="일정표" subtitle="일정을 불러오고 있어요." /></div>;

  const y = cursor?.y ?? Number(today.slice(0, 4));
  const m = cursor?.m ?? Number(today.slice(5, 7)) - 1;
  const day = picked ?? today;
  const myIds = new Set(data.patients.map(p => p.id));
  const byId = (id: string) => data.patients.find(p => p.id === id)!;

  const events: Ev[] = [];
  for (const r of data.state.records.filter(r => myIds.has(r.patientId))) {
    events.push({ key: r.id, date: r.date, kind: r.confirmed ? "완료" : "작성 중", patient: byId(r.patientId), text: `${r.sessionNo ? `${r.sessionNo}회차` : r.title}${r.attendance ? ` · ${r.attendance}` : ""}${r.durationMin ? ` · ${r.durationMin}분` : ""}${r.place ? ` · ${placeName(r.place)}` : ""}` });
  }
  for (const p of data.patients.filter(p => p.status === "진행 중")) {
    const done = data.state.records.some(r => r.patientId === p.id && r.date === p.nextDate);
    if (!done) events.push({ key: `n-${p.id}`, date: p.nextDate, time: p.nextTime, kind: p.nextDate < today ? "보고서 미작성" : "예정", patient: p, text: `${p.completed + 1}회차 · ${flowStep(data.state, p) === "예약 확정" ? "첫 회차" : "진행 중"}${p.nextPlace ? " · 장소 변경" : ""}` });
    if (p.prescription && p.status === "진행 중") events.push({ key: `e-${p.id}`, date: p.prescription.endDate, kind: "처방 종료", patient: p, text: `${p.doctor?.split(" ")[0] ?? "담당 의사"} 처방 마지막 날 · 연장은 병원에 요청` });
  }
  for (const q of data.state.scheduleRequests.filter(q => q.status === "요청" && myIds.has(q.patientId) && q.date)) {
    events.push({ key: q.id, date: q.date!, time: q.time, kind: "변경 요청", patient: byId(q.patientId), text: `보호자가 이 날로 바꾸고 싶어 해요 · ${q.reason}` });
  }
  const order: Kind[] = ["보고서 미작성", "변경 요청", "예정", "작성 중", "완료", "처방 종료"];
  const on = (d: string) => events.filter(e => e.date === d).sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99") || order.indexOf(a.kind) - order.indexOf(b.kind));

  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => iso(y, m, i + 1))];
  while (cells.length % 7) cells.push(null);
  const month = iso(y, m, 1).slice(0, 7);
  const inMonth = events.filter(e => e.date.startsWith(month));
  const move = (n: number) => { const d = new Date(y, m + n, 1); setCursor({ y: d.getFullYear(), m: d.getMonth() }); };
  const list = on(day);

  if (record) return <SessionReportForm patient={record.patient} defaultDate={record.date} author={data.ref} onClose={() => setRecord(null)} />;
  return <div className="sg sg-work my-home my-sub-view">
    <ExpertSubHeader title="일정표" subtitle={`이번 달 진행 ${inMonth.filter(e => e.kind === "완료").length}회 · 예정 ${inMonth.filter(e => e.kind === "예정").length}회`} />

    <section className="sg-card cal">
      <div className="cal-head">
        <button className="cal-nav" aria-label="이전 달" onClick={() => move(-1)}><Icon name="chevron" size={16} /></button>
        <b>{y}년 {m + 1}월</b>
        <button className="cal-nav next" aria-label="다음 달" onClick={() => move(1)}><Icon name="chevron" size={16} /></button>
        <button className="cal-today" onClick={() => { setCursor(null); setPicked(null); }}>오늘</button>
      </div>
      <div className="cal-grid" role="grid" aria-label={`${y}년 ${m + 1}월 일정`}>
        {WEEK.map((w, i) => <span key={w} className={`cal-w ${i === 0 ? "sun" : i === 6 ? "sat" : ""}`}>{w}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={`x${i}`} className="cal-cell empty" />;
          const evs = on(d);
          return <button key={d} role="gridcell" aria-selected={d === day} aria-label={`${md(d)} ${evs.length ? `일정 ${evs.length}건` : "일정 없음"}`}
            className={`cal-cell ${d === day ? "picked" : ""} ${d === today ? "today" : ""} ${i % 7 === 0 ? "sun" : i % 7 === 6 ? "sat" : ""}`} onClick={() => setPicked(d)}>
            <span className="cal-num">{Number(d.slice(8))}</span>
            <span className="cal-evs">{evs.slice(0, 2).map(e => <span key={e.key} className={`cal-ev ${tone[e.kind]}`}>{e.time ? `${e.time} ` : ""}{e.patient.name}</span>)}{evs.length > 2 && <span className="cal-more">+{evs.length - 2}</span>}</span>
            <span className="cal-dots">{evs.slice(0, 3).map(e => <i key={e.key} className={tone[e.kind]} />)}</span>
          </button>;
        })}
      </div>
      <p className="cal-legend">{(["예정", "완료", "보고서 미작성", "변경 요청", "처방 종료"] as Kind[]).map(k => <span key={k}><i className={tone[k]} />{k}</span>)}</p>
    </section>

    <h2 className="sg-title">{md(day)} ({WEEK[new Date(`${day}T00:00:00`).getDay()]}){day === today ? " · 오늘" : ""} <span>{list.length}건</span></h2>
    {list.length ? list.map(e => <section className="sg-card" key={e.key}>
      <Link className="sg-row" href={e.kind === "변경 요청" ? "/expert" : `/expert/patients/${e.patient.id}`}>
        <span><small className={`sg-state ${e.kind === "보고서 미작성" || e.kind === "변경 요청" ? "warn" : e.kind === "예정" ? "on" : ""}`}>{e.kind}{e.time ? ` · ${e.time}` : ""}</small>
          <b>{e.patient.name} 님 · {e.patient.condition}</b><small>{e.text}</small></span>
        <span className="sg-right">{e.kind === "변경 요청" ? "응답하기" : "대상 정보"}<Icon name="chevron" size={14} /></span>
      </Link>
      {(e.kind === "예정" || e.kind === "보고서 미작성") && <>
        <div className="sg-divider" />
        <PlaceInfo patient={e.patient} changed={!!e.patient.nextPlace} />
        <div className="sg-actions"><Link className={e.kind === "보고서 미작성" || e.date === today ? "primary" : ""} href={`/expert/patients/${e.patient.id}`}>회차 기록 쓰기</Link></div>
      </>}
    </section>) : <section className="sg-card sg-empty">이 날은 일정이 없어요.</section>}
    <p className="sg-foot">다음 회차 일정은 보고서를 쓸 때 정해요. 바뀐 일정은 보호자 화면에도 바로 보여요.</p>


  </div>;
}
