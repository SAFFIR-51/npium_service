"use client";
import { useParams } from "next/navigation";
import { useState } from "react";
import { DoctorCheckBox, FlowSteps } from "@/components/FlowSteps";
import { careRepo, mutationFailed, todayLocal } from "@/lib/repo";
import { doctorCheckOf, flowStep, programFor } from "@/lib/center";
import { placeAddress, placeName, upcomingPlace } from "@/lib/places";
import { md, weekday } from "@/app/my/my-utils";
import { ExpertSubHeader } from "../../ExpertShell";
import { useProviderCare } from "../../use-provider-care";
import "@/components/center-ui.css";

const ATTENDANCE = ["참여", "부분 참여", "미참여"] as const;
const TIMES = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** 1차 이용자 상세: 의사 확인 내용 보기 + 간단한 회차 기록. (예전 상세 화면은 PatientDetail.tsx에 남겨 둠) */
export function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const data = useProviderCare();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [attendance, setAttendance] = useState<(typeof ATTENDANCE)[number]>("참여");
  if (!data) return null;
  const p = data.patients.find(x => x.id === id) ?? data.requests.find(x => x.id === id);
  if (!p) return <div className="sg"><ExpertSubHeader title="이용자 정보" /><section className="sg-card sg-empty">담당 이용자가 아니거나 찾을 수 없어요.</section></div>;
  const { state, ref } = data;
  const step = flowStep(state, p), program = programFor(state, p), check = doctorCheckOf(p);
  const records = state.records.filter(r => r.patientId === p.id && r.confirmed).sort((a, b) => b.date.localeCompare(a.date));
  const canWrite = p.status === "진행 중" && p.providerId === ref.id;
  const contra = check?.contraindications ?? [];

  async function submit(form: HTMLFormElement) {
    const f = new FormData(form), text = (k: string) => String(f.get(k) ?? "").trim();
    setError(""); setSaved("");
    if (attendance !== "미참여" && !text("content")) return setError("진행 내용을 적어 주세요.");
    if (attendance === "미참여" && !text("absence")) return setError("진행하지 못한 사유를 적어 주세요.");
    if (attendance !== "미참여" && contra.length && f.get("contra") !== "on") return setError("센터 의사가 정한 '하지 않을 운동'을 하지 않았는지 확인해 주세요.");
    if (!text("nextDate")) return setError("다음 회차 날짜를 정해 주세요.");
    const r = await careRepo.saveRecord(p!.id, {
      date: text("date") || todayLocal(), attendance, absenceReason: attendance === "미참여" ? text("absence") : undefined,
      durationMin: attendance === "미참여" ? 0 : Number(text("minutes")) || program?.minutes, content: attendance === "미참여" ? `진행하지 못함: ${text("absence")}` : text("content"),
      next: text("next"), walk: "", pain: "", contraChecked: contra.length ? f.get("contra") === "on" : undefined,
      nextDate: text("nextDate"), nextTime: text("nextTime"),
    }, { confirm: true, author: ref });
    if (mutationFailed(r) || !r) return setError("기록을 저장하지 못했어요. 날짜가 의사 확인 범위 안인지 확인해 주세요.");
    form.reset(); setAttendance("참여"); setSaved("회차 기록을 저장했어요. 이용자 화면에도 바로 보여요.");
  }

  const today = todayLocal();
  return <div className="sg">
    <ExpertSubHeader title={`${p.name} 님`} subtitle={`${p.age}세 · ${p.condition}`} />
    <section className="sg-card"><FlowSteps step={step} /></section>

    <h2 className="sg-title">기본 정보</h2>
    <section className="sg-card"><dl className="cx-kv">
      <dt>프로그램</dt><dd>{program ? `${program.title} · ${program.minutes}분` : "-"}</dd>
      <dt>다음 회차</dt><dd>{p.status === "진행 중" ? `${md(p.nextDate)} (${weekday(p.nextDate)}) ${p.nextTime}` : `희망 ${md(p.nextDate)} ${p.nextTime} · 확정 전`}</dd>
      <dt>장소</dt><dd>{placeName(upcomingPlace(p))} · {placeAddress(p)}</dd>
      {p.homeAccess && <><dt>방문 참고</dt><dd>{p.homeAccess}</dd></>}
      {p.goal && <><dt>목표</dt><dd>{p.goal}</dd></>}
      {p.precautions && <><dt>신청 시 주의</dt><dd>{p.precautions}</dd></>}
      <dt>진행</dt><dd>{p.completed}회</dd>
    </dl></section>

    <div style={{ marginTop: 10 }}><DoctorCheckBox check={check} /></div>

    {canWrite ? <>
      <h2 className="sg-title">회차 기록</h2>
      <section className="sg-card">
        <form className="cx-form" onSubmit={e => { e.preventDefault(); void submit(e.currentTarget); }} noValidate>
          <div className="cx-row"><label><span>진행일</span><input name="date" type="date" defaultValue={today} max={today} /></label><label><span>진행 시간(분)</span><input name="minutes" type="number" min={0} defaultValue={program?.minutes ?? 60} /></label></div>
          <fieldset><legend>참여</legend><div className="cx-actions">{ATTENDANCE.map(a => <label key={a} className="cx-check"><input type="radio" name="attendance" checked={attendance === a} onChange={() => setAttendance(a)} />{a}</label>)}</div></fieldset>
          {attendance === "미참여" ? <label><span>진행하지 못한 사유</span><input name="absence" placeholder="예: 컨디션 저하로 쉬기로 함" /></label> : <>
            <label><span>진행 내용</span><textarea name="content" placeholder="진행한 활동과 반응을 간단히 적어 주세요." /></label>
            <label><span>다음 계획 <small>(선택)</small></span><input name="next" /></label>
            {contra.length > 0 && <label className="cx-check"><input type="checkbox" name="contra" /><span>센터 의사가 정한 하지 않을 운동({contra.join(", ")})을 하지 않았어요.</span></label>}
          </>}
          <div className="cx-row"><label><span>다음 회차 날짜</span><input name="nextDate" type="date" defaultValue={addDays(p.nextDate > today ? p.nextDate : today, 7)} /></label><label><span>시간</span><select name="nextTime" defaultValue={TIMES.includes(p.nextTime) ? p.nextTime : "10:00"}>{TIMES.map(t => <option key={t}>{t}</option>)}</select></label></div>
          {error && <p className="cx-error" role="alert">{error}</p>}
          {saved && <p className="cx-hint" role="status">{saved}</p>}
          <button className="cx-btn primary wide">기록 저장</button>
        </form>
      </section>
    </> : <section className="sg-card sg-empty" style={{ marginTop: 10 }}>{p.status === "승인 대기" ? "센터 의사 확인이 끝나면 회차 기록을 쓸 수 있어요." : p.status === "배정 대기" ? "신청을 수락하면 센터 의사 확인 단계로 넘어가요." : "종료된 프로그램이에요."}</section>}

    <h2 className="sg-title">지난 기록</h2>
    {records.length ? <section className="sg-card"><ul className="cx-list">{records.map(r => <li key={r.id}><b>{md(r.date)} ({weekday(r.date)}) · {r.sessionNo ? `${r.sessionNo}회차` : r.title} · {r.attendance ?? "참여"}{r.durationMin ? ` ${r.durationMin}분` : ""}</b><small>{r.content}{r.next ? ` → 다음: ${r.next}` : ""}</small></li>)}</ul></section>
      : <section className="sg-card sg-empty">아직 기록이 없어요.</section>}
  </div>;
}
