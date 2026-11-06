"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { FLOW_STEPS, flowIndex, type FlowStep } from "@/lib/center";

/* ── 페이지 제목: 경로(작게) → 제목 + 상태 배지 → 설명, 오른쪽에 주요 버튼 ── */
export function AdminPage({ title, crumbs, desc, badge, action, children }: { title: string; crumbs: string[]; desc?: string; badge?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return <>
    <header className="ca-head">
      <div className="ca-head-text">
        <nav className="ca-crumb" aria-label="현재 위치">{["홈", ...crumbs].map((c, i) => <span key={`${c}-${i}`}>{c}</span>)}</nav>
        <h1>{title}{badge}</h1>
        {desc && <p className="ca-head-desc">{desc}</p>}
      </div>
      {action && <div className="ca-head-action">{action}</div>}
    </header>
    {children}
  </>;
}

export function Card({ title, sub, action, flush, children }: { title?: string; sub?: string; action?: ReactNode; flush?: boolean; children: ReactNode }) {
  return <section className={`ca-card ${flush ? "flush" : ""}`}>
    {title && <div className="ca-card-head"><h2>{title}</h2>{sub && <small>{sub}</small>}{action && <div className="ca-head-action">{action}</div>}</div>}
    {children}
  </section>;
}

export function Kpis({ children }: { children: ReactNode }) { return <div className="ca-kpis">{children}</div>; }
export function Kpi({ label, value, unit, note, tone, href }: { label: string; value: ReactNode; unit?: string; note?: string; tone?: "red" | "amber" | "green"; href?: string }) {
  const body = <><span className="ca-kpi-label"><i />{label}</span><b>{value}{unit && <span>{unit}</span>}</b>{note && <small>{note}</small>}</>;
  return href ? <Link href={href} className={`ca-kpi ${tone ?? ""}`}>{body}</Link> : <div className={`ca-kpi ${tone ?? ""}`}>{body}</div>;
}

/* ── 필터: 상태 탭(한 번 누르면 바로 걸림, 건수 표시) + 검색 ── */
export type TabItem<T extends string> = { value: T; label?: string; count?: number };
export function FilterBar<T extends string>({ tabLabel = "상태", tabs, tab, onTab, fields, onSearch }: {
  tabLabel?: string; tabs?: TabItem<T>[]; tab?: T; onTab?: (v: T) => void;
  fields: readonly string[]; onSearch: (field: string, text: string) => void;
}) {
  const [field, setField] = useState(fields[0]), [text, setText] = useState("");
  return <form className="ca-filter" role="search" onSubmit={e => { e.preventDefault(); onSearch(field, text.trim()); }}>
    {tabs && onTab && <div className="ca-filter-row"><span className="ca-filter-label">{tabLabel}</span><div className="ca-tabs" role="group" aria-label={tabLabel}>
      {tabs.map(t => <button type="button" key={t.value} className="ca-tab" aria-pressed={t.value === tab} onClick={() => onTab(t.value)}>{t.label ?? t.value}{t.count !== undefined && <em>{t.count}</em>}</button>)}
    </div></div>}
    <div className="ca-filter-row"><span className="ca-filter-label">검색</span><div className="ca-search-field">
      <Dropdown label="검색 대상" variant="pill" value={field} options={[...fields]} onChange={setField} />
      <input type="search" aria-label="검색어" placeholder="검색어를 입력하고 Enter" value={text} onChange={e => { setText(e.target.value); if (!e.target.value) onSearch(field, ""); }} />
      <button className="ca-search-btn" type="submit"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg><span className="t">검색</span></button>
    </div></div>
  </form>;
}

/* ── 표: 총 건수 + 행 + 페이지 번호 ── */
export type Col = string | { label: string; align?: "l" | "r" };
export function AdminTable<T>({ caption, columns, rows, render, empty = "조건에 맞는 내용이 없습니다.", emptyHint, pageSize = 10, bar = true, barAction }: {
  caption: string; columns: Col[]; rows: T[]; render: (row: T, no: number) => ReactNode; empty?: string; emptyHint?: string; pageSize?: number; bar?: boolean; barAction?: ReactNode;
}) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages);
  const shown = rows.slice((current - 1) * pageSize, current * pageSize);
  const first = Math.floor((current - 1) / 10) * 10 + 1;
  return <>
    {bar && <div className="ca-table-bar"><span>총 <b className="num">{rows.length}</b>건</span>{barAction && <div className="ca-head-action">{barAction}</div>}</div>}
    <div className="ca-table-wrap" tabIndex={0} role="region" aria-label={`${caption} 표`}><table className="ca-table">
      <caption className="ca-sr">{caption}</caption>
      <thead><tr>{columns.map(c => typeof c === "string" ? <th key={c} scope="col">{c}</th> : <th key={c.label} scope="col" className={c.align}>{c.label}</th>)}</tr></thead>
      <tbody>{shown.length ? shown.map((r, i) => render(r, rows.length - ((current - 1) * pageSize + i))) : <tr><td className="empty" colSpan={columns.length}><b>{empty}</b>{emptyHint}</td></tr>}</tbody>
    </table></div>
    {rows.length > pageSize && <nav className="ca-paging" aria-label={`${caption} 페이지`}>
      <button type="button" disabled={current === 1} onClick={() => setPage(current - 1)}>‹ 이전</button>
      {Array.from({ length: Math.min(10, pages - first + 1) }, (_, i) => first + i).map(n => <button type="button" key={n} className={n === current ? "on" : ""} aria-current={n === current ? "page" : undefined} onClick={() => setPage(n)}>{n}</button>)}
      <button type="button" disabled={current === pages} onClick={() => setPage(current + 1)}>다음 ›</button>
    </nav>}
  </>;
}
/** 행 전체를 눌러 상세로 갑니다(키보드 Enter 포함). 안쪽 버튼은 stop()으로 막습니다. */
export const rowGo = (go: () => void) => ({ className: "go", tabIndex: 0, onClick: go, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter") go(); } });
export const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };

/* ── 상태 배지 ── */
export function Badge({ children, tone }: { children: string; tone?: "red" | "amber" | "green" | "grey" | "blue" }) {
  const auto = /필요|거절|반려|누락|겹침|보완/.test(children) ? "red" : /대기|요청|제안|첫 회차/.test(children) ? "amber" : /종료|중지|취소/.test(children) ? "grey" : /확정|완료|진행|받는 중|수락/.test(children) ? "green" : "blue";
  return <span className={`ca-badge ${tone ?? auto}`}>{children}</span>;
}

export function Steps({ step }: { step: FlowStep }) {
  const done = flowIndex(step);
  return <ol className="ca-steps" aria-label={`진행 단계: ${step}`}>{FLOW_STEPS.map((s, i) => <li key={s} className={i < done ? "done" : i === done ? "current" : ""} aria-current={i === done ? "step" : undefined}>{s}</li>)}</ol>;
}

export function Dl({ items }: { items: [string, ReactNode][] }) {
  return <dl className="ca-dl">{items.map(([k, v]) => <Pair key={k} k={k} v={v} />)}</dl>;
}
function Pair({ k, v }: { k: string; v: ReactNode }) { return <><dt>{k}</dt><dd>{v === "" || v === undefined || v === null ? "-" : v}</dd></>; }

export function Field({ label, required, hint, children, group }: { label: string; required?: boolean; hint?: string; children: ReactNode; group?: boolean }) {
  const inner = <><span>{label}{required && <em aria-label="필수">*</em>}</span>{children}{hint && <small>{hint}</small>}</>;
  // Dropdown처럼 버튼이 들어가면 label로 감싸지 않습니다(목록을 눌렀을 때 다시 열리는 문제 방지).
  return group ? <div className="ca-field" role="group" aria-label={label}>{inner}</div> : <label className="ca-field">{inner}</label>;
}

/* ── 드롭다운: 기본 select 대신 쓰는 목록 선택 (키보드 ↑↓·Enter·Esc·글자 검색) ── */
export type Opt = string | { value: string; label: string; sub?: string };
export function Dropdown({ value, options, onChange, label, placeholder = "선택해 주세요", variant = "box", width }: {
  value: string; options: Opt[]; onChange: (v: string) => void; label: string; placeholder?: string; variant?: "box" | "pill"; width?: number | string;
}) {
  const opts = options.map(o => typeof o === "string" ? { value: o, label: o, sub: undefined as string | undefined } : o);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null), listRef = useRef<HTMLUListElement>(null), btnRef = useRef<HTMLButtonElement>(null);
  const current = opts.find(o => o.value === value);
  const id = `dd-${label.replace(/\s/g, "")}`;
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [open]);
  useEffect(() => { if (open) listRef.current?.children[active]?.scrollIntoView({ block: "nearest" }); }, [open, active]);
  const show = () => { setActive(Math.max(0, opts.findIndex(o => o.value === value))); setOpen(true); };
  const pick = (i: number) => { const o = opts[i]; if (o) onChange(o.value); setOpen(false); btnRef.current?.focus(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); show(); return; }
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(opts.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(opts.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(active); }
    else if (e.key === "Escape" || e.key === "Tab") { if (e.key === "Escape") e.preventDefault(); setOpen(false); }
    else if (e.key.length === 1) { const i = opts.findIndex(o => o.label.startsWith(e.key)); if (i >= 0) setActive(i); }
  };
  return <div className={`ca-dd ${variant} ${open ? "open" : ""}`} ref={ref} style={width ? { width } : undefined}>
    <button type="button" ref={btnRef} className="ca-dd-btn" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={id} aria-activedescendant={open ? `${id}-${active}` : undefined} onClick={() => open ? setOpen(false) : show()} onKeyDown={onKey}>
      <span className={current ? "" : "ph"}>{current?.label ?? placeholder}</span>
      <svg className="ca-dd-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    {open && <ul className="ca-dd-list" role="listbox" id={id} aria-label={label} ref={listRef}>
      {opts.map((o, i) => <li key={o.value} id={`${id}-${i}`} role="option" aria-selected={o.value === value} className={i === active ? "active" : ""} onMouseEnter={() => setActive(i)} onMouseDown={e => e.preventDefault()} onClick={() => pick(i)}>
        <span><b>{o.label}</b>{o.sub && <small>{o.sub}</small>}</span>
        {o.value === value && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7" /></svg>}
      </li>)}
    </ul>}
  </div>;
}

