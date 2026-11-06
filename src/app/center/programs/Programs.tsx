"use client";
import { useState } from "react";
import { careRepo, mutationFailed, type Program } from "@/lib/repo";
import { won } from "@/lib/data";
import { usePageValue } from "@/lib/page-view";
import { methodLabel, otherPlaces, programFor, sessionPrice } from "@/lib/center";
import { ActionBar, AdminPage, AdminTable, Badge, Card, Field, FilterBar, notify, rowGo, stop, Dropdown } from "../admin-ui";
import { useCenterCare } from "../use-center-care";

type Tab = "전체" | "신청 받는 중" | "중지";

/** 프로그램 관리: 소속 치료사의 프로그램(방문/센터, 시간, 결제 방식·금액)을 열고 고칩니다. */
export function Programs() {
  const { state, providers, programs, patients } = useCenterCare();
  const [tab, setTab] = useState<Tab>("전체");
  const [search, setSearch] = useState({ field: "전체", text: "" });
  const [editing, setEditing] = usePageValue<string>("program");
  const name = (id: string) => providers.find(e => e.id === id)?.name ?? id;
  if (editing) return <ProgramForm key={editing} program={programs.find(p => p.id === editing)} onClose={() => setEditing(null)} />;

  const used = (id: string) => patients.filter(p => p.status !== "종료" && programFor(state, p)?.id === id).length;
  const searched = programs.filter(pg => !search.text || (search.field === "치료사" ? name(pg.providerId) : search.field === "프로그램명" ? pg.title : `${pg.title} ${name(pg.providerId)}`).includes(search.text));
  const status = (pg: Program): Tab => pg.active ? "신청 받는 중" : "중지";
  const rows = searched.filter(pg => tab === "전체" || status(pg) === tab);
  async function toggle(pg: Program) {
    const r = await careRepo.saveProgram({ ...pg, active: !pg.active });
    notify(mutationFailed(r) || !r ? "바꾸지 못했어요." : pg.active ? "신청 받기를 중지했어요." : "다시 신청을 받아요.", mutationFailed(r) || !r);
  }

  return <AdminPage title="프로그램 관리" crumbs={["프로그램/예약", "프로그램 관리"]} desc="치료사 프로필에 보이는 프로그램입니다. 결제 방식은 프로그램마다 회차별 또는 이용권으로 정해요."
    action={<button className="ca-btn primary round" onClick={() => setEditing("new")}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>신규등록</button>}>
    <FilterBar tabs={(["전체", "신청 받는 중", "중지"] as Tab[]).map(t => ({ value: t, count: t === "전체" ? searched.length : searched.filter(pg => status(pg) === t).length }))} tab={tab} onTab={setTab} fields={["전체", "프로그램명", "치료사"]} onSearch={(field, text) => setSearch({ field, text })} />
    <Card flush>
      <AdminTable caption="프로그램 목록" columns={["번호", "상태", { label: "프로그램명", align: "l" }, "치료사", "진행 방식", "결제 방식", { label: "금액", align: "r" }, "이용 중", ""]} rows={rows} emptyHint="신규등록으로 프로그램을 추가해 보세요." render={(pg, no) => <tr key={pg.id} {...rowGo(() => setEditing(pg.id))}>
        <td className="muted">{no}</td><td><Badge>{status(pg)}</Badge></td><td className="l"><span className="strong">{pg.title}</span><small>{pg.minutes}분</small></td><td className="nw">{name(pg.providerId)}</td>
        <td className="nw">{methodLabel(pg)}{pg.method === "외부" && <small>다른 장소</small>}</td><td className="nw">{pg.payment === "이용권" ? `${pg.packSessions}회 이용권` : "회차별"}</td>
        <td className="r nw">{pg.payment === "이용권" && pg.packPrice ? <>{won(pg.packPrice)}<small>1회 {won(sessionPrice(pg))}</small></> : `${won(pg.price)} / 회`}</td><td className="num">{used(pg.id)}명</td>
        <td className="nw"><button className="ca-act" onClick={stop(() => setEditing(pg.id))}>수정</button> <button className="ca-act blue" onClick={stop(() => toggle(pg))}>{pg.active ? "중지" : "재개"}</button></td>
      </tr>} />
    </Card>
  </AdminPage>;
}

