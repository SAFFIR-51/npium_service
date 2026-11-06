"use client";
import Link from "next/link";
import { useState } from "react";
import { careRepo, mutationFailed, type Patient } from "@/lib/repo";
import { won } from "@/lib/data";
import { usePageItem } from "@/lib/page-view";
import { balanceOf, doctorCheckOf, flowStep, paymentLabel, programFor, ymd, type FlowStep } from "@/lib/center";
import { placeAddress, placeName, upcomingPlace } from "@/lib/places";
import { AdminModal, AdminPage, AdminTable, Badge, Card, Dl, Field, FilterBar, Steps, dateTime, notify, rowGo, sexText, stop, Dropdown } from "../admin-ui";
import { useCenterCare } from "../use-center-care";

type Tab = "전체" | FlowStep;
const TABS: Tab[] = ["전체", "치료사 수락 대기", "담당 배정 필요", "의사 확인 대기", "예약 확정", "진행 중", "종료"];

/** 회원 관리: 단계 탭 → 목록(행을 누르면 상세) → 상세(담당 치료사·결제·회차 기록·이력) */
export function Members() {
  const { state, patients } = useCenterCare();
  const [tab, setTab] = useState<Tab>("전체");
  const [search, setSearch] = useState({ field: "전체", text: "" });
  const [selected, setSelected] = usePageItem("member", patients, p => p.id);
  if (selected) return <MemberDetail patient={selected} onClose={() => setSelected(null)} />;

  const match = (p: Patient) => {
    const t = search.text; if (!t) return true;
    const by: Record<string, string> = { 회원명: p.name, 치료사: `${p.provider} ${p.requestedProviderName ?? ""}`, "현재 상태": p.condition };
    return (by[search.field] ?? `${p.name} ${p.provider} ${p.requestedProviderName ?? ""} ${p.condition}`).includes(t);
  };
  const searched = patients.filter(match);
  const rows = searched.filter(p => tab === "전체" || flowStep(state, p) === tab);

  return <AdminPage title="회원 관리" crumbs={["회원/확인", "회원 관리"]} desc="치료사에게 신청한 이용자를 단계별로 보고, 담당 치료사와 결제를 관리합니다.">
    <FilterBar tabLabel="진행 단계" tabs={TABS.map(t => ({ value: t, count: t === "전체" ? searched.length : searched.filter(p => flowStep(state, p) === t).length }))} tab={tab} onTab={setTab} fields={["전체", "회원명", "치료사", "현재 상태"]} onSearch={(field, text) => setSearch({ field, text })} />
    <Card flush>
      <AdminTable caption="회원 목록" columns={["번호", "단계", "회원명", { label: "현재 상태", align: "l" }, { label: "프로그램", align: "l" }, "치료사", "일정", "남은 회차", ""]} rows={rows} emptyHint="다른 단계나 검색어로 찾아보세요." render={(p, no) => {
        const pg = programFor(state, p), b = balanceOf(state, p), step = flowStep(state, p);
        return <tr key={p.id} {...rowGo(() => setSelected(p))}>
          <td className="muted">{no}</td><td className="nw"><Badge>{step}</Badge></td>
          <td className="nw"><span className="strong">{p.name}</span><small>{p.age}세{sexText(p.sex)}</small></td>
          <td className="l clip" title={p.condition}>{p.condition}</td>
          <td className="l clip" title={pg?.title}>{pg?.title ?? "-"}<small>{pg ? paymentLabel(pg) : ""}</small></td>
          <td className="nw">{p.provider || (p.requestedProviderName ? <>{p.requestedProviderName}<small>수락 대기</small></> : <span className="muted">미정</span>)}</td>
          <td className="nw">{dateTime(p.nextDate, p.nextTime)}{p.status !== "진행 중" && <small>희망 일정</small>}</td>
          <td className="nw num">{p.status === "진행 중" ? b.paidSessions ? `${Math.max(0, b.remaining)}회` : <Badge>결제 필요</Badge> : "-"}</td>
          <td><button className="ca-act" onClick={stop(() => setSelected(p))}>보기</button></td>
        </tr>;
      }} />
    </Card>
  </AdminPage>;
}

