"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Modal } from "./CareUI";
import { useSwitchRole } from "./RoleShell";
import { Icon, type IconName } from "./Icon";
import { logout, useAccount } from "@/lib/auth-client";
import { setDemoRole, useRole } from "@/lib/demo-session";
import { markSeen, useNotices } from "@/lib/notifications";
import { unreadCount } from "@/lib/chat";
import { careRepo, mutationFailed, useCare } from "@/lib/repo";
import { DEMO_ACCOUNTS, demoProvider, DEMO_MODE, DEMO_ROLES, ROLE_INFO, type Role } from "@/lib/session";
import "./site-header-roles.css";

export function Logo() {
  return <Link href="/" className="logo" aria-label="NPIUM 홈"><Image src="/brand/npium-wordmark-uppercase-heavy.svg" width={74} height={18} alt="NPIUM" priority /></Link>;
}

type NavItem = { href: string; label: string };
const publicNav: NavItem[] = [
  { href: "/request", label: "프로그램 신청" },
  { href: "/experts", label: "전문가 찾기" },
  { href: "/spaces", label: "센터·공간" },
];
/** 상단 메뉴는 역할과 관계없이 같습니다. 각 역할의 업무는 오른쪽 "내 관리"에서 합니다. */
const navByRole: Record<Role, NavItem[]> = { guest: publicNav, patient: publicNav, provider: publicNav, center: publicNav, hospital: publicNav, admin: publicNav };
const roleIcons: Record<Role, IconName> = { guest: "home", patient: "user", provider: "calendar", center: "building", hospital: "building", admin: "shield" };
const roleOrder: Role[] = DEMO_ROLES;
function accountName(role: Role) {
  return role === "patient" ? `${DEMO_ACCOUNTS.patient.name} 님` : role === "provider" ? `${demoProvider()?.name ?? "제공자"} 선생님` : role === "center" ? `${DEMO_ACCOUNTS.center.name} 의사` : role === "hospital" ? DEMO_ACCOUNTS.hospital.organization : role === "admin" ? DEMO_ACCOUNTS.admin.name : ROLE_INFO[role].label;
}
function Dropdown({ label, trigger, children, className = "", onOpen }: { label: string; trigger: ReactNode; children: (close: () => void) => ReactNode; className?: string; onOpen?: () => void }) {
  const [open, setOpen] = useState(false), ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); }; const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); }; document.addEventListener("mousedown", down); document.addEventListener("keydown", key); return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); }; }, [open]);
  return <div className={`nav-drop ${className}`} ref={ref}><button className="nav-drop-trigger" aria-label={label} aria-expanded={open} aria-haspopup="true" onClick={() => { if (!open) onOpen?.(); setOpen(!open); }}>{trigger}</button>{open && <div className="nav-drop-panel">{children(() => setOpen(false))}</div>}</div>;
}
function UserArea({ role, isCurrent, inMyArea, onSwitch }: { role: Exclude<Role, "guest">; isCurrent: (href: string) => boolean; inMyArea: boolean; onSwitch: () => void }) {
  const router = useRouter(), { notices, unread, seen } = useNotices(role), chatUnread = unreadCount(useCare(), role);
  const careUnread = notices.filter(n => !n.id.startsWith("chat-") && !seen.includes(n.id)).length, home = ROLE_INFO[role].home;
  return <span className="nav-user"><Link href={home} className="nav-text-link nav-dotted" aria-current={inMyArea ? "page" : undefined}>내 관리{careUnread > 0 && <span className="nav-text-dot" aria-label="새 소식" />}</Link><Link href="/chat" className="nav-text-link nav-chat-link" aria-current={isCurrent("/chat") ? "page" : undefined}>채팅{chatUnread > 0 && <em className="nav-badge">{chatUnread}</em>}</Link>
    <Dropdown label={`알림 ${unread}건`} className="nav-bell" onOpen={() => markSeen(notices.map(n => n.id))} trigger={<><Icon name="bell" size={21} />{unread > 0 && <span className="nav-dot" />}</>}>{close => <><p className="nav-drop-title">알림</p>{notices.length ? <ul className="nav-notices">{notices.slice(0, 6).map(n => <li key={n.id}><Link href={n.href} onClick={close}>{n.text}</Link></li>)}</ul> : <p className="nav-drop-empty">새 알림이 없어요.</p>}<Link href="/notifications" className="nav-drop-more" onClick={close}>알림 전체 보기</Link></>}</Dropdown>
    <Dropdown label="내 계정 메뉴" className="nav-profile" trigger={<><span className="nav-avatar"><Icon name="user" size={18} /></span><Icon name="down" size={14} /></>}>{close => <><div className="nav-profile-head"><span className="nav-avatar lg">{accountName(role).slice(0, 1)}</span><div><b>{accountName(role)}</b><small>{ROLE_INFO[role].label}</small></div></div><Link href={home} onClick={close}>내 관리</Link>{DEMO_MODE && <button onClick={() => { close(); onSwitch(); }}>역할 변경</button>}<button onClick={() => { close(); setDemoRole("guest"); router.push("/"); }}>로그아웃</button></>}</Dropdown>
  </span>;
}
function DemoReset() {
  const [ask, setAsk] = useState(false), [done, setDone] = useState(false);
  return <div className="role-reset">{done ? <p>체험 데이터를 처음 예시로 되돌렸어요.</p> : ask ? <><p>이 브라우저에 저장한 신청·보고서·채팅·일정 변경이 기본 예시로 돌아갑니다. 되돌릴 수 없어요.</p><div><button onClick={() => setAsk(false)}>취소</button><button className="danger" onClick={async () => { if (mutationFailed(await careRepo.reset())) return; setAsk(false); setDone(true); }}>초기화하기</button></div></> : <><p>체험 데이터는 이 브라우저에만 저장돼요.</p><button onClick={() => setAsk(true)}>체험 데이터 초기화</button></>}</div>;
}