function ProgramForm({ program, onClose }: { program?: Program; onClose: () => void }) {
  const { center, providers } = useCenterCare();
  const [v, setV] = useState<Program>(program ?? { id: "", center: center.name, providerId: providers[0]?.id ?? "", title: "", method: "방문", minutes: 60, payment: "회차별", price: 60000, active: true });
  const [tried, setTried] = useState(false);
  const places = otherPlaces();
  const set = (patch: Partial<Program>) => setV(x => ({ ...x, ...patch }));
  const invalid = v.method === "외부" && !v.placeId || !v.title.trim() || !(v.minutes > 0) || !(v.price > 0) || v.payment === "이용권" && (!(Number(v.packSessions) > 0) || !(Number(v.packPrice) > 0));
  const perSession = v.payment === "이용권" && v.packSessions && v.packPrice ? Math.round(v.packPrice / v.packSessions) : 0;
  async function save() {
    setTried(true);
    if (invalid) return notify("빨간 표시 항목을 확인해 주세요.", true);
    const r = await careRepo.saveProgram({ ...v, price: Number(v.price), minutes: Number(v.minutes), packSessions: v.packSessions ? Number(v.packSessions) : undefined, packPrice: v.packPrice ? Number(v.packPrice) : undefined });
    if (mutationFailed(r) || !r) return notify("저장하지 못했어요.", true);
    notify(program ? "프로그램을 고쳤어요." : "프로그램을 등록했어요."); onClose();
  }
  const bad = (cond: boolean) => tried && cond ? { borderColor: "var(--ca-red)" } : undefined;
  return <AdminPage title={program ? "프로그램 수정" : "프로그램 등록"} crumbs={["프로그램/예약", "프로그램 관리", program ? "수정" : "등록"]} desc="저장하면 치료사 프로필에 바로 반영돼요." action={<button className="ca-btn" onClick={onClose}>목록</button>}>
    <div className="ca-grid2">
      <Card title="기본 정보">
        <div className="ca-form">
          <Field label="담당 치료사" required group><Dropdown label="담당 치료사" value={v.providerId} options={providers.map(e => ({ value: e.id, label: e.name, sub: `${e.license} · ${e.visit.filter(x => x !== "비대면 점검").join("/")}` }))} onChange={id => set({ providerId: id })} /></Field>
          <Field label="프로그램명" required hint="이용자가 보는 이름이에요."><input value={v.title} onChange={e => set({ title: e.target.value })} placeholder="예: 무릎 수술 후 방문 재활" style={bad(!v.title.trim())} /></Field>
          <div className="ca-field"><span>진행 장소<em>*</em></span><div className="ca-seg" role="radiogroup" aria-label="진행 장소">{(["방문", "센터", "외부"] as const).map(m => <label key={m}><input type="radio" name="method" checked={v.method === m} onChange={() => set({ method: m, ...(m === "외부" && !v.placeId ? { placeId: places[0]?.id } : {}) })} />{m === "방문" ? "자택 방문" : m === "센터" ? "센터 수업" : "다른 장소"}</label>)}</div>
            {v.method === "방문" && <small>이용자 집으로 방문해요. 주소는 신청할 때 받아요.</small>}
            {v.method === "센터" && <small>{center.name} · {center.address.replace(" (체험용 주소)", "")}</small>}</div>
          {v.method === "외부" && <Field label="장소 선택" required group hint="센터와 제휴한 공간이에요."><Dropdown label="장소 선택" value={v.placeId ?? ""} options={places.map(x => ({ value: x.id, label: x.name, sub: x.address.replace(" (체험용 주소)", "") }))} onChange={id => set({ placeId: id })} /></Field>}
          <Field label="1회 시간" required><span className="ca-unit"><input type="number" min={10} step={5} value={v.minutes} onChange={e => set({ minutes: Number(e.target.value) })} style={bad(!(v.minutes > 0))} />분</span></Field>
          <label className="ca-check"><input type="checkbox" checked={v.active} onChange={e => set({ active: e.target.checked })} /><span>치료사 프로필에 보이고 신청을 받습니다</span></label>
        </div>
      </Card>
      <Card title="결제">
        <div className="ca-form">
          <div className="ca-field"><span>결제 방식<em>*</em></span><div className="ca-seg" role="radiogroup" aria-label="결제 방식">{(["회차별", "이용권"] as const).map(m => <label key={m}><input type="radio" name="payment" checked={v.payment === m} onChange={() => set({ payment: m })} />{m === "회차별" ? "회차별 결제" : "이용권 (회차 묶음)"}</label>)}</div></div>
          <Field label="1회 금액" required><span className="ca-unit"><input type="number" min={0} step={1000} value={v.price} onChange={e => set({ price: Number(e.target.value) })} style={bad(!(v.price > 0))} />원</span></Field>
          {v.payment === "이용권" && <div className="ca-row">
            <Field label="이용권 회차" required><span className="ca-unit"><input type="number" min={1} value={v.packSessions ?? ""} onChange={e => set({ packSessions: Number(e.target.value) })} style={bad(!(Number(v.packSessions) > 0))} />회</span></Field>
            <Field label="이용권 금액" required hint={perSession ? `1회 ${won(perSession)} · 1회 금액 대비 ${Math.max(0, Math.round((1 - perSession / v.price) * 100))}% 할인` : undefined}><span className="ca-unit"><input type="number" min={0} step={1000} value={v.packPrice ?? ""} onChange={e => set({ packPrice: Number(e.target.value) })} style={bad(!(Number(v.packPrice) > 0))} />원</span></Field>
          </div>}
          {center.kind !== "의료기관" && <p className="ca-hint">의료기관이 아닌 센터는 물리치료가 아닌 운동 지도 프로그램만 열 수 있어요.</p>}
        </div>
      </Card>
    </div>
    <ActionBar info="* 표시는 꼭 입력해야 해요."><button className="ca-btn" onClick={onClose}>취소</button><button className="ca-btn primary" onClick={save}>{program ? "수정 저장" : "등록"}</button></ActionBar>
  </AdminPage>;
}
