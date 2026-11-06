"use client";
import Link from "next/link";
import { useState } from "react";
import { Modal } from "@/components/CareUI";
import { Icon } from "@/components/Icon";
import { careRepo, mutationFailed, type Patient } from "@/lib/repo";
import { won } from "@/lib/data";
import { useToday } from "@/lib/use-today";
import { centerOfProvider, flowStep, programFor, settlement, PROVIDER_SHARE } from "@/lib/center";
import { placeName, upcomingPlace } from "@/lib/places";
import { md, weekday } from "../my/my-utils";
import { useProviderCare } from "./use-provider-care";
import "@/components/center-ui.css";

const DECLINE = ["희망 일정에 진행이 어려워요", "방문 지역이 멀어요", "제 전문 분야와 맞지 않아요"];

/** 치료사 1차 홈: 새 신청 수락 → (센터 의사 확인) → 다가오는 회차 → 이번 달 정산 예정 */
export function ProviderHome() {
  const data = useProviderCare();
  const today = useToday();
  const [declining, setDeclining] = useState<Patient | null>(null);
  const [reason, setReason] = useState(DECLINE[0]);
  const [error, setError] = useState("");
  if (!data) return null;
  const { state, provider, ref } = data;
  const center = centerOfProvider(provider.id);
  const month = (today ?? "").slice(0, 7);
  const pay = today ? settlement(state, provider.id, month) : null;
  const waiting = data.patients.filter(p => p.status === "승인 대기");
  const active = data.patients.filter(p => p.status === "진행 중").sort((a, b) => (a.nextDate + a.nextTime).localeCompare(b.nextDate + b.nextTime));
  const drafts = data.drafts.length;

  async function accept(p: Patient) {
    setError("");
    const r = await careRepo.acceptRequest(p.id, ref);
    if (mutationFailed(r) || !r) setError("수락하지 못했어요. 이미 처리된 신청인지 확인해 주세요.");
  }
  async function decline() {
    if (!declining) return;
    const r = await careRepo.declineAssignment(declining.id, ref, reason);
    if (mutationFailed(r)) return setError("거절하지 못했어요.");
    setDeclining(null);
  }

  return <div className="sg my-home">
    <h1 className="sg-h1">내 관리</h1>
    <div className="sg-profile"><div><b>{provider.name} 선생님</b><small>{provider.license} · {center.name}</small></div></div>
    {error && <p className="cx-error" role="alert">{error}</p>}

    <h2 className="sg-title">새 신청 {data.requests.length > 0 && <em className="sg-badge alert">{data.requests.length}</em>}</h2>
    {data.requests.length ? data.requests.map(p => { const pg = programFor(state, p); return <section className="sg-card" key={p.id}>
      <div className="cx-row-between" style={{ alignItems: "flex-start" }}>
        <span><b style={{ fontSize: 16 }}>{p.name} 님 · {p.age}세 {p.sex !== "미입력" ? p.sex : ""}</b><small style={{ display: "block", color: "#5b6170", marginTop: 4 }}>{p.condition}</small></span>
        <span className="cx-chip">{placeName(upcomingPlace(p))}</span>
      </div>
      <dl className="cx-kv" style={{ marginTop: 12 }}>
        <dt>프로그램</dt><dd>{pg?.title ?? "-"}</dd>
        <dt>희망 첫 일정</dt><dd>{md(p.nextDate)} ({weekday(p.nextDate)}) {p.nextTime}</dd>
        <dt>지역</dt><dd>{p.area}</dd>
        {p.goal && <><dt>목표</dt><dd>{p.goal}</dd></>}
        {p.precautions && <><dt>주의사항</dt><dd>{p.precautions}</dd></>}
        <dt>신청자</dt><dd>{p.applicant ?? "-"}</dd>
      </dl>
      <div className="cx-actions" style={{ marginTop: 12 }}><button className="cx-btn primary" onClick={() => accept(p)}>수락</button><button className="cx-btn" onClick={() => { setReason(DECLINE[0]); setDeclining(p); }}>거절</button></div>
      <p className="cx-hint">수락하면 첫 회차 전에 {center.name} 의사가 확인해요. 확인이 끝나야 예약이 확정됩니다.</p>
    </section>; }) : <section className="sg-card sg-empty">새 신청이 없어요.</section>}

    {waiting.length > 0 && <>
      <h2 className="sg-title">센터 의사 확인 대기</h2>
      <section className="sg-card"><ul className="cx-list">{waiting.map(p => <li key={p.id}><Link href={`/expert/patients/${p.id}`} className="cx-row-between" style={{ color: "inherit", textDecoration: "none" }}><span><b>{p.name} 님</b><small>{p.condition} · 희망 {md(p.nextDate)} {p.nextTime}</small></span><span className="cx-chip caution">의사 확인 전</span></Link></li>)}</ul></section>
    </>}

    <h2 className="sg-title">다가오는 회차</h2>
    {active.length ? <section className="sg-card"><ul className="cx-list">{active.map(p => <li key={p.id}><Link href={`/expert/patients/${p.id}`} className="cx-row-between" style={{ color: "inherit", textDecoration: "none" }}><span><b>{md(p.nextDate)} ({weekday(p.nextDate)}) {p.nextTime} · {p.name} 님</b><small>{placeName(upcomingPlace(p))} · {p.completed + 1}회차{today && p.nextDate < today ? " · 기록 필요" : ""}</small></span><span className={`cx-chip ${flowStep(state, p) === "예약 확정" ? "on" : ""}`}>{flowStep(state, p) === "예약 확정" ? "첫 회차" : "진행 중"}</span></Link></li>)}</ul></section>
      : <section className="sg-card sg-empty">예약된 회차가 없어요.</section>}

    <nav className="sg-quick-menu" aria-label="바로가기">
      <Link href="/expert/schedule"><span className="sg-qicon"><Icon name="calendar" size={20} /></span>일정표</Link>
      <Link href={active[0] ? `/expert/patients/${active[0].id}` : "/expert/schedule"}><span className="sg-qicon"><Icon name="file" size={20} />{drafts ? <em>{drafts}</em> : null}</span>회차 기록</Link>
    </nav>

    <h2 className="sg-title">이번 달 정산 예정</h2>
    <section className="sg-card">
      <dl className="cx-kv">
        <dt>진행한 회차</dt><dd>{pay?.rows.length ?? 0}회</dd>
        <dt>회차 금액 합계</dt><dd className="cx-money">{won(pay?.gross ?? 0)}</dd>
        <dt>정산 예정</dt><dd><b className="cx-money">{won(pay?.share ?? 0)}</b> <small>(정산 비율 {PROVIDER_SHARE * 100}% · 체험용 가정)</small></dd>
      </dl>
    </section>
    <p className="sg-foot">정산 비율과 금액은 센터와의 계약에 따라 정해져요. 지금은 체험용 가정값이에요.</p>

    {declining && <Modal title="신청 거절" onClose={() => setDeclining(null)}>
      <p className="modal-lead">{declining.name} 님 신청을 거절하면 센터가 다른 선생님을 찾아요.</p>
      <div className="cx-form"><fieldset><legend>사유</legend><div className="cx-choice">{DECLINE.map(d => <label key={d}><input type="radio" name="reason" checked={reason === d} onChange={() => setReason(d)} /><span><b>{d}</b></span></label>)}</div></fieldset>
        <button className="cx-btn primary wide" onClick={decline}>거절하기</button></div>
    </Modal>}
  </div>;
}
