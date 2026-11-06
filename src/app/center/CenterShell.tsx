"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { logout } from "@/lib/auth-client";
import { setDemoRole, useRole } from "@/lib/demo-session";
import { DEMO_MODE } from "@/lib/session";
import { flowStep } from "@/lib/center";
import { ToastHost } from "./admin-ui";
import { useCenterCare } from "./use-center-care";
import "./center-admin.css";

type MenuItem = { href: string; label: string; count?: number };
type Group = { label: string; items: MenuItem[] };

/**
 * 센터 어드민 틀.
 * 데스크톱: 상단 메뉴(묶음) + 센터 정보 띠 + 좌측 메뉴(현재 묶음) + 가운데 본문.
 * 1023px 이하: 상단 메뉴 대신 ☰ 서랍 메뉴(모든 묶음). 640px 이하: 센터 정보 띠 숨김.
 */
export function CenterShell({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Frame path={null}>{children}</Frame>}><WithPath>{children}</WithPath></Suspense>;
}
function WithPath({ children }: { children: ReactNode }) {
  return <Frame path={usePathname()}>{children}</Frame>;
}

function Frame({ path, children }: { path: string | null; children: ReactNode }) {
  const role = useRole(), router = useRouter();
  const { state, me, center, patients, providers, payments } = useCenterCare();
  const [closed, setClosed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) { setLastPath(path); setDrawer(false); setMenu(false); }
  useEffect(() => {
    if (!menu) return;
    const down = (e: MouseEvent) => { if (!userRef.current?.contains(e.target as Node)) setMenu(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("mousedown", down); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [menu]);

  const count = (step: string) => patients.filter(p => flowStep(state, p) === step).length;
  const groups: Group[] = [
    { label: "센터 현황", items: [{ href: "/center", label: "센터 홈" }] },
    { label: "회원/확인", items: [{ href: "/center/members", label: "회원 관리", count: count("담당 배정 필요") }, { href: "/center/doctor", label: "의사 확인", count: count("의사 확인 대기") }] },
    { label: "프로그램/예약", items: [{ href: "/center/programs", label: "프로그램 관리" }, { href: "/center/bookings", label: "예약 현황" }, { href: "/center/therapists", label: "치료사 관리" }] },
    { label: "결제/정산", items: [{ href: "/center/billing", label: "결제 내역", count: payments.filter(x => x.status === "결제 대기").length }, { href: "/center/settlement", label: "치료사 정산" }] },
  ];
  const isOn = (href: string) => path !== null && (href === "/center" ? path === href : path.startsWith(href));
  const group = groups.find(g => g.items.some(i => isOn(i.href))) ?? groups[0];
  const groupCount = (g: Group) => g.items.reduce((n, i) => n + (i.count ?? 0), 0);
  const leave = async () => { if (DEMO_MODE) setDemoRole("guest"); else await logout(); router.push("/"); };
  const item = (i: MenuItem) => <Link key={i.href} href={i.href} className={isOn(i.href) ? "on" : ""} aria-current={isOn(i.href) ? "page" : undefined}>{i.label}{!!i.count && <em className="ca-count" aria-label={`처리할 일 ${i.count}건`}>{i.count}</em>}</Link>;

  const body = role === null ? <p role="status" style={{ padding: 40 }}>화면을 준비하고 있어요.</p>
    : role !== "center" ? <div className="ca-gate"><h1>센터 계정 전용 화면이에요</h1><p>센터 의사 계정으로 로그인해야 볼 수 있어요.</p>{DEMO_MODE ? <button className="ca-btn primary" onClick={() => setDemoRole("center")}>센터로 체험하기</button> : <Link className="ca-btn primary" href="/login">로그인</Link>}</div>
    : children;

  return <div className={`ca ${closed ? "side-closed" : ""} ${drawer ? "drawer-open" : ""}`}>
    <a href="#ca-content" className="ca-sr">본문으로 건너뛰기</a>
    <header className="ca-top">
      <button className="ca-burger" aria-label={drawer ? "메뉴 닫기" : "메뉴 열기"} aria-expanded={drawer} onClick={() => setDrawer(!drawer)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{drawer ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg></button>
      <Link href="/center" className="ca-logo">NPIUM<small>센터</small></Link>
      <nav className="ca-gnb" aria-label="센터 주 메뉴">{groups.map(g => <Link key={g.label} href={g.items[0].href} className={g === group && path !== null ? "on" : ""}>{g.label}{groupCount(g) > 0 && <em className="ca-count" aria-label={`처리할 일 ${groupCount(g)}건`}>{groupCount(g)}</em>}</Link>)}</nav>
      <div className="ca-user" ref={userRef}>
        <button className="ca-user-btn" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}><span className="who-text">{me.name} 의사님 <small>· {center.name}</small></span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button>
        {menu && <div className="ca-user-menu" role="menu">
          <div className="who"><b>{me.name} ({me.title})</b><small>{center.name} · {center.kind}</small></div>
          <Link role="menuitem" href="/">이용자 홈 화면</Link>
          <button role="menuitem" onClick={leave}>로그아웃</button>
        </div>}
      </div>
    </header>
    <div className="ca-context">
      <div className="ca-context-label">선택한 센터정보</div>
      <div className="ca-context-items">
        <span>센터명<b>{center.name}</b></span>
        <span>구분<b>{center.kind}</b></span>
        <span>센터 의사<b>{center.doctors.map(d => d.name).join(", ")}</b></span>
        <span>소속 치료사<b>{providers.length}명</b></span>
        <span>주소<b>{center.address.replace(" (체험용 주소)", "")}</b></span>
      </div>
      <Link className="ca-context-btn" href="/experts">치료사 찾기 화면 ›</Link>
    </div>
    <div className="ca-body">
      <aside className="ca-side" aria-label="센터 메뉴">
        <div className="ca-side-inner">
          <button className="ca-side-toggle" onClick={() => setClosed(!closed)} aria-expanded={!closed} aria-label={closed ? "메뉴 열기" : "메뉴 닫기"} title={closed ? "메뉴 열기" : "메뉴 닫기"}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={closed ? "m9 6 6 6-6 6" : "m15 6-6 6 6 6"} /></svg></button>
          <h2>{group.label}</h2>
          {/* 데스크톱은 현재 묶음만, 서랍 메뉴에서는 모든 묶음을 보여줍니다. */}
          <nav aria-label={`${group.label} 메뉴`}>{groups.map(g => <div key={g.label} className={g === group ? "" : "ca-other-group"}><div className="ca-side-group">{g.label}</div>{g.items.map(item)}</div>)}</nav>
        </div>
      </aside>
      <div className="ca-scrim" onClick={() => setDrawer(false)} />
      <main className="ca-main" id="ca-content"><div className="ca-main-inner">{body}</div>
        <p className="ca-copy"><b>NPIUM</b>copyright (c) NPIUM · 화면의 센터·의사·금액은 체험용 예시입니다.</p>
      </main>
    </div>
    <ToastHost />
  </div>;
}
