import type { Patient } from "@/lib/repo";

/**
 * 방문 장소: 자택 방문 또는 제휴 센터·공간.
 * 장소는 담당 의사가 처방에서 허용하고(기본 장소 + 허용 장소), 회차마다 보호자가 변경을 요청할 수 있습니다.
 * 상세 주소는 담당 치료사·보호자·병원만 보고, 운영 화면은 구 단위까지만 보여 줍니다. 공동현관 비밀번호 같은 출입 정보는 저장하지 않습니다.
 */
export type PlaceKind = "자택" | "센터";
export type Place = { kind: PlaceKind; centerId?: string };

export type Center = { id: string; name: string; area: string; address: string; image: string; tags: string[]; description: string };
// 체험용 예시 공간 (주소는 가상의 예시)
export const CENTERS: Center[] = [
  { id: "saebom", name: "새봄 연합재활센터", area: "서울 송파구", address: "서울 송파구 예시로 10, 3층 (체험용 주소)", image: "/images/studio-v2.jpg", tags: ["센터 수업", "의사 상주", "주차 가능"], description: "센터 의사의 확인을 받아 치료사가 수업을 진행하는 센터입니다." },
  { id: "live", name: "리브 움직임 스튜디오", area: "서울 송파구", address: "서울 송파구 예시로 12, 2층 (체험용 주소)", image: "/images/studio-v2.jpg", tags: ["개인 프로그램", "주차 가능", "엘리베이터"], description: "차분한 환경에서 전문가와 함께 프로그램을 진행하는 공간입니다." },
  { id: "onyu", name: "온유 밸런스 센터", area: "성남 분당구", address: "성남 분당구 예시대로 45, 3층 (체험용 주소)", image: "/images/pilates-v2.jpg", tags: ["그룹 프로그램", "탈의실"], description: "여유로운 공간과 기본 운동 장비를 갖춘 프로그램 공간입니다." },
  { id: "mapo", name: "마포 웰니스 라운지", area: "서울 마포구", address: "서울 마포구 예시길 7, 1층 (체험용 주소)", image: "/images/gym.jpg", tags: ["장비 이용", "엘리베이터"], description: "일상 활동과 기능 관리 프로그램을 위한 공간입니다." },
];
export const centerOf = (id?: string) => CENTERS.find(c => c.id === id);

/** 이번(다음) 회차 장소: 이번만 바꾼 장소가 있으면 그것, 없으면 기본 장소 */
export const upcomingPlace = (p: Patient): Place => p.nextPlace ?? p.place ?? { kind: "자택" };
export const samePlace = (a?: Place, b?: Place) => !!a && !!b && a.kind === b.kind && (a.kind === "자택" || a.centerId === b.centerId);

export function placeName(place?: Place) {
  if (!place || place.kind === "자택") return "자택 방문";
  return centerOf(place.centerId)?.name ?? "제휴 센터";
}
/** full=false면 구 단위까지만 (운영 화면, 종료 후) */
export function placeAddress(p: Patient, place?: Place, full = true) {
  const pl = place ?? upcomingPlace(p);
  if (pl.kind === "센터") return centerOf(pl.centerId)?.address ?? "";
  return full && p.homeAddress ? p.homeAddress : p.area;
}
export const mapUrl = (address: string) => `https://map.naver.com/p/search/${encodeURIComponent(address.replace(/\s*\(체험용 주소\)/, ""))}`;
/** 처방이 허용한 장소인지 */
export const placeAllowed = (p: Patient, place: Place) => !p.prescription?.places || p.prescription.places.includes(place.kind);
/** 대상 지역과 가까운 센터 먼저 */
export const centersNear = (area: string) => [...CENTERS].sort((a, b) => Number(b.area === area) - Number(a.area === area) || Number(b.area.split(" ")[0] === area.split(" ")[0]) - Number(a.area.split(" ")[0] === area.split(" ")[0]));
