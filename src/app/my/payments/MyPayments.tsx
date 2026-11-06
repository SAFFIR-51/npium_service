"use client";
import { useState } from "react";
import { Modal } from "@/components/CareUI";
import { careRepo, mutationFailed } from "@/lib/repo";
import { won } from "@/lib/data";
import { balanceOf, programById, ymd } from "@/lib/center";
import { MySubHeader, PatientSwitch } from "../PatientShell";
import { usePatientCare } from "../use-patient-care";
import "../my-home-type.css";
import "@/components/center-ui.css";

const METHODS = ["카드", "계좌이체", "간편결제"];

/** 결제 내역. 실제 결제 연동 전이라 "결제하기"는 결제 완료 표시만 합니다(체험). */
export function MyPayments() {
  const { state, patient } = usePatientCare();
  const [paying, setPaying] = useState<string | null>(null);
  const [method, setMethod] = useState(METHODS[0]);
  const [error, setError] = useState("");
  if (!patient) return <div className="sg"><MySubHeader title="결제 내역" /><section className="sg-card sg-empty">관리 대상이 없어요.</section></div>;
  const b = balanceOf(state, patient);
  const target = b.pending.find(x => x.id === paying);

  return <div className="sg">
    <MySubHeader title="결제 내역" subtitle="이용권과 회차 결제를 확인해요" />
    <PatientSwitch />
    <section className="sg-card">
      <dl className="cx-kv">
        <dt>결제한 회차</dt><dd>{b.paidSessions}회 · {won(b.paidAmount)}</dd>
        <dt>진행한 회차</dt><dd>{b.used}회</dd>
        <dt>남은 회차</dt><dd><b>{Math.max(0, b.remaining)}회</b>{b.remaining < 0 ? ` (결제 전 진행 ${-b.remaining}회)` : ""}</dd>
      </dl>
    </section>

    <h2 className="sg-title">결제할 금액</h2>
    {b.pending.length ? <section className="sg-card"><ul className="cx-list">{b.pending.map(x => { const pg = programById(state, x.programId); return <li key={x.id} className="cx-row-between"><span><b>{pg?.title ?? "프로그램"} · {x.kind === "이용권" ? `${x.sessions}회 이용권` : "1회"}</b><small>요청 {ymd(x.createdAt)} · {x.by.split(" ")[0]}</small></span><span style={{ textAlign: "right" }}><b className="cx-money">{won(x.amount)}</b><br /><button className="cx-btn small primary" style={{ marginTop: 6 }} onClick={() => { setPaying(x.id); setError(""); }}>결제하기</button></span></li>; })}</ul></section>
      : <section className="sg-card sg-empty">지금 결제할 금액이 없어요.</section>}

    <h2 className="sg-title">결제 완료</h2>
    {b.paid.length ? <section className="sg-card"><ul className="cx-list">{b.paid.map(x => { const pg = programById(state, x.programId); return <li key={x.id} className="cx-row-between"><span><b>{pg?.title ?? "프로그램"} · {x.kind === "이용권" ? `${x.sessions}회 이용권` : "1회"}</b><small>{x.paidAt ? ymd(x.paidAt) : ""} · {x.method}</small></span><b className="cx-money">{won(x.amount)}</b></li>; })}</ul></section>
      : <section className="sg-card sg-empty">결제한 내역이 없어요.</section>}
    <p className="sg-foot">금액은 체험용 예시예요. 결제 수단 연동 전이라 결제하기는 결제 완료 표시만 합니다.</p>

    {target && <Modal title="결제하기" onClose={() => setPaying(null)}>
      <p className="modal-lead">{won(target.amount)} · {target.kind === "이용권" ? `${target.sessions}회 이용권` : "1회"}</p>
      <div className="cx-form"><fieldset><legend>결제 수단</legend><div className="cx-choice">{METHODS.map(m => <label key={m}><input type="radio" name="method" checked={method === m} onChange={() => setMethod(m)} /><span><b>{m}</b></span></label>)}</div></fieldset>
        {error && <p className="cx-error" role="alert">{error}</p>}
        <button className="cx-btn primary wide" onClick={async () => { const r = await careRepo.markPaid(target.id, method); if (mutationFailed(r) || !r) return setError("결제를 처리하지 못했어요."); setPaying(null); }}>{won(target.amount)} 결제하기 (체험)</button></div>
    </Modal>}
  </div>;
}
