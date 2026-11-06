"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { careRepo, mutationFailed, type Patient } from "@/lib/repo";
import { usePageItem } from "@/lib/page-view";
import { doctorCheckOf, doctorLabel, flowStep, programFor, ymd } from "@/lib/center";
import { placeName, upcomingPlace } from "@/lib/places";
import { ActionBar, AdminModal, AdminPage, AdminTable, Badge, Card, Dl, Field, FilterBar, dateTime, notify, rowGo, sexText, stop, Dropdown } from "../admin-ui";
import { useCenterCare } from "../use-center-care";

const CONTRA_PICKS = ["고강도 저항 운동", "깊은 쪼그려 앉기", "보조 없는 계단 내려가기", "허리 비틀기·과신전", "점프·달리기", "목 과신전"];
const TIMES = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
const lines = (v: string) => v.split(/\n|,/).map(x => x.trim()).filter(Boolean);
type Tab = "확인 대기" | "보완 요청" | "확인 완료";

/**
 * 의사 확인 (첫 회차 전 필수).
 * 현행 의료기사법상 물리치료사는 의사의 지도 아래 일합니다. 확인해야 예약이 확정되고 결제 요청이 나갑니다.
 */
export function DoctorReview() {
  const { state, patients } = useCenterCare();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("확인 대기");
  const [search, setSearch] = useState({ field: "전체", text: "" });
  const queue = patients.filter(p => flowStep(state, p) === "의사 확인 대기");
  const [selected, setSelected] = usePageItem("check", queue, p => p.id);
  if (selected) return <CheckForm patient={selected} onClose={() => setSelected(null)} />;

  const stateOf = (p: Patient): Tab | null => flowStep(state, p) === "의사 확인 대기" ? p.approval?.status === "반려" ? "보완 요청" : "확인 대기" : doctorCheckOf(p) ? "확인 완료" : null;
  const searched = patients.filter(p => stateOf(p) && (!search.text || (search.field === "회원명" ? p.name : search.field === "치료사" ? p.provider : `${p.name} ${p.provider} ${p.condition}`).includes(search.text)));
  const rows = searched.filter(p => stateOf(p) === tab).sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  const open = (p: Patient) => stateOf(p) === "확인 완료" ? router.push(`/center/members?view=member&item=${p.id}`) : setSelected(p);

  return <AdminPage title="의사 확인" crumbs={["회원/확인", "의사 확인"]} desc="치료사가 수락한 신청을 첫 회차 전에 확인합니다. 확인해야 예약이 확정되고 결제 요청이 나갑니다.">
    <div className="ca-note">현행법상 물리치료사는 의사의 지도 아래에서 일해요. 방문 재활은 법적 해석이 분명하지 않으니 방문 회차는 지도 의사를 꼭 기록으로 남겨 주세요.</div>
    <FilterBar tabs={(["확인 대기", "보완 요청", "확인 완료"] as Tab[]).map(t => ({ value: t, count: searched.filter(p => stateOf(p) === t).length }))} tab={tab} onTab={setTab} fields={["전체", "회원명", "치료사"]} onSearch={(field, text) => setSearch({ field, text })} />
    <Card flush>
      <AdminTable caption="의사 확인 목록" columns={["번호", "상태", "회원명", { label: "현재 상태", align: "l" }, "치료사", { label: "프로그램", align: "l" }, "희망 첫 일정", "확인 의사", ""]} rows={rows}
        empty={tab === "확인 대기" ? "확인할 신청이 없어요." : "해당하는 회원이 없어요."} emptyHint={tab === "확인 대기" ? "치료사가 신청을 수락하면 여기에 보여요." : undefined}
        render={(p, no) => { const s = stateOf(p)!, c = doctorCheckOf(p); return <tr key={p.id} {...rowGo(() => open(p))}>
          <td className="muted">{no}</td><td><Badge>{s}</Badge></td><td className="nw"><span className="strong">{p.name}</span><small>{p.age}세{sexText(p.sex)}</small></td>
          <td className="l clip" title={p.condition}>{p.condition}{s === "보완 요청" && <small>요청: {p.approval?.reason}</small>}</td><td className="nw">{p.provider}</td>
          <td className="l clip" title={programFor(state, p)?.title}>{programFor(state, p)?.title ?? "-"}</td><td className="nw">{dateTime(p.nextDate, p.nextTime)}</td>
          <td className="nw">{c ? <>{c.doctor.split(" ")[0]}<small>{ymd(c.at)}</small></> : <span className="muted">-</span>}</td>
          <td>{s === "확인 완료" ? <button className="ca-act blue" onClick={stop(() => open(p))}>보기</button> : <button className="ca-act" onClick={stop(() => open(p))}>확인하기</button>}</td>
        </tr>; }} />
    </Card>
  </AdminPage>;
}

