"use client";
import { Modal } from "@/components/CareUI";
import { mutationFailed } from "@/lib/repo";
import { usePatientAccount } from "@/lib/demo-session";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { expertPortraits } from "@/lib/expert-portraits";
import { careRepo } from "@/lib/repo";
import { useToday } from "@/lib/use-today";
import { absenceReasons, visitPrep } from "../care-content";
import { dday, md, weekday } from "../my-utils";
import { MySubHeader, PatientSwitch } from "../PatientShell";
import { usePatientCare } from "../use-patient-care";
import "../my-home-type.css";
import { PlaceInfo } from "@/components/PlaceInfo";
import { PlacePicker } from "@/components/PlacePicker";
import { placeName, samePlace, upcomingPlace, type Place } from "@/lib/places";

/** 일정: 다음 방문 · 변경 요청 · 지난 회차. (한 화면에서 한 가지 일만) */
export function MySchedule() {
  const { state, patient } = usePatientCare();
  const today = useToday();
  const me = usePatientAccount();
  const [modal, setModal] = useState<"change" | "absent" | "prep" | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [date, setDate] = useState(""); const [time, setTime] = useState(""); const [reason, setReason] = useState(absenceReasons[0]); const [memo, setMemo] = useState("");


if (!patient) return <div className="sg my-home my-sub-view"><MySubHeader title="일정" subtitle="연결된 관리 대상이 없어요." /></div>;
    const started = patient.status === "진행 중" || patient.status === "종료";
  const records = state.records.filter(r => r.patientId === patient.id && r.confirmed).sort((a, b) => b.date.localeCompare(a.date));
  const request = state.scheduleRequests.find(r => r.patientId === patient.id);
  const pending = request?.status === "요청" ? request : undefined;
  const portrait = patient.providerId ? expertPortraits[patient.providerId] : undefined;
  const thread = `care-${patient.id}`;
  const nextLabel = request?.status === "확정" && request.respondedAt ? (request.kind === "변경" ? "변경 확정" : "확인됨") : "방문 예정";

  const submit = async () => {
    const current = `${md(patient.nextDate)}(${weekday(patient.nextDate)}) ${patient.nextTime}`;
    if (modal === "change") {
      const requestedDate = date || patient.nextDate, requestedTime = time || patient.nextTime;
      if (!requestedDate || !requestedTime) return;
      const placeChanged = !samePlace(place ?? upcomingPlace(patient), upcomingPlace(patient));
      if (mutationFailed(await careRepo.requestSchedule({ patientId: patient.id, kind: "변경", date: requestedDate, time: requestedTime, reason: memo.trim() || (placeChanged ? "장소 변경" : "희망 일정 변경"), by: me.name, ...(placeChanged ? { place: place ?? upcomingPlace(patient) } : {}) }))) return;
      // 담당 선생님 대화방에도 남겨 바로 알 수 있게 합니다. (알림에는 건강 정보를 넣지 않습니다)
      if (patient.providerId) if (mutationFailed(await careRepo.sendMessage(thread, { key: me.id, name: me.name }, `[일정 변경 요청] ${current} → ${md(requestedDate)}(${weekday(requestedDate)}) ${requestedTime}${placeChanged ? `\n장소: ${placeName(upcomingPlace(patient))} → ${placeName(place ?? upcomingPlace(patient))} (이번 회차만)` : ""}${memo.trim() ? `\n사유: ${memo.trim()}` : ""}`))) return;
    } else {
      const why = reason === "기타" ? memo.trim() || "기타" : reason;
      if (mutationFailed(await careRepo.requestSchedule({ patientId: patient.id, kind: "참여 어려움", reason: why, by: me.name }))) return;
      if (patient.providerId) if (mutationFailed(await careRepo.sendMessage(thread, { key: me.id, name: me.name }, `[참여 어려움] ${current} 일정에 참여하기 어려워요.\n사유: ${why}`))) return;
    }
    setModal(null); setMemo("");
  };




  return <div className="sg my-home my-sub-view">
    <MySubHeader title="일정" />
    <PatientSwitch />

    <h2 className="sg-title">다음 방문</h2>
    {patient.status === "종료" ? <section className="sg-card sg-empty">방문재활이 끝났어요. {patient.closure?.summary} <Link href="/my">내 관리로</Link></section> : started && patient.providerId ? <section className="sg-card">
      <div className="sg-row static">
        <span><small className="sg-state on">{nextLabel} · {dday(today, patient.nextDate)}</small><b className="sg-big">{md(patient.nextDate)} ({weekday(patient.nextDate)}) {patient.nextTime}</b></span>
      </div>
      <PlaceInfo patient={patient} changed={!!patient.nextPlace} />
      {pending && <p className="sg-change"><Icon name="clock" size={14} />{pending.kind === "변경" ? <>{md(pending.date!)} ({weekday(pending.date!)}) {pending.time}{pending.place ? ` · ${placeName(pending.place)}` : ""}로 변경 요청 · 선생님 확인 중</> : "참여 어려움 알림 · 선생님 확인 중"}<button onClick={async () => await careRepo.cancelScheduleRequest(pending.id)}>요청 취소</button></p>}
      {request?.status === "조정 필요" && <p className="sg-change warn"><Icon name="chat" size={14} />{request.response || "일정 조정이 필요해요."}</p>}
      {request?.status === "확정" && request.response && <p className="sg-change"><Icon name="check" size={14} />{request.response}</p>}
      <div className="sg-divider" />
      <div className="sg-person">{portrait ? <Image src={portrait} width={28} height={28} alt="" /> : <span className="sg-avatar">{patient.provider.slice(0, 1)}</span>}<span>{patient.provider} 선생님 · 담당</span></div>
      <div className="sg-actions"><button disabled={!!pending} onClick={() => { setDate(patient.nextDate); setTime(patient.nextTime); setPlace(upcomingPlace(patient)); setModal("change"); }}>일정·장소 변경 요청</button><button disabled={!!pending} onClick={() => setModal("absent")}>참여 어려움 알리기</button></div>
    </section> : <section className="sg-card sg-empty">담당 선생님이 연결되면 일정이 이곳에 보여요. <Link href="/my">진행 단계 보기</Link></section>}

    {started && patient.status !== "종료" && <><h2 className="sg-title">방문 전 준비</h2>
      <section className="sg-card"><ul className="sg-check">{visitPrep.slice(0, 4).map(v => <li key={v}><Icon name="check" size={14} />{v}</li>)}</ul>
        <button className="sg-more inline" onClick={() => setModal("prep")}>전체 보기</button></section></>}

    <h2 className="sg-title">지난 회차 <span>{records.length}</span></h2>
    {records.length ? <section className="sg-card sg-list">{records.map(r => <div key={r.id} className="sg-row">
      <span><small className={`sg-state ${r.attendance === "부분 참여" ? "warn" : r.attendance === "미참여" ? "off" : ""}`}>{r.attendance === "미참여" ? "쉼" : r.attendance ?? "참여"}{r.durationMin ? ` · ${r.durationMin}분` : ""}</small><b>{md(r.date)} ({weekday(r.date)}) · {r.sessionNo ? `${r.sessionNo}회차` : r.title}</b></span>
      <span className="sg-right" style={{ maxWidth: "45%", textAlign: "right", fontSize: 13 }}>{r.content.slice(0, 40)}{r.content.length > 40 ? "…" : ""}</span>
    </div>)}</section> : <section className="sg-card sg-empty">아직 진행한 회차가 없어요.</section>}







    {modal === "prep" && <Modal title="방문 전에 준비해 주세요" onClose={() => setModal(null)}><p className="modal-lead">{md(patient.nextDate)}({weekday(patient.nextDate)}) {patient.nextTime} · {patient.provider} 선생님 {patient.method}</p><ul className="my-prep">{visitPrep.map(v => <li key={v}><Icon name="check" size={15} />{v}</li>)}</ul><p className="form-hint">주의사항: {patient.precautions}</p></Modal>}

    {modal === "change" && <Modal title="일정·장소 변경 요청" onClose={() => setModal(null)}><p className="modal-lead">희망 일정을 보내면 담당 선생님이 확인한 뒤 확정돼요. 확정 전까지는 기존 일정이 유지돼요.</p><form className="care-form" onSubmit={e => { e.preventDefault(); submit(); }}><label>희망 날짜<input type="date" required min={today ?? undefined} value={date || patient.nextDate} onChange={e => setDate(e.target.value)} /></label><label>희망 시간<select value={time || patient.nextTime} onChange={e => setTime(e.target.value)}>{["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"].map(t => <option key={t}>{t}</option>)}</select></label><div><p className="srf-scope" style={{ margin: "0 0 8px" }}>장소 {patient.prescription?.places?.length === 1 ? "(처방상 한 곳만 가능해요)" : "(이번 회차만 바뀌어요)"}</p><PlacePicker patient={patient} value={place ?? upcomingPlace(patient)} onChange={setPlace} allowed={patient.prescription?.places} name="change-place" /></div><label>변경 사유 (선택)<input value={memo} onChange={e => setMemo(e.target.value)} placeholder="예: 병원 진료와 겹쳐요" /></label><button className="btn-primary wide">변경 요청 보내기</button></form></Modal>}

    {modal === "absent" && <Modal title="참여 어려움 알리기" onClose={() => setModal(null)}><p className="modal-lead">{md(patient.nextDate)} {patient.nextTime} 일정에 참여하기 어렵다면 사유를 알려 주세요. 담당 선생님이 다음 일정을 함께 정해요.</p><form className="care-form" onSubmit={e => { e.preventDefault(); submit(); }}><fieldset className="decline-reasons"><legend className="sr">사유</legend>{absenceReasons.map(r => <label key={r}><input type="radio" name="absent" checked={reason === r} onChange={() => setReason(r)} />{r}</label>)}</fieldset>{reason === "기타" && <label>사유<input required value={memo} onChange={e => setMemo(e.target.value)} /></label>}<button className="btn-primary wide">알리기</button></form></Modal>}
</div>;
}
