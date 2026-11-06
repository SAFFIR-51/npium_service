"use client";
import { Modal } from "@/components/CareUI";
import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/Icon";
import { type Expert, won } from "@/lib/data";
import { expertPortraits } from "@/lib/expert-portraits";
import { useCare } from "@/lib/repo";
import { centerOfProvider, methodLabel, paymentLabel, programsOf } from "@/lib/center";
import "./center-ui.css";

const programDescriptions: Record<string, string> = {
  park: "보행과 균형, 집 안에서의 이동처럼 일상에 필요한 움직임을 중심으로 진행합니다. 사용하는 보조도구와 생활 동선을 함께 확인하고, 현재 수행할 수 있는 범위에 맞춰 활동을 조정합니다.",
  lee: "무릎·고관절 수술 후 안내받은 주의사항을 바탕으로 일상 복귀에 필요한 움직임을 살펴봅니다. 회복 단계와 활동 가능 범위를 확인하고, 생활 속에서 이어갈 수 있는 운동을 함께 연습합니다.",
  choi: "식사와 옷 입기, 화장실 이용 등 매일 반복하는 일상 동작을 중심으로 진행합니다. 도움이 필요한 동작과 생활 환경을 확인하고, 이용자에게 맞는 수행 방법과 보조도구 활용을 안내합니다.",
  jung: "척추 수술 후 주의사항과 현재의 활동 범위를 확인하고, 일상 복귀에 필요한 움직임을 단계에 맞춰 진행합니다. 센터 프로그램에서는 필요한 장비와 환경을 함께 확인합니다.",
  han: "일상 활동을 이어가는 데 필요한 근력과 균형을 중심으로 진행합니다. 현재 컨디션과 이동 환경을 살펴보고, 보호자와 함께 생활 속에서 실천할 수 있는 활동을 확인합니다.",
  oh: "삼킴·언어 기능과 일상에서의 의사소통을 살펴보고, 이용자에게 필요한 연습을 함께 진행합니다. 가족이 참여할 수 있는 방법과 생활 중 확인할 사항을 안내합니다.",
};

