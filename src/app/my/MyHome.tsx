"use client";
import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";
import { DoctorCheckBox, FlowSteps } from "@/components/FlowSteps";
import { usePatientAccount } from "@/lib/demo-session";
import { useToday } from "@/lib/use-today";
import { won } from "@/lib/data";
import { balanceOf, centerByName, doctorCheckOf, flowStep, methodLabel, paymentLabel, programFor } from "@/lib/center";
import { placeName, upcomingPlace } from "@/lib/places";
import { dday, md, weekday } from "./my-utils";
import { PatientSwitch } from "./PatientShell";
import { usePatientCare } from "./use-patient-care";
import "./my-home-type.css";
import "@/components/center-ui.css";

/**
 * 1차 내 관리: 지금 단계 하나 + 다음 예약 + 결제 + 바로가기.
 * 신청 → 치료사 수락 → 센터 의사 확인 → 예약 확정 → 진행 중
 */
export function MyHome() {
  const { state, patients, patient } = usePatientCare();
  const today = useToday();
  const me = usePatientAccount();

  const head = <div className="sg-profile"><div><b>{me.name} 님</b><small>{me.relation} · 관리 대상 {patients.length}명</small></div></div>;
  if (!patient) return <div className="sg my-home"><h1 className="sg-h1">내 관리</h1>{head}
    <section className="sg-card sg-empty">아직 신청한 프로그램이 없어요. <Link href="/experts">치료사 찾기</Link></section></div>;

  const step = flowStep(state, patient), program = programFor(state, patient), center = centerByName(patient.hospital);
  const balance = balanceOf(state, patient), check = doctorCheckOf(patient);
  const records = state.records.filter(r => r.patientId === patient.id && r.confirmed).sort((a, b) => b.date.localeCompare(a.date));
  const request = state.scheduleRequests.find(r => r.patientId === patient.id);
  const latestAssignment = state.assignments.find(a => a.patientId === patient.id);
  const booked = step === "예약 확정" || step === "진행 중";

  const message: Record<typeof step, { title: string; sub: string }> = {
    "치료사 수락 대기": { title: `${patient.requestedProviderName ?? latestAssignment?.providerName ?? "선생님"} 선생님이 신청을 확인하고 있어요`, sub: `희망 첫 일정 ${md(patient.nextDate)} (${weekday(patient.nextDate)}) ${patient.nextTime}` },
    "담당 배정 필요": { title: "센터가 담당 치료사를 정하고 있어요", sub: latestAssignment?.status === "거절" ? "신청한 선생님이 일정이 맞지 않아 센터가 다른 선생님을 찾고 있어요." : patient.condition },
    "의사 확인 대기": { title: "센터 의사가 첫 회차 전 확인을 하고 있어요", sub: `${patient.provider} 선생님이 수락했어요. 확인이 끝나면 예약이 확정돼요.` },
    "예약 확정": { title: "", sub: "" }, "진행 중": { title: "", sub: "" },
    "종료": { title: "프로그램이 끝났어요", sub: patient.closure?.summary ?? "" },
  };

  const quick: { href: string; icon: IconName; title: string; badge?: number }[] = [
    { href: "/my/schedule", icon: "calendar", title: "예약·일정" },
    { href: "/my/payments", icon: "file", title: "결제 내역", badge: balance.pending.length || undefined },
    { href: "/experts", icon: "search", title: "치료사 찾기" },
  ];

  return <div className="sg my-home">
    <h1 className="sg-h1">내 관리</h1>
    {head}
    <PatientSwitch />

    {balance.pending.length > 0 && <div className="sg-notice" role="status"><div className="sg-notice-row"><Icon name="bell" size={16} /><span>결제할 금액 {won(balance.pendingAmount)}이 있어요.</span><Link href="/my/payments">결제하기<Icon name="chevron" size={13} /></Link></div></div>}
    {request?.status === "조정 필요" && <div className="sg-notice" role="status"><div className="sg-notice-row"><Icon name="bell" size={16} /><span>요청한 일정에 조정이 필요해요.</span><Link href="/my/schedule">확인하기<Icon name="chevron" size={13} /></Link></div></div>}

    <section className="sg-card sg-feature">
      {booked ? <Link className="sg-row" href="/my/schedule">
        <span><small className="sg-state on">{step === "예약 확정" ? "첫 회차 예약 확정" : "다음 회차"} · {dday(today, patient.nextDate)}</small><b className="sg-big">{md(patient.nextDate)} ({weekday(patient.nextDate)}) {patient.nextTime}</b><small>{placeName(upcomingPlace(patient))} · {patient.provider} 선생님{request?.status === "요청" ? " · 변경 요청 확인 중" : ""}</small></span>
        <span className="sg-right">일정<Icon name="chevron" size={14} /></span>
      </Link> : <div className="sg-row">
        <span><small className={`sg-state ${step === "종료" ? "" : "warn"}`}>{step}</small><b>{message[step].title}</b><small>{message[step].sub}</small></span>
      </div>}
      <FlowSteps step={step} />
      {booked && <p className="sg-progress-label" style={{ marginTop: 12 }}><span>{program ? paymentLabel(program) : patient.condition}</span><b>진행 {patient.completed}회{balance.paidSessions ? ` · 남은 회차 ${Math.max(0, balance.remaining)}회` : ""}</b></p>}
    </section>

    <nav className="sg-quick-menu" aria-label="바로가기">
      {quick.map(q => <Link key={q.title} href={q.href}><span className="sg-qicon"><Icon name={q.icon} size={20} />{q.badge ? <em>{q.badge}</em> : null}</span>{q.title}</Link>)}
    </nav>

    <h2 className="sg-title">프로그램</h2>
    <section className="sg-card">
      <dl className="cx-kv">
        <dt>센터</dt><dd>{patient.hospital}{center ? ` · ${center.kind}` : ""}</dd>
        <dt>프로그램</dt><dd>{program ? `${program.title} (${methodLabel(program)} · ${program.minutes}분)` : "-"}</dd>
        <dt>치료사</dt><dd>{patient.provider || (patient.requestedProviderName ? `${patient.requestedProviderName} (수락 대기)` : "정하는 중")}</dd>
        <dt>이용자</dt><dd>{patient.name} · {patient.condition}</dd>
      </dl>
    </section>
    <div style={{ marginTop: 10 }}><DoctorCheckBox check={check} /></div>

    {records.length > 0 && <>
      <h2 className="sg-title">최근 회차</h2>
      <section className="sg-card"><ul className="cx-list">{records.slice(0, 3).map(r => <li key={r.id}><b>{md(r.date)} ({weekday(r.date)}) · {r.sessionNo ? `${r.sessionNo}회차` : r.title}</b><small>{r.content}</small></li>)}</ul></section>
    </>}
    <p className="sg-foot">진료·처방 관련 문의는 {patient.hospital}로 해 주세요.</p>
  </div>;
}