/** 폼 아래쪽에 붙는 저장 버튼 줄 */
export function ActionBar({ info, children }: { info?: ReactNode; children: ReactNode }) {
  return <div className="ca-actionbar"><div className="ca-actionbar-inner">{info && <span className="info">{info}</span>}{children}</div></div>;
}

export function AdminModal({ title, desc, onClose, children, actions }: { title: string; desc?: string; onClose: () => void; children?: ReactNode; actions: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null), close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => { ref.current?.focus(); const key = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); }; document.addEventListener("keydown", key); return () => document.removeEventListener("keydown", key); }, []);
  return <div className="ca-modal-back" onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className="ca-modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}><h2>{title}</h2>{desc && <p>{desc}</p>}{children}<div className="ca-modal-actions">{actions}</div></div></div>;
}

/* ── 토스트: 저장·처리 결과를 아래에 잠깐 보여줍니다 ── */
let toast: { text: string; err: boolean; id: number } | null = null;
const listeners = new Set<() => void>();
export function notify(text: string, err = false) {
  const id = Date.now(); toast = { text, err, id }; listeners.forEach(l => l());
  setTimeout(() => { if (toast?.id === id) { toast = null; listeners.forEach(l => l()); } }, 2800);
}
export function ToastHost() {
  const t = useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l); }; }, () => toast, () => null);
  return t ? <div className={`ca-toast ${t.err ? "err" : ""}`} role={t.err ? "alert" : "status"}>{t.text}</div> : null;
}

export const sexText = (sex: string) => sex && sex !== "미입력" ? ` · ${sex}` : "";
export const dateTime = (date: string, time?: string) => { const w = "일월화수목금토"[new Date(`${date}T00:00:00`).getDay()]; return `${date.replaceAll("-", ".")} (${w})${time ? ` ${time}` : ""}`; };