function BottomNav({ role, path, onLogin }: { role: Role; path: string | null; onLogin: () => void }) {
  const chatUnread = unreadCount(useCare(), role === "guest" ? null : role);
  if (path && (path.startsWith("/request") || path.startsWith("/partner/join"))) return null;
  const home = ROLE_INFO[role].home;
  const items: { href: string; label: string; icon: IconName; badge?: number; active: boolean }[] = [
    { href: "/", label: "홈", icon: "home", active: path === "/" },
    { href: "/experts", label: "전문가 찾기", icon: "search", active: !!path?.startsWith("/experts") },
    { href: "/request", label: "신청", icon: "plus", active: false },
    { href: "/chat", label: "채팅", icon: "chat", badge: chatUnread, active: !!path?.startsWith("/chat") },
    { href: home, label: "내 관리", icon: "user", active: role !== "guest" && !!path && path !== "/" && path.startsWith(home) },
  ];
  return <nav className="bottom-nav" aria-label="하단 메뉴">
    {items.map(it => it.label === "내 관리" && role === "guest"
      ? <button key={it.label} onClick={onLogin}><Icon name={it.icon} size={22} /><span>{it.label}</span></button>
      : <Link key={it.label} href={it.href} className={it.active ? "active" : ""} aria-current={it.active ? "page" : undefined}><span className="bottom-nav-icon"><Icon name={it.icon} size={22} />{!!it.badge && <em>{it.badge > 99 ? "99+" : it.badge}</em>}</span><span>{it.label}</span></Link>)}
  </nav>;
}

/**
 * usePathname은 생성되지 않은 동적 파라미터 경로(예: /expert/patients/[id])의 사전 렌더링에서 지연됩니다.
 * 헤더 전체가 렌더링을 막지 않도록 경로 의존 부분을 Suspense로 감쌉니다.
 */
export function SiteHeader() {
  return <Suspense fallback={<HeaderView path={null} />}><HeaderWithPath /></Suspense>;
}
function HeaderWithPath() {
  return <HeaderView path={usePathname()} />;
}

