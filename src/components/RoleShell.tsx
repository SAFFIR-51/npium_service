"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { setDemoRole, useRole } from "@/lib/demo-session";
import { DEMO_MODE, ROLE_INFO, type Role, type WorkRole } from "@/lib/session";
import "./role-shell.css";
import "./manage-theme.css";
import "./list-ui.css";
import "./care-refinement.css";
import "./business-workspace.css";

export type RoleMenuItem = { href: string; label: string; icon: IconName; count?: number };
export type RolePerson = { name: string; sub: string; icon: IconName };

/** 역할 변경(체험용). 병원·기관(센터)은 바로 센터 관리자 화면으로, 나머지는 홈으로 이동합니다. */
export function useSwitchRole() {
  const router = useRouter();
  return (role: Role) => {
    setDemoRole(role);
    router.push(role === "center" ? ROLE_INFO.center.home : "/");
  };
}

function RoleNav({ menu, path, root }: { menu: RoleMenuItem[]; path: string | null; root: string }) {
  const active = (href: string) => path !== null && (href === root ? path === href : path.startsWith(href));
  return <nav className="work-tabs" aria-label="내 관리 메뉴">
    {menu.map(m => <Link key={m.href} href={m.href} className={active(m.href) ? "active" : ""} aria-current={active(m.href) ? "page" : undefined}>
      <Icon name={m.icon} />{m.label}{!!m.count && <span className="side-count" aria-label={`${m.count}건`}>{m.count}</span>}
    </Link>)}
  </nav>;
}
/** usePathname은 동적 경로의 사전 렌더링에서 지연될 수 있어 메뉴만 Suspense로 감쌉니다. */
function ActiveRoleNav(props: { menu: RoleMenuItem[]; root: string }) {
  return <RoleNav {...props} path={usePathname()} />;
}

/** 현재 역할이 이 영역의 역할과 다를 때 보여주는 안내. 실제 서비스에서는 src/proxy.ts가 먼저 막습니다. */
function RoleGate({ area, current }: { area: WorkRole; current: Role }) {
  const label = ROLE_INFO[area].label;
  if (!DEMO_MODE) {
    return <section className="care-panel care-empty role-gate"><Icon name="shield" size={32} /><h3>{label} 계정으로 로그인해 주세요</h3><p>이 화면은 {label}만 이용할 수 있어요.</p><Link className="btn-primary" href="/login">로그인</Link></section>;
  }
  return <section className="care-panel care-empty role-gate">
    <Icon name="shield" size={32} />
    <h3>{label} 전용 화면이에요</h3>
    <p>지금은 <b>{ROLE_INFO[current].label}</b>(으)로 체험 중입니다. 실제 서비스에서는 로그인한 역할의 화면만 열립니다.</p>
    <div className="role-gate-actions">
      <button className="btn-primary" onClick={() => setDemoRole(area)}>{label}(으)로 체험하기</button>
      <Link className="btn-ghost" href={ROLE_INFO[current].home}>내 화면으로 가기</Link>
    </div>
  </section>;
}

/**
 * layout="sidebar": 업무용(전문가·병원·운영) 좌측 메뉴형.
 * layout="list": 숨고 마이페이지처럼 가운데 한 열에 프로필·메뉴 목록을 두는 형태(환자·보호자).
 */
export function RoleShell({ area, person, menu, children, layout = "sidebar" }: { area: WorkRole; person: RolePerson; menu: RoleMenuItem[]; children: ReactNode; layout?: "sidebar" | "list" }) {
  const role = useRole();
  if (layout === "list") {
    const body = role === null ? <><p className="muted" role="status">화면을 준비하고 있어요.</p><div hidden>{children}</div></>
      : role !== area ? <RoleGate area={area} current={role} />
      : children; // 내 관리에는 체험 안내 띠를 두지 않습니다.
    return <div className={`my-page manage role-${area}`}><div className="my-page-inner">{body}</div></div>;
  }
  // 사전 렌더링 중에는 역할을 알 수 없습니다. 페이지 세그먼트는 렌더링하되(즉시 이동 검증용) 화면에는 숨깁니다.
  // 업무 역할(전문가·병원·운영)도 "내 관리" 한 곳에서 관리합니다. 가운데 970px, 위쪽 탭 메뉴(숨고식).
  const shell = (body: ReactNode, tabs?: ReactNode) => <div className={`workspace role-workspace role-tabs manage role-${area} ${area === "hospital" || area === "admin" || area === "center" ? "business-work" : ""}`}><div className="workspace-content">
    <div className="manage-band">
      <div className="work-head">{area !== "hospital" && area !== "admin" && area !== "center" && <span className="work-avatar"><Icon name={person.icon} size={22} /></span>}<div>{area !== "hospital" && area !== "center" && <p className="work-title">내 관리</p>}<p className="work-person">{person.name}{person.sub && <small>{person.sub}</small>}{person.sub !== ROLE_INFO[area].label && <em className="work-role">{ROLE_INFO[area].label}</em>}</p></div></div>
      {tabs}
    </div>
    {body}
  </div></div>;
  if (role === null) return shell(<><p className="muted" role="status">화면을 준비하고 있어요.</p><div hidden>{children}</div></>);
  if (role !== area) return shell(<RoleGate area={area} current={role} />);
  const root = ROLE_INFO[area].home;
  return shell(children, <Suspense fallback={<RoleNav menu={menu} path={null} root={root} />}><ActiveRoleNav menu={menu} root={root} /></Suspense>);
}

export function WorkspaceHeading({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="dashboard-title"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}
