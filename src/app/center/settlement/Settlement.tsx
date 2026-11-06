"use client";
import { useState } from "react";
import { won } from "@/lib/data";
import { useToday } from "@/lib/use-today";
import { PROVIDER_SHARE, settlement } from "@/lib/center";
import { AdminPage, AdminTable, Card, Kpi, Kpis, dateTime } from "../admin-ui";
import { useCenterCare } from "../use-center-care";

const shift = (month: string, n: number) => { const d = new Date(`${month}-01T00:00:00`); d.setMonth(d.getMonth() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

/** 치료사 정산: 확정된 회차 × 1회 금액 × 정산 비율 (체험용 가정) */
export function Settlement() {
  const { state, providers } = useCenterCare();
  const today = useToday();
  const [month, setMonth] = useState<string | null>(null);
  const thisMonth = (today ?? "2026-11-01").slice(0, 7), shown = month ?? thisMonth;
  const byProvider = providers.map(e => ({ e, ...settlement(state, e.id, shown) })).sort((a, b) => b.gross - a.gross);
  const sessions = byProvider.flatMap(r => r.rows.map(x => ({ ...x, provider: r.e.name }))).sort((a, b) => b.record.date.localeCompare(a.record.date));
  const gross = byProvider.reduce((n, r) => n + r.gross, 0), share = byProvider.reduce((n, r) => n + r.share, 0);
  const label = `${shown.slice(0, 4)}년 ${Number(shown.slice(5))}월`;
  const n = (v: number) => won(v).replace("원", "");

  return <AdminPage title="치료사 정산" crumbs={["결제/정산", "치료사 정산"]} desc={`확정된 회차 × 1회 금액 × 정산 비율 ${PROVIDER_SHARE * 100}% (체험용 가정값)`}
    action={<div className="ca-seg" role="group" aria-label="정산 월"><label><button type="button" className="ca-btn ghost sm" onClick={() => setMonth(shift(shown, -1))} aria-label="이전 달">‹</button></label><label style={{ fontWeight: 700 }}>{label}</label><label><button type="button" className="ca-btn ghost sm" disabled={shown >= thisMonth} onClick={() => setMonth(shift(shown, 1))} aria-label="다음 달">›</button></label></div>}>
    <Kpis>
      <Kpi label="진행 회차" value={sessions.length} unit="회" note={label} />
      <Kpi label="회차 금액 합계" value={n(gross)} unit="원" />
      <Kpi label="치료사 정산 예정" value={n(share)} unit="원" tone="amber" />
      <Kpi label="센터 몫" value={n(gross - share)} unit="원" tone="green" />
    </Kpis>
    <Card title="치료사별 정산" sub={label} flush>
      <AdminTable caption="치료사별 정산" bar={false} columns={["치료사", "진행 회차", { label: "회차 금액 합계", align: "r" }, { label: "정산 예정", align: "r" }, { label: "센터 몫", align: "r" }]} rows={byProvider} render={r => <tr key={r.e.id}><td className="nw"><span className="strong">{r.e.name}</span></td><td className="num">{r.rows.length}회</td><td className="r">{won(r.gross)}</td><td className="r"><span className="strong">{won(r.share)}</span></td><td className="r">{won(r.gross - r.share)}</td></tr>} />
    </Card>
    <Card title="회차별 내역" sub={`${sessions.length}건`} flush>
      <AdminTable caption="회차별 정산 내역" bar={false} columns={["진행일", "치료사", "회원명", { label: "프로그램", align: "l" }, "회차", { label: "1회 금액", align: "r" }, { label: "정산 예정", align: "r" }]} rows={sessions} empty="이 달에 확정된 회차가 없어요." emptyHint="이전 달을 눌러 확인해 보세요." render={x => <tr key={x.record.id}><td className="nw">{dateTime(x.record.date)}</td><td className="nw">{x.provider}</td><td className="nw">{x.patient?.name}</td><td className="l clip" title={x.program?.title}>{x.program?.title ?? "-"}</td><td className="num">{x.record.sessionNo ?? "-"}회</td><td className="r">{won(x.gross)}</td><td className="r">{won(x.share)}</td></tr>} />
    </Card>
  </AdminPage>;
}