function MemberDetail({ patient: p, onClose }: { patient: Patient; onClose: () => void }) {
  const { state, me, providers } = useCenterCare();
  const step = flowStep(state, p), pg = programFor(state, p), b = balanceOf(state, p), check = doctorCheckOf(p);
  const records = state.records.filter(r => r.patientId === p.id && r.confirmed).sort((a, b) => b.date.localeCompare(a.date));
  const history = state.assignments.filter(a => a.patientId === p.id);
  const [assigning, setAssigning] = useState(false);
  const [providerId, setProviderId] = useState(""), [reason, setReason] = useState("");
  const signer = `${me.name} (${me.title})`;

  async function change() {
    const target = providers.find(e => e.id === providerId);
    if (!target || !reason.trim()) return;
    const r = await careRepo.changeProvider(p.id, { id: target.id, name: target.name }, reason, signer);
    if (mutationFailed(r) || !r) return notify("바꾸지 못했어요. 같은 시간에 그 치료사의 다른 예약이 있는지 확인해 주세요.", true);
    notify(`${target.name} 치료사로 정했어요.${p.status === "배정 대기" ? " 다음은 의사 확인이에요." : ""}`);
    setAssigning(false); setProviderId(""); setReason("");
  }
  async function requestPay(kind: "회차" | "이용권") {
    if (!pg) return;
    const r = await careRepo.requestPayment(p.id, pg.id, kind, signer);
    notify(mutationFailed(r) || !r ? "이미 결제 대기 중인 요청이 있어요." : `${kind === "이용권" ? "이용권" : "1회"} 결제 요청을 보냈어요.`, mutationFailed(r) || !r);
  }

  return <AdminPage title={p.name} badge={<Badge>{step}</Badge>} crumbs={["회원/확인", "회원 관리", "상세"]} desc={`${p.age}세${sexText(p.sex)} · ${p.condition}`}
    action={<><button className="ca-btn" onClick={onClose}>목록</button>{p.status !== "종료" && <button className="ca-btn" onClick={() => setAssigning(true)}>{p.providerId ? "담당 변경" : "담당 정하기"}</button>}{step === "의사 확인 대기" && <Link className="ca-btn primary" href={`/center/doctor?view=check&item=${p.id}`}>의사 확인하기</Link>}</>}>
    <Card><Steps step={step} /></Card>
    <div className="ca-grid2">
      <Card title="기본 정보">
        <Dl items={[
          ["프로그램", pg ? `${pg.title} · ${pg.minutes}분` : ""],
          ["결제 방식", pg ? paymentLabel(pg) : ""],
          ["담당 치료사", p.provider || (p.requestedProviderName ? `${p.requestedProviderName} (수락 대기)` : "미정")],
          ["일정", `${dateTime(p.nextDate, p.nextTime)}${p.status === "진행 중" ? "" : " (희망)"}`],
          ["장소", `${placeName(upcomingPlace(p))} · ${placeAddress(p)}`],
          ["목표", p.goal], ["신청 시 주의", p.precautions], ["신청자", p.applicant],
        ]} />
      </Card>
      <Card title="센터 의사 확인" action={check ? <span className="ca-hint" style={{ margin: 0 }}>{check.doctor.split(" ")[0]} · {ymd(check.at)}</span> : undefined}>
        {check ? <Dl items={[
          ["소견", check.opinion],
          ["하지 않을 운동", check.contraindications.length ? <div className="ca-chips">{check.contraindications.map(c => <span key={c} className="ca-chip contra">{c}</span>)}</div> : ""],
          ["주의사항", check.cautions.length ? <div className="ca-chips">{check.cautions.map(c => <span key={c} className="ca-chip caution">{c}</span>)}</div> : ""],
        ]} /> : <p className="ca-hint" style={{ margin: 0 }}>아직 확인 전이에요. 센터 의사가 확인해야 예약이 확정됩니다.</p>}
      </Card>
    </div>

    <Card title="결제" sub={`결제 ${b.paidSessions}회 · 진행 ${b.used}회 · 남은 ${Math.max(0, b.remaining)}회`} flush action={p.status === "진행 중" && pg ? <>{pg.payment === "이용권" && <button className="ca-btn sm" onClick={() => requestPay("이용권")}>이용권 결제 요청</button>}<button className="ca-btn sm" onClick={() => requestPay("회차")}>1회 결제 요청</button></> : undefined}>
      <AdminTable caption="결제 내역" bar={false} pageSize={5} columns={["상태", "요청일", "구분", { label: "금액", align: "r" }, "결제일", "결제 수단"]} rows={b.payments} empty="결제 내역이 없어요." emptyHint="의사 확인이 끝나면 첫 결제 요청이 자동으로 만들어져요." render={x => <tr key={x.id}><td><Badge>{x.status}</Badge></td><td className="nw">{ymd(x.createdAt)}</td><td className="nw">{x.kind === "이용권" ? `${x.sessions}회 이용권` : "1회"}</td><td className="r nw">{won(x.amount)}</td><td className="nw">{x.paidAt ? ymd(x.paidAt) : "-"}</td><td className="nw">{x.method ?? "-"}</td></tr>} />
    </Card>

    <Card title="회차 기록" sub={`${records.length}건`} flush>
      <AdminTable caption="회차 기록" bar={false} pageSize={5} columns={["진행일", "회차", "참여", "시간", { label: "내용", align: "l" }, { label: "다음 계획", align: "l" }]} rows={records} empty="아직 기록이 없어요." render={r => <tr key={r.id}><td className="nw">{dateTime(r.date)}</td><td className="nw">{r.sessionNo ?? "-"}회</td><td><Badge tone={r.attendance === "미참여" ? "grey" : r.attendance === "부분 참여" ? "amber" : "green"}>{r.attendance ?? "참여"}</Badge></td><td className="nw">{r.durationMin ? `${r.durationMin}분` : "-"}</td><td className="l">{r.content}</td><td className="l muted">{r.next || "-"}</td></tr>} />
    </Card>

    <Card title="담당 이력" flush>
      <AdminTable caption="담당 이력" bar={false} pageSize={5} columns={["일시", "치료사", "상태", "처리", { label: "사유", align: "l" }]} rows={history} empty="이력이 없어요." render={a => <tr key={a.id}><td className="nw">{ymd(a.createdAt)}</td><td className="nw">{a.providerName}</td><td><Badge>{a.status}</Badge></td><td className="nw">{a.by ?? "-"}</td><td className="l">{a.reason ?? a.adjustmentReason ?? ""}</td></tr>} />
    </Card>

    {assigning && <AdminModal title={p.providerId ? "담당 치료사 변경" : "담당 치료사 정하기"} desc={`현재 담당: ${p.provider || p.requestedProviderName || "없음"}`} onClose={() => setAssigning(false)}
      actions={<><button className="ca-btn" onClick={() => setAssigning(false)}>취소</button><button className="ca-btn primary" disabled={!providerId || !reason.trim()} onClick={change}>{p.providerId ? "변경" : "정하기"}</button></>}>
      <div className="ca-form">
        <Field label="치료사" required group><Dropdown label="치료사" value={providerId} options={providers.filter(e => e.id !== p.providerId).map(e => ({ value: e.id, label: e.name, sub: `${e.license} · ${e.visit.filter(v => v !== "비대면 점검").join("/")}` }))} onChange={setProviderId} /></Field>
        <Field label="사유" required hint="담당 이력에 남아요."><input value={reason} onChange={e => setReason(e.target.value)} placeholder="예: 신청한 치료사 일정 불가" /></Field>
      </div>
    </AdminModal>}
  </AdminPage>;
}