export function ExpertProfile({ expert: e }: { expert: Expert }) {
  const [saved, setSaved] = useState(false);
  const [sharing, setSharing] = useState(false);
  const shareOrigin = useSyncExternalStore(() => () => {}, () => window.location.origin, () => "");
  const shareUrl = `${shareOrigin}/experts/${e.id}`;
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const openShare = () => {
    setCopied(false);
    setCopyError("");
    setSharing(true);
  };
  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setCopyError("");
    } catch {
      setCopyError("링크를 선택해 직접 복사해 주세요.");
    }
  };
  const [section, setSection] = useState("expert-info");
  const center = centerOfProvider(e.id), programs = programsOf(useCare(), e.id);
  const href = `/request?expert=${e.id}`;
  const photos = [
    { src: "/images/care-consultation.jpg", caption: "프로그램 상담", alt: "프로그램 상담 참고 사진" },
    { src: e.id === "han" ? "/images/walking.jpg" : "/images/stretch.jpg", caption: "개인 운동 프로그램", alt: "개인 운동 프로그램 참고 사진" },
    { src: "/images/studio-v2.jpg", caption: "프로그램 공간", alt: "프로그램 공간 참고 사진" },
  ];
  const sections = [
    { id: "expert-info", title: "전문가 정보" },
    { id: "expert-programs", title: "프로그램" },
    { id: "expert-photos", title: "사진" },
    { id: "expert-reviews", title: `이용 후기 ${e.reviews}` },
    { id: "expert-faq", title: "질문답변" },
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setSection(visible[0].target.id);
    }, { rootMargin: "-125px 0px -55% 0px", threshold: 0 });
    document.querySelectorAll(".expert-page .expert-section").forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [e.id, sharing]);


  return <div className="expert-page"><div className="expert-container">
    <header className="expert-identity">
      <span className="expert-monogram expert-portrait"><Image src={expertPortraits[e.id]} fill sizes="56px" alt={`${e.name} 예시 프로필 사진`}/></span>
      <div className="expert-identity-copy"><h1>{e.name}</h1><p className="expert-rating"><Icon name="star" size={16} /><b>{e.rating.toFixed(1)}</b><a href="#expert-reviews" onClick={() => setSection("expert-reviews")}>({e.reviews})</a><span>· {e.license}</span></p></div>
      <div className="expert-actions"><button className={`expert-save ${saved ? "saved" : ""}`} onClick={() => setSaved(!saved)} aria-label={saved ? "전문가 저장 취소" : "전문가 저장"} aria-pressed={saved}><svg width="22" height="22" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M12 20S3 14.5 3 9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.5-9 11-9 11Z" /></svg></button><button className="expert-share" aria-label="프로필 공유" onClick={openShare}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3m-4 4 4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg></button></div>
    </header>
    <p className="expert-intro">{e.intro}</p>
    <div className="expert-profile-labels"><span>{e.visit.join(" · ")}</span><span>예시 프로필</span></div>
    <div className="expert-gallery" aria-label="프로그램 참고 사진">{photos.map(p => <figure key={p.src}><Image src={p.src} fill sizes="(max-width:700px) 50vw, 220px" alt={p.alt} /><figcaption>{p.caption} · 참고 사진</figcaption></figure>)}</div>

    <div className="expert-columns"><div className="expert-main">
      <p className="expert-notice">{center.name} 소속 치료사예요. 신청하면 첫 회차 전에 센터 의사가 확인합니다.</p>
      <nav className="expert-section-nav" aria-label="전문가 프로필 항목">{sections.map(s => <a key={s.id} href={`#${s.id}`} aria-current={section === s.id ? "location" : undefined} onClick={() => setSection(s.id)}>{s.title}</a>)}</nav>

      <section className="expert-section" id="expert-info">
        <dl className="expert-facts"><div><dt>소속 센터</dt><dd>{center.name}</dd></div><div><dt>활동 지역</dt><dd>{e.area}</dd></div><div><dt>가능 시간</dt><dd>{e.slots}</dd></div><div><dt>진행 방식</dt><dd>{e.visit.join(" · ")}</dd></div></dl>
        <h2>서비스 상세설명</h2><p>{e.intro}</p><p>{programDescriptions[e.id]}</p>
        <h2 className="expert-subsection-title">제공 프로그램</h2><div className="expert-service-tags">{e.focus.map(t => <span key={t}>{t}</span>)}</div>
        <div className="expert-career"><h2>경력·자격</h2><h3>총 경력 {e.years}년</h3><p>{e.license} · {e.focus.join(" / ")}</p><p className="expert-career-institution">소속 센터 · {center.name} ({center.kind})</p><p className="expert-caption">경력·자격·기관은 화면 구성을 위한 예시 정보입니다.</p></div>
      </section>

      <section className="expert-section" id="expert-programs"><h2>프로그램 안내</h2>
        <p>프로그램을 시작하기 전에 현재 상태와 퇴원 시 안내받은 주의사항, 생활 환경을 함께 확인합니다. 이용자가 원하는 목표와 가능한 장소·일정을 바탕으로 진행 내용을 정합니다.</p>
        <p>{programDescriptions[e.id]}</p>
        <p>진행한 활동과 수행 반응은 회차별로 기록합니다. 이전 기록을 살펴보며 다음 회차의 계획을 조정하고, 보호자와 함께 확인할 내용도 정리합니다.</p>
        <div className="cx-programs">{programs.length ? programs.map(pg => <div className="cx-program" key={pg.id}><div><b>{pg.title}</b><small>{pg.method === "센터" ? `센터 수업 · ${center.name}` : methodLabel(pg)} · {pg.minutes}분 · {paymentLabel(pg)}</small></div><div style={{ textAlign: "right" }}><div className="cx-price">{pg.payment === "이용권" && pg.packPrice ? won(pg.packPrice) : `${won(pg.price)} / 회`}</div><a className="cx-btn small primary" style={{ marginTop: 6 }} href={`/request?expert=${e.id}&program=${pg.id}`}>신청</a></div></div>) : <p className="expert-caption">지금 신청할 수 있는 프로그램이 없어요.</p>}</div>
        <p className="expert-caption">신청하면 치료사가 수락한 뒤, 첫 회차 전에 {center.name} 의사가 상태와 주의사항을 확인합니다. 금액은 체험용 예시입니다.</p>
      </section>

      <section className="expert-section" id="expert-photos"><h2>사진</h2><div className="expert-photo-grid">{photos.map(p => <figure key={p.src}><div><Image src={p.src} fill sizes="(max-width:700px) 30vw, 220px" alt={p.alt} /></div><figcaption>{p.caption}</figcaption></figure>)}</div><p className="expert-caption">프로그램을 설명하기 위한 참고 사진입니다.</p></section>

      <section className="expert-section" id="expert-reviews"><div className="expert-section-title"><h2>이용 후기</h2><span>예시 후기</span></div><div className="expert-review-score"><b>{e.rating.toFixed(1)}</b><div><span className="expert-review-stars" aria-label={`예시 평점 ${e.rating.toFixed(1)}점`}>{Array.from({ length: 5 }, (_, i) => <Icon key={i} name="star" size={16} />)}</span><span>예시 평점 · {e.reviews}건</span></div></div>
        {[['김○○ 보호자', '준비해야 할 내용과 진행 순서를 차근차근 설명해 주셔서 이해하기 쉬웠어요.'], ['이○○ 이용자', '가능한 장소와 일정을 먼저 확인할 수 있어서 프로그램을 알아보는 데 도움이 됐어요.']].map(([who, text]) => <article className="expert-review" key={who}><b>{who}</b><span>예시 후기</span><p>{text}</p></article>)}
      </section>

      <section className="expert-section" id="expert-faq"><h2>질문답변</h2>{[['신청하면 바로 일정이 확정되나요?', '희망 일정을 전달한 뒤 전문가의 가능 시간과 필요한 평가를 확인합니다. 신청만으로 배정이나 일정이 확정되지는 않습니다.'], ['처음에는 무엇을 준비하나요?', '퇴원 시 받은 안내와 주의사항, 이용 가능한 장소와 희망 일정을 준비해 주세요. 필요한 정보는 프로그램 시작 전에 확인합니다.'], ['보호자도 함께 확인할 수 있나요?', '보호자가 대신 신청할 수 있습니다. 관리 기록의 공유 범위는 이용자 동의와 운영 조건에 따라 확인합니다.']].map(([q, a]) => <article className="expert-answer" key={q}><h3>{q}</h3><p>{a}</p></article>)}</section>
    </div>

    <aside className="expert-booking"><div><p><b>{e.name}</b> 전문가에게<br />원하는 프로그램을 신청해 보세요.</p><a href={href} className="expert-apply">프로그램 신청하기</a></div><p className="expert-booking-note">조건을 확인한 뒤 일정을 조율합니다.</p></aside>
    </div>
    <div className="expert-mobile-apply"><span>{won(e.price)}<small> / 회 · 예시</small></span><a href={href}>신청하기</a></div>

  </div>
    {sharing && <Modal title="프로필 공유" onClose={() => setSharing(false)}><p className="profile-share-description">{e.name} 전문가의 프로필 링크를 공유해 보세요.</p><input className="profile-share-link" aria-label="프로필 공유 링크" value={shareUrl} readOnly onFocus={event => event.currentTarget.select()}/><button className="profile-share-copy" onClick={copyShare}>{copied ? "복사 완료" : "링크 복사"}</button>{copied && <p className="profile-share-status" role="status">링크를 복사했어요.</p>}{copyError && <p className="profile-share-error" role="alert">{copyError}</p>}</Modal>}
</div>;
}
