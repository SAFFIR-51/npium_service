"use client";
import { Modal } from "@/components/CareUI";
import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { expertPortraits } from "@/lib/expert-portraits";
import { Icon } from "@/components/Icon";
import { conditions, experts, type Expert } from "@/lib/data";
import { centerOfProvider } from "@/lib/center";
import "./directory-v2.css";

function Heart({ size = 19 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21S2.5 15 2.5 8.5a5.3 5.3 0 0 1 9.5-3.2 5.3 5.3 0 0 1 9.5 3.2C21.5 15 12 21 12 21Z" /></svg>;
}

function RecommendedCard({ expert: e }: { expert: Expert }) {
  return <Link href={`/experts/${e.id}`} className="directory-recommend-card"><div className="directory-recommend-content"><h3>{e.name}</h3><dl><div><dt>경력</dt><dd>{e.years}년</dd></div><div><dt>자격</dt><dd>{e.license}</dd></div><div><dt>리뷰</dt><dd><Icon name="star" size={14} /><b>{e.rating.toFixed(1)}</b><small>({e.reviews})</small></dd></div></dl><div className="directory-recommend-tags">{e.visit.map(v => <span key={v}>{v}</span>)}</div></div><span className="directory-avatar directory-portrait"><Image src={expertPortraits[e.id]} fill sizes="54px" alt={`${e.name} 예시 프로필 사진`}/></span></Link>;
}

export default function ExpertsPage() {
  const [focus, setFocus] = useState("");
  const [region, setRegion] = useState("전체 지역");
  const [method, setMethod] = useState("전체 방식");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("리뷰 많은 순");
  const [saved, setSaved] = useState<string[]>([]);
  const [onlySaved, setOnlySaved] = useState(false);
  const [dialog, setDialog] = useState<"service" | "region" | null>(null);
  const [filterSearch, setFilterSearch] = useState("");
  const list = useRef<HTMLElement>(null);
  const items = experts.filter(e => {
    const text = `${e.name} ${e.license} ${e.area} ${e.focus.join(" ")} ${e.intro} ${e.visit.join(" ")}`.replace(/\s/g, "");
    return (!focus || e.focus.includes(focus)) && (region === "전체 지역" || (region === "서울" ? e.area.includes("서울") : !e.area.includes("서울"))) && (method === "전체 방식" || e.visit.some(v => v === method)) && (!onlySaved || saved.includes(e.id)) && text.includes(query.trim().replace(/\s/g, ""));
  }).sort((a, b) => sort === "리뷰 많은 순" ? b.reviews - a.reviews : sort === "가격 낮은 순" ? a.price - b.price : b.rating - a.rating);
  const recommended = onlySaved ? [] : items.slice(0, 3);
  function reset() { setFocus(""); setRegion("전체 지역"); setMethod("전체 방식"); setQuery(""); setOnlySaved(false); }
  function openDialog(kind: "service" | "region") { setFilterSearch(""); setDialog(kind); }
  function toggleSaved(id: string) { setSaved(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]); }


  return <div className="provider-directory directory-v2" id="directory">
    <h1>치료사 찾기</h1>
    <div className="directory-v2-filters"><button className={focus ? "chosen" : ""} onClick={() => openDialog("service")} aria-expanded={dialog === "service"}>{focus || "서비스"}<Icon name="down" size={17} /></button><button className={region !== "전체 지역" ? "chosen" : ""} onClick={() => openDialog("region")} aria-expanded={dialog === "region"}>{region === "전체 지역" ? "지역" : region}<Icon name="down" size={17} /></button></div>

    <div className="directory-v2-columns"><aside className="directory-v2-sidebar"><div className="directory-v2-sidebar-head"><b>필터</b><button onClick={reset}>초기화 <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M19 8a8 8 0 1 1-7-4h6m0 0-3-3m3 3-3 3" /></svg></button></div>
      {!focus ? <div className="directory-v2-tip"><h2>서비스 분야를 선택해 주세요.</h2><p>서비스 분야를 선택하면 나에게 맞는<br />전문가를 필터링해 찾아볼 수 있어요.</p></div> : <section className="directory-v2-method"><h2>진행 방식</h2>{["전체 방식", "방문", "센터", "비대면 점검"].map(m => <label key={m}><input type="radio" name="directory-method" checked={method === m} onChange={() => setMethod(m)} />{m}</label>)}</section>}
    </aside>

    <section className="directory-v2-main"><div className="directory-v2-toolbar"><button className={`directory-visit-filter ${method === "방문" ? "active" : ""}`} aria-pressed={method === "방문"} onClick={() => setMethod(method === "방문" ? "전체 방식" : "방문")}><Icon name="home" size={14} />방문 가능</button><select aria-label="전문가 정렬" value={sort} onChange={e => setSort(e.target.value)}>{["리뷰 많은 순", "평점 높은 순", "가격 낮은 순"].map(s => <option key={s}>{s}</option>)}</select></div>
      <div className="directory-v2-search-row"><label className="directory-v2-search"><Icon name="search" size={20} /><input aria-label="전문가 검색" placeholder="어떤 재활이 필요하세요?" value={query} onChange={e => setQuery(e.target.value)} /></label><button className="directory-region-view" onClick={() => openDialog("region")}><Icon name="pin" size={18} />지역 보기</button></div>
      <div className="directory-v2-mobile-method"><select aria-label="진행 방식" value={method} onChange={e => setMethod(e.target.value)}>{["전체 방식", "방문", "센터", "비대면 점검"].map(m => <option key={m}>{m}</option>)}</select><button onClick={reset}>필터 초기화</button></div>

      {recommended.length > 0 && <section className="directory-v2-recommend"><h2>오늘의 <span>추천 전문가</span>예요 <small>예시</small></h2><div>{recommended.map(e => <RecommendedCard expert={e} key={e.id} />)}</div></section>}

      <section className="directory-v2-list" ref={list}><div className="directory-v2-list-heading"><h2>{onlySaved ? "찜한 전문가" : "내 조건에 맞는 전문가"}<span>{items.length}</span></h2>{onlySaved && <button onClick={() => setOnlySaved(false)}>전체 보기</button>}</div>
        {items.length ? items.map(e => <article className="directory-v2-result" key={e.id}><Link href={`/experts/${e.id}`} className="directory-v2-result-link"><div><h3>{e.name}<span>{e.license}</span></h3><p className="directory-v2-stats"><Icon name="star" size={14} /><b>{e.rating.toFixed(1)}</b><span>({e.reviews})</span><span className="directory-v2-stat-divider">·</span><span>경력 {e.years}년</span></p><p className="directory-v2-intro">{e.intro}</p><div className="directory-v2-tags"><span>{e.focus[0]}</span><span>{e.visit[0]} 프로그램</span></div><p className="directory-v2-area">{e.area} · {centerOfProvider(e.id).name}</p></div><span className="directory-avatar directory-portrait"><Image src={expertPortraits[e.id]} fill sizes="54px" alt={`${e.name} 예시 프로필 사진`}/></span></Link><button className={`directory-v2-save ${saved.includes(e.id) ? "saved" : ""}`} aria-label={`${e.name} 전문가 ${saved.includes(e.id) ? "찜 취소" : "찜하기"}`} aria-pressed={saved.includes(e.id)} onClick={() => toggleSaved(e.id)}><svg width="19" height="19" viewBox="0 0 24 24" fill={saved.includes(e.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M12 20S3 14.5 3 9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.5-9 11-9 11Z" /></svg></button></article>) : <div className="directory-v2-empty"><h3>{onlySaved ? "찜한 전문가가 없어요" : "조건에 맞는 전문가가 없어요"}</h3><p>{onlySaved ? "전문가 목록에서 하트를 눌러 저장해 보세요." : "서비스나 지역을 변경해 다시 찾아보세요."}</p><button onClick={reset}>전체 전문가 보기</button></div>}
      </section>
      <p className="directory-v2-demo">프로필·자격·평점은 화면 검토를 위한 예시입니다.</p>
    </section></div>

    <button className="directory-v2-saved-float" aria-pressed={onlySaved} onClick={() => { setOnlySaved(!onlySaved); requestAnimationFrame(() => list.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }}><Heart size={19} />{onlySaved ? "전체 전문가" : "찜한 전문가"}{saved.length > 0 && <span>{saved.length}</span>}</button>



    {dialog && <Modal title={dialog === "service" ? "서비스 선택" : "지역 선택"} onClose={() => setDialog(null)}><div className="directory-v2-dialog-tabs" role="tablist" aria-label="검색 조건"><button role="tab" aria-selected={dialog === "service"} onClick={() => { setDialog("service"); setFilterSearch(""); }}>서비스</button><button role="tab" aria-selected={dialog === "region"} onClick={() => { setDialog("region"); setFilterSearch(""); }}>지역</button></div><label className="directory-v2-dialog-search"><Icon name="search" size={18} /><input aria-label={dialog === "service" ? "서비스 분야 검색" : "지역 검색"} placeholder={dialog === "service" ? "서비스를 검색하세요" : "지역을 검색하세요"} value={filterSearch} onChange={e => setFilterSearch(e.target.value)} /></label><div className="directory-v2-dialog-options">{dialog === "service" ? [{ key: "all", label: "서비스 전체" }, ...conditions].filter(c => c.label.includes(filterSearch)).map(c => <button key={c.key} aria-pressed={focus === (c.key === "all" ? "" : c.label)} onClick={() => { setFocus(c.key === "all" ? "" : c.label); setDialog(null); }}><span>{c.label}</span><Icon name="chevron" size={17} /></button>) : ["전체 지역", "서울", "경기"].filter(r => r.includes(filterSearch)).map(r => <button key={r} aria-pressed={region === r} onClick={() => { setRegion(r); setDialog(null); }}><span>{r}</span><Icon name="chevron" size={17} /></button>)}</div></Modal>}
</div>;
}
