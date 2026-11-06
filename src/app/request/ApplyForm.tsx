"use client";
import Link from "next/link";
import { useState } from "react";
import { careRepo, mutationFailed, useCare } from "@/lib/repo";
import { experts, won } from "@/lib/data";
import { allProviders } from "@/lib/workflow";
import { centerOfProvider, methodLabel, paymentLabel, programPlace, programsOf } from "@/lib/center";
import { centerOf, placeName as nameOf } from "@/lib/places";
import { setDemoRole, usePatientAccount, useRole } from "@/lib/demo-session";
import { DEMO_MODE } from "@/lib/session";
import { selectPatient } from "@/app/my/use-patient-care";
import { FlowSteps } from "@/components/FlowSteps";
import "@/components/center-ui.css";

const TIMES = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

/** 치료사 프로필에서 들어오는 신청서. 신청 → 치료사 수락 → 센터 의사 확인 → 예약 확정 순서로 이어집니다. */
export function ApplyForm({ expertId, programId }: { expertId: string; programId?: string }) {
  const state = useCare(), role = useRole(), me = usePatientAccount();
  const provider = allProviders(state).find(e => e.id === expertId) ?? experts.find(e => e.id === expertId);
  const programs = provider ? programsOf(state, provider.id) : [];
  const [chosen, setChosen] = useState(programId && programs.some(p => p.id === programId) ? programId : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [doneId, setDoneId] = useState("");

  if (!provider) return <div className="cx-page"><h1>치료사를 찾을 수 없어요</h1><Link className="cx-btn" href="/experts">치료사 찾기</Link></div>;
  const center = centerOfProvider(provider.id);
  const program = programs.find(p => p.id === (chosen || programs[0]?.id));

  if (doneId) return <div className="cx-page cx-done">
    <h1>신청했어요</h1>
    <p className="cx-lead">{provider.name} 선생님이 신청을 확인하면, 첫 회차 전에 {center.name} 의사가 상태와 주의사항을 확인합니다. 의사 확인이 끝나면 예약이 확정되고 결제 안내가 와요.</p>
    <FlowSteps step="치료사 수락 대기" />
    <div className="cx-actions" style={{ justifyContent: "center", marginTop: 28 }}><Link className="cx-btn primary" href="/my" onClick={() => selectPatient(doneId)}>내 관리에서 보기</Link><Link className="cx-btn" href="/experts">다른 치료사 보기</Link></div>
  </div>;

  if (role === null) return <div className="cx-page"><p role="status">신청서를 준비하고 있어요.</p></div>;
  if (role !== "patient") return <div className="cx-page">
    <h1>{provider.name} 선생님께 신청하기</h1>
    <p className="cx-lead">신청은 환자·보호자 계정으로 할 수 있어요.{DEMO_MODE ? " 체험 중이라면 환자·보호자 역할로 바꿔서 신청해 보세요." : ""}</p>
    {DEMO_MODE ? <button className="cx-btn primary" onClick={() => setDemoRole("patient")}>환자·보호자로 체험하기</button> : <Link className="cx-btn primary" href="/login">로그인</Link>}
  </div>;

  if (!programs.length) return <div className="cx-page"><h1>{provider.name} 선생님께 신청하기</h1><p className="cx-lead">지금 신청할 수 있는 프로그램이 없어요.</p><Link className="cx-btn" href={`/experts/${provider.id}`}>프로필로 돌아가기</Link></div>;

  async function submit(form: HTMLFormElement) {
    const f = new FormData(form), text = (k: string) => String(f.get(k) ?? "").trim();
    const age = Number(text("age"));
    if (!program) return setError("프로그램을 골라 주세요.");
    if (!text("name") || !text("condition") || !text("area")) return setError("이용자 이름, 현재 상태, 지역을 입력해 주세요.");
    if (!Number.isInteger(age) || age < 1 || age > 120) return setError("나이를 확인해 주세요.");
    if (!text("date")) return setError("희망하는 첫 날짜를 골라 주세요.");
    if (program.method === "방문" && !text("homeAddress")) return setError("방문 주소를 입력해 주세요.");
    if (f.get("consent") !== "on") return setError("안내 내용에 동의해 주세요.");
    setBusy(true); setError("");
    const id = await careRepo.applyToProvider({
      name: text("name"), age, sex: text("sex") || "미입력", condition: text("condition"), area: text("area"),
      goal: text("goal"), precautions: text("precautions"), nextDate: text("date"), nextTime: text("time") || "10:00",
      applicant: `${me.name} (${me.relation})`, guardianAccountId: me.id, homeAddress: text("homeAddress") || undefined, homeAccess: text("homeAccess") || undefined, consent: true,
    }, provider!.id, program.id);
    setBusy(false);
    if (mutationFailed(id) || !id) return setError("신청하지 못했어요. 입력 내용을 확인해 주세요.");
    setDoneId(id);
  }

  return <div className="cx-page">
    <p className="cx-hint" style={{ marginBottom: 4 }}><Link href={`/experts/${provider.id}`}>← {provider.name} 선생님 프로필</Link></p>
    <h1>{provider.name} 선생님께 신청하기</h1>
    <p className="cx-lead">{center.name} 소속 {provider.license}예요. 신청 후 선생님이 수락하고, 첫 회차 전에 센터 의사가 확인하면 예약이 확정돼요.</p>
    <form className="cx-form" onSubmit={e => { e.preventDefault(); void submit(e.currentTarget); }} noValidate>
      <fieldset><legend>프로그램</legend><div className="cx-choice">{programs.map(pg => <label key={pg.id}><input type="radio" name="program" checked={program?.id === pg.id} onChange={() => setChosen(pg.id)} /><span><b>{pg.title}</b><small>{methodLabel(pg)} · {pg.minutes}분 · {paymentLabel(pg)} · {pg.payment === "이용권" && pg.packPrice ? won(pg.packPrice) : `${won(pg.price)} / 회`}</small></span></label>)}</div></fieldset>
      <div className="cx-row"><label><span>이용자 이름</span><input name="name" autoComplete="off" /></label><label><span>나이</span><input name="age" type="number" inputMode="numeric" min={1} max={120} /></label></div>
      <div className="cx-row"><label><span>성별</span><select name="sex" defaultValue=""><option value="">선택 안 함</option><option>여</option><option>남</option></select></label><label><span>지역</span><input name="area" placeholder="예: 서울 송파구" /></label></div>
      <label><span>현재 상태</span><input name="condition" placeholder="예: 무릎 인공관절 수술 후 3주" /></label>
      <label><span>원하는 목표 <small>(선택)</small></span><input name="goal" placeholder="예: 혼자 계단 오르기" /></label>
      <label><span>병원에서 들은 주의사항 <small>(선택)</small></span><textarea name="precautions" placeholder="센터 의사가 확인할 때 참고해요." /></label>
      <div className="cx-row"><label><span>희망 첫 날짜</span><input name="date" type="date" /></label><label><span>시간</span><select name="time" defaultValue="10:00">{TIMES.map(t => <option key={t}>{t}</option>)}</select></label></div>
      {program?.method === "방문" ? <>
        <label><span>방문 주소</span><input name="homeAddress" placeholder="담당 치료사와 센터만 볼 수 있어요" /></label>
        <label><span>방문 참고 <small>(선택)</small></span><input name="homeAccess" placeholder="예: 엘리베이터 없음, 2층" /></label>
        <p className="cx-hint">공동현관 비밀번호 같은 출입 정보는 적지 말고 방문 당일 치료사에게 알려 주세요.</p>
      </> : program && <p className="cx-hint">진행 장소: {nameOf(programPlace(program))} · {centerOf(programPlace(program).centerId)?.address}</p>}
      <label className="cx-check"><input type="checkbox" name="consent" /><span>첫 회차 전에 {center.name} 의사가 상태와 주의사항을 확인하는 것에 동의합니다. 확인 결과에 따라 프로그램이 바뀌거나 진행이 어려울 수 있어요.</span></label>
      {error && <p className="cx-error" role="alert">{error}</p>}
      <button className="cx-btn primary wide" disabled={busy}>{busy ? "신청하는 중…" : "신청하기"}</button>
      <p className="cx-hint">신청만으로 예약이나 결제가 되지 않아요. 금액은 체험용 예시입니다.</p>
    </form>
  </div>;
}
