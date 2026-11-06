"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { careRepo, mutationFailed, type Payment } from "@/lib/repo";
import { won } from "@/lib/data";
import { useToday } from "@/lib/use-today";
import { programById, ymd } from "@/lib/center";
import { AdminModal, AdminPage, AdminTable, Badge, Card, Dl, Field, FilterBar, Kpi, Kpis, notify, rowGo, stop, Dropdown } from "../admin-ui";
import { useCenterCare } from "../use-center-care";

type Tab = "전체" | "결제 대기" | "결제 완료";
const METHODS = ["카드 (센터 현장)", "현금", "계좌이체"];

/** 결제 내역: 이용권·회차 결제. 결제 연동 전이라 현장 결제는 직접 완료로 표시합니다. */
export function Billing() {
  const { state, patients, payments } = useCenterCare();
  const today = useToday(), router = useRouter();
  const [tab, setTab] = useState<Tab>("결제 대기");
  const [search, setSearch] = useState({ field: "전체", text: "" });
  const [paying, setPaying] = useState<Payment | null>(null);
  const [method, setMethod] = useState(METHODS[0]);
  const month = (today ?? "").slice(0, 7);
  const name = (id: string) => patients.find(p => p.id === id)?.name ?? "";
  const title = (x: Payment) => programById(state, x.programId)?.title ?? "-";
  const live = payments.filter(x => x.status !== "취소");
  const searched = live.filter(x => !search.text || (search.field === "회원명" ? name(x.patientId) : search.field === "프로그램명" ? title(x) : `${name(x.patientId)} ${title(x)}`).includes(search.text));
  const rows = searched.filter(x => tab === "전체" || x.status === tab).sort((a, b) => Number(b.status === "결제 대기") - Number(a.status === "결제 대기") || b.createdAt.localeCompare(a.createdAt));
  const sum = (list: Payment[]) => won(list.reduce((n, x) => n + x.amount, 0)).replace("원", "");
  const pending = live.filter(x => x.status === "결제 대기"), paidMonth = live.filter(x => x.status === "결제 완료" && x.paidAt?.startsWith(month));

  async function markPaid() {
    if (!paying) return;
    const r = await careRepo.markPaid(paying.id, method);
    if (mutationFailed(r) || !r) return notify("처리하지 못했어요.", true);
    notify(`${name(paying.patientId)} 님 ${won(paying.amount)} 결제 완료로 표시했어요.`); setPaying(null);
  }

  return <AdminPage title="결제 내역" crumbs={["결제/정산", "결제 내역"]} desc="회원의 이용권·회차 결제입니다. 결제 연동 전이라 현장·계좌 결제는 확인 후 직접 완료로 표시해요.">
    <Kpis>
      <Kpi label="결제 대기" value={sum(pending)} unit="원" note={`${pending.length}건`} tone={pending.length ? "amber" : undefined} />
      <Kpi label="이번 달 결제 완료" value={sum(paidMonth)} unit="원" note={`${paidMonth.length}건`} tone="green" />
      <Kpi label="누적 결제 완료" value={sum(live.filter(x => x.status === "결제 완료"))} unit="원" />
      <Kpi label="전체 결제 건수" value={live.length} unit="건" />
    </Kpis>
    <FilterBar tabs={(["결제 대기", "결제 완료", "전체"] as Tab[]).map(t => ({ value: t, count: t === "전체" ? searched.length : searched.filter(x => x.status === t).length }))} tab={tab} onTab={setTab} fields={["전체", "회원명", "프로그램명"]} onSearch={(field, text) => setSearch({ field, text })} />
    <Card flush>
      <AdminTable caption="결제 내역" columns={["번호", "상태", "요청일", "회원명", { label: "프로그램", align: "l" }, "구분", { label: "금액", align: "r" }, "결제일", "결제 수단", ""]} rows={rows} empty={tab === "결제 대기" ? "결제 대기 중인 건이 없어요." : "결제 내역이 없어요."} render={(x, no) => <tr key={x.id} {...rowGo(() => router.push(`/center/members?view=member&item=${x.patientId}`))}>
        <td className="muted">{no}</td><td><Badge>{x.status}</Badge></td><td className="nw">{ymd(x.createdAt)}</td><td className="nw"><span className="strong">{name(x.patientId)}</span></td><td className="l clip" title={title(x)}>{title(x)}</td>
        <td className="nw">{x.kind === "이용권" ? `${x.sessions}회 이용권` : "1회"}</td><td className="r nw"><span className="strong">{won(x.amount)}</span></td><td className="nw">{x.paidAt ? ymd(x.paidAt) : <span className="muted">-</span>}</td><td className="nw">{x.method ?? <span className="muted">-</span>}</td>
        <td>{x.status === "결제 대기" ? <button className="ca-act" onClick={stop(() => { setMethod(METHODS[0]); setPaying(x); })}>완료 표시</button> : null}</td>
      </tr>} />
    </Card>

    {paying && <AdminModal title="결제 완료 표시" desc="받은 결제를 확인한 뒤 표시해 주세요. 표시하면 되돌릴 수 없어요." onClose={() => setPaying(null)}
      actions={<><button className="ca-btn" onClick={() => setPaying(null)}>취소</button><button className="ca-btn primary" onClick={markPaid}>결제 완료</button></>}>
      <div className="ca-form">
        <Dl items={[["회원", name(paying.patientId)], ["구분", paying.kind === "이용권" ? `${paying.sessions}회 이용권` : "1회"], ["금액", <b key="a">{won(paying.amount)}</b>]]} />
        <Field label="결제 수단" required group><Dropdown label="결제 수단" value={method} options={METHODS} onChange={setMethod} /></Field>
      </div>
    </AdminModal>}
  </AdminPage>;
}
