"use client";
import { experts } from "@/lib/data";
import { seed } from "./seed";
import { normalizeWorkflow, prescriptionForDate } from "@/lib/workflow";
import { createRepository } from "./engine";
import { LEGACY_CENTER_NAMES } from "@/lib/center";
import { todayLocal } from "../date";
export { todayLocal } from "../date";
import type { CareRepository, CareState, Patient } from "./types";

/**
 * 브라우저 체험용 저장소. localStorage에 예시 데이터를 보관합니다.
 * 실제 서비스 데이터(건강 정보)는 여기에 저장하면 안 됩니다.
 */
const KEY = "npium-care-preview-v1";
/** 이름 변경(NOPIUM → NPIUM) 전 저장 키. 남아 있으면 한 번 이어받습니다. */
const LEGACY_KEY = "nopium-care-preview-v1";

let cached: CareState = normalizeWorkflow(seed);
let initialized = false;
const listeners = new Set<() => void>();

/** 이전 버전에 저장된 체험 데이터를 현재 구조로 맞춥니다. */
function migrate(parsed: Partial<CareState>): CareState {
  const providerIdByName = new Map(experts.map(e => [e.name, e.id]));
  const seedById = new Map(seed.patients.map(p => [p.id, p]));
  const patients: Patient[] = (parsed.patients ?? seed.patients).map(stored => {
    // 예시 대상은 새로 추가된 필드를 예시 값으로 채웁니다.
    const example = seedById.get(stored.id);
    const p = { ...example, ...stored } as Patient;
    // 병원·기관 → 센터로 바뀌면서 예전 기관 이름을 센터 이름으로 이어받습니다.
    if (LEGACY_CENTER_NAMES[p.hospital]) p.hospital = LEGACY_CENTER_NAMES[p.hospital];
    // 예전에 저장된 예시 처방에는 진료과 프로토콜(금기·주의사항)이 없어서 예시 값으로 채웁니다.
    const exRx = example?.prescription;
    if (p.prescription && exRx?.protocolId && !p.prescription.protocolId) {
      p.prescription = { ...p.prescription, protocolId: exRx.protocolId, contraindications: exRx.contraindications, cautions: exRx.cautions, doctorOpinion: exRx.doctorOpinion, consentChecked: exRx.consentChecked };
    }
    // 첫 예시 소견의 좌우 표기 오류(평가 기록은 우측)를 바로잡습니다.
    if (p.prescription?.doctorOpinion?.startsWith("좌측 편마비. 실내 보행은") && exRx?.doctorOpinion) p.prescription = { ...p.prescription, doctorOpinion: exRx.doctorOpinion };
    return p.providerId || !p.provider ? p : { ...p, providerId: providerIdByName.get(p.provider) };
  });
  // 이전 체험 데이터에 남은 홈 운동·컨디션 기록은 버립니다.
  const { homeExercises: _h, exerciseLogs: _e, conditionLogs: _c, ...rest } = parsed as Partial<CareState> & Record<string, unknown>;
  void _h; void _e; void _c;
  return normalizeWorkflow({
    ...seed,
    ...rest,
    patients,
    homeTasks: parsed.homeTasks ?? [],
    assignments: parsed.assignments ?? [],
    applications: parsed.applications ?? [],
    scheduleRequests: parsed.scheduleRequests ?? [],
    linkages: parsed.linkages ?? seed.linkages,
    contracts: parsed.contracts ?? seed.contracts,
    billing: parsed.billing ?? seed.billing,
    inquiries: parsed.inquiries ?? seed.inquiries,
    // 예시 문의 메시지는 없으면 채웁니다.
    messages: [...(parsed.messages ?? []), ...seed.messages.filter(m => !(parsed.messages ?? []).some(x => x.id === m.id))],
    // 예시 대상의 평가 기록은 새 단계 구조에 필요하므로 없으면 채웁니다.
    // 예시 평가가 예전 형식(글만)이면 구조화 항목(관절 각도·근력 등급·주거 환경)을 예시 값으로 채웁니다.
    assessments: [...seed.assessments.filter(a => !(parsed.assessments ?? []).some(x => x.id === a.id)), ...(parsed.assessments ?? []).map(a => {
      const ex = seed.assessments.find(x => x.id === a.id);
      return ex && a.romItems === undefined && a.mmtItems === undefined ? { ...a, romItems: ex.romItems, mmtItems: ex.mmtItems, homeRisks: ex.homeRisks } : a;
    })],
  } as CareState);
}

function read(): CareState {
  if (typeof window !== "undefined" && !initialized) {
    initialized = true;
    try {
      const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.patients) && Array.isArray(parsed.records) && Array.isArray(parsed.reports)) cached = migrate(parsed);
      }
    } catch {
      cached = normalizeWorkflow(seed);
    }
  }
  let changed = false;
  const patients = cached.patients.map(p => { const v = prescriptionForDate(cached, p, todayLocal()); if (!v || p.activePrescriptionVersionId === v.id) return p; changed = true; return { ...p, prescription: v.prescription, precautions: v.precautions, doctor: v.prescription.doctor, activePrescriptionVersionId: v.id }; });
  if (changed) cached = { ...cached, patients };
  return cached;
}

function write(fn: (state: CareState) => CareState) {
  cached = fn(read());
  try {
    localStorage.setItem(KEY, JSON.stringify(cached));
  } catch {
    /* 저장소를 쓸 수 없어도 현재 화면은 계속 동작하게 둡니다. */
  }
  listeners.forEach(l => l());
}

export const localRepository: CareRepository = createRepository(read, write, listener => {
  listeners.add(listener);
  const onStorage = () => { initialized = false; listeners.forEach(l => l()); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}, () => seed);