function CheckForm({ patient: p, onClose }: { patient: Patient; onClose: () => void }) {
  const { state, me, center } = useCenterCare();
  const doctors = center.doctors.map(doctorLabel);
  const [doctor, setDoctor] = useState(doctors.find(d => d.startsWith(me.name)) ?? doctors[0]);
  const [opinion, setOpinion] = useState("");
  const [contra, setContra] = useState<string[]>([]);
  const [extra, setExtra] = useState("");
  const [cautions, setCautions] = useState(p.precautions);
  const [date, setDate] = useState(p.nextDate), [time, setTime] = useState(p.nextTime);
  const [rejecting, setRejecting] = useState(false), [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const pg = programFor(state, p);
  const missing = !opinion.trim() || !date || !time;

  async function confirm() {
    setTried(true);
    if (missing) return notify("의사 소견과 첫 회차 일정을 입력해 주세요.", true);
    const r = await careRepo.confirmByDoctor(p.id, { doctor, opinion, contraindications: [...contra, ...lines(extra)], cautions: lines(cautions) }, date, time);
    if (mutationFailed(r) || !r) return notify("확인하지 못했어요. 같은 시간에 치료사의 다른 예약이 있는지 확인해 주세요.", true);
    notify(`${p.name} 님 예약을 확정했어요. 결제 요청도 보냈어요.`); onClose();
  }
  async function sendBack() {
    if (!reason.trim()) return;
    if (mutationFailed(await careRepo.rejectPlan(p.id, doctor, reason.trim()))) return notify("저장하지 못했어요.", true);
    notify("보완 요청을 남겼어요."); setRejecting(false); onClose();
  }

  return <AdminPage title={`${p.name} 의사 확인`} badge={<Badge>{p.approval?.status === "반려" ? "보완 요청" : "확인 대기"}</Badge>} crumbs={["회원/확인", "의사 확인", "확인하기"]} desc={`${p.age}세${sexText(p.sex)} · ${p.condition}`} action={<button className="ca-btn" onClick={onClose}>목록</button>}>
    {p.approval?.status === "반려" && <div className="ca-note">이전 보완 요청: {p.approval.reason} ({ymd(p.approval.at)})</div>}
    <div className="ca-grid2">
      <Card title="신청 내용">
        <Dl items={[["담당 치료사", `${p.provider} (수락)`], ["프로그램", pg ? `${pg.title} · ${pg.minutes}분` : ""], ["장소", placeName(upcomingPlace(p))], ["희망 첫 일정", dateTime(p.nextDate, p.nextTime)], ["목표", p.goal], ["신청 시 주의", p.precautions], ["신청자", p.applicant]]} />
      </Card>
      <Card title="확인·지도 내용">
        <div className="ca-form">
          <Field label="확인 의사" required group><Dropdown label="확인 의사" value={doctor} options={doctors} onChange={setDoctor} /></Field>
          <Field label="의사 소견" required hint="치료사와 이용자에게 그대로 보여요."><textarea value={opinion} onChange={e => setOpinion(e.target.value)} placeholder="상태 확인 내용과 진행해도 되는 범위" aria-invalid={tried && !opinion.trim()} style={tried && !opinion.trim() ? { borderColor: "var(--ca-red)" } : undefined} /></Field>
          <div className="ca-field"><span>하지 않을 운동</span>
            <div className="ca-chips" role="group" aria-label="하지 않을 운동 고르기">{CONTRA_PICKS.map(c => <button type="button" key={c} className="ca-chip" aria-pressed={contra.includes(c)} onClick={() => setContra(v => v.includes(c) ? v.filter(x => x !== c) : [...v, c])}>{c}</button>)}</div>
            <input value={extra} onChange={e => setExtra(e.target.value)} placeholder="직접 추가 (쉼표로 구분)" aria-label="하지 않을 운동 직접 추가" />
            <small>치료사가 회차 기록을 쓸 때 하지 않았는지 확인해요.</small>
          </div>
          <Field label="주의사항" hint="한 줄에 하나씩 적어요."><textarea value={cautions} onChange={e => setCautions(e.target.value)} /></Field>
          <div className="ca-row">
            <Field label="첫 회차 날짜" required><input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
            <Field label="시간" required group><Dropdown label="첫 회차 시간" value={time} options={[...new Set([time, ...TIMES])].sort()} onChange={setTime} /></Field>
          </div>
        </div>
      </Card>
    </div>
    <ActionBar info={`확인하면 예약이 확정되고 결제 요청(${pg?.payment === "이용권" ? `${pg.packSessions}회 이용권` : "1회"})이 이용자에게 보여요.`}>
      <button className="ca-btn danger" onClick={() => setRejecting(true)}>보완 요청</button>
      <button className="ca-btn primary" onClick={confirm}>확인하고 예약 확정</button>
    </ActionBar>

    {rejecting && <AdminModal title="보완 요청" desc="진행하기 어렵거나 자료가 더 필요할 때 사유를 남겨요. 회원은 의사 확인 대기로 남아요." onClose={() => setRejecting(false)}
      actions={<><button className="ca-btn" onClick={() => setRejecting(false)}>취소</button><button className="ca-btn primary" disabled={!reason.trim()} onClick={sendBack}>보내기</button></>}>
      <Field label="사유" required><input autoFocus value={reason} onChange={e => setReason(e.target.value)} placeholder="예: 수술 병원 소견서 확인 필요" /></Field>
    </AdminModal>}
  </AdminPage>;
}