function HeaderView({ path }: { path: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false), [menu, setMenu] = useState(false);
  const switchRole = useSwitchRole();
  const account = useAccount();
  const role = useRole() ?? "guest";
  const nav = navByRole[role];
  const home = path === "/";
  const isCurrent = (href: string) => path !== null && (href === ROLE_INFO[role].home || href === "/request" ? path === href : path.startsWith(href));
  return <>
    {home && <a href="/request" className="brand-masthead" aria-label="퇴원 후에도 일상을 잇는 운동, 프로그램 신청">
      <div className="masthead-message"><span>퇴원 후에도</span><span className="masthead-photo"><Image src="/images/npium-banner-professional.png" fill sizes="112px" alt="" priority /></span><strong>일상을 잇는 운동</strong></div>
    </a>}
    <header className={`header reference-header ${home ? "reference-home-header" : ""}`}>
      <div className="wrap header-row">
        <button className="mobile-menu-toggle" aria-label="메뉴 열기" onClick={() => setMenu(true)}><Icon name="menu" size={22} /></button>
        <Logo />
        <nav className="nav-main" aria-label="서비스 메뉴">{nav.map(n => n.href === "/request" ?
          <a key={n.href} href={n.href} aria-current={isCurrent(n.href) ? "page" : undefined}>{n.label}</a> :
          <Link key={n.href} href={n.href} aria-current={isCurrent(n.href) ? "page" : undefined}>{n.label}</Link>)}</nav>
        {role !== "guest" && <Link href="/notifications" className="mobile-bell" aria-label="알림"><Icon name="bell" size={22} /></Link>}
        <nav className="nav-partner" aria-label="파트너 메뉴">
          {DEMO_MODE && (role === "guest"
            ? <button className="nav-account" onClick={() => setOpen(true)}>로그인 / 역할 선택</button>
            : <UserArea role={role} isCurrent={isCurrent} inMyArea={path !== null && path !== "/" && (path === ROLE_INFO[role].home || path.startsWith(`${ROLE_INFO[role].home}/`))} onSwitch={() => setOpen(true)} />)}
          {!DEMO_MODE && (account ? <><Link href={ROLE_INFO[account.role].home}>{account.name} · 내 관리</Link><button onClick={async () => { await logout(); router.push("/login"); }}>로그아웃</button></> : <Link href="/login">로그인</Link>)}
          {role === "guest" && <Link href="/partner" className="nav-expert">전문가 가입</Link>}
        </nav>
      </div>
    </header>
    <BottomNav role={role} path={path} onLogin={() => DEMO_MODE ? setOpen(true) : router.push("/login")} />


    {menu && <Modal title="메뉴" onClose={() => setMenu(false)}><nav className="mobile-menu-links" aria-label="모바일 서비스 메뉴">{nav.map(n => <Link key={n.href} href={n.href} onClick={() => setMenu(false)}>{n.label}<Icon name="chevron" size={18} /></Link>)}</nav><div className="mobile-menu-partners">{role !== "guest" && <><Link href={ROLE_INFO[role].home} onClick={() => setMenu(false)}>내 관리</Link><Link href="/chat" onClick={() => setMenu(false)}>채팅</Link><Link href="/notifications" onClick={() => setMenu(false)}>알림</Link></>}{DEMO_MODE ? <button onClick={() => { setMenu(false); setOpen(true); }}>로그인 / 역할 선택</button> : <Link href="/login" onClick={() => setMenu(false)}>로그인</Link>}</div></Modal>}
    {open && <Modal title="로그인 / 역할 선택" onClose={() => setOpen(false)}><p className="modal-lead">체험할 역할을 선택하면 해당 역할의 예시 계정으로 화면을 확인할 수 있습니다.</p><div className="role-choices">{roleOrder.map(r => <button key={r} className={r === role ? "current" : ""} onClick={() => { setOpen(false); switchRole(r); }}><span><Icon name={roleIcons[r]} /></span><div><b>{ROLE_INFO[r].label}{r === role && " · 현재"}</b><small>{ROLE_INFO[r].text}</small></div><Icon name="chevron" size={18} /></button>)}</div><p className="role-join-link"><Link href="/partner" onClick={() => setOpen(false)}>전문가 가입</Link></p><DemoReset /></Modal>}
  </>;
}


