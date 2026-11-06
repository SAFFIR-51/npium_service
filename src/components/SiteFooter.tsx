import Link from "next/link";
import Image from "next/image";

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-cols">
          <div>
            <Link href="/" className="footer-logo" aria-label="NPIUM 홈"><Image src="/brand/npium-wordmark-uppercase-heavy.svg" width={74} height={18} alt="NPIUM" /></Link>
            <p>의사들이 함께 연 재활 센터와 치료사, 이용자를 잇는 서비스</p>
          </div>
          <div>
            <h4>이용자</h4>
            <Link href="/experts">치료사 찾기</Link>
            <Link href="/my">내 관리</Link>
          </div>
          <div>
            <h4>센터·치료사</h4>
            <Link href="/center">센터 화면</Link>
            <Link href="/expert">치료사 화면</Link>
          </div>
        </div>
        <p className="footer-note">
          이 화면의 센터·치료사·후기·금액은 모두 시안용 예시입니다. 입력과 변경은 이 브라우저의 체험 데이터에만 반영되며 실제 기관에 전송되지 않습니다.
        </p>
        <p className="footer-copy">© 2026 NPIUM</p>
      </div>
    </footer>
  );
}


