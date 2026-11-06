import { FLOW_NOTE, FLOW_STEPS, flowIndex, type FlowStep } from "@/lib/center";
import "./center-ui.css";

/**
 * 신청 → 치료사 수락 → 의사 확인 → 예약 확정 → 진행 중
 * 지금 단계를 글로 먼저 보여 주고, 아래 단계 표시는 끝난 단계(체크)·지금 단계(강조)·남은 단계(번호)로 구분합니다.
 */
export function FlowSteps({ step }: { step: FlowStep }) {
  const at = flowIndex(step), ended = step === "종료";
  return <div className="cx-flow">
    <p className="cx-flow-now"><span className={`cx-flow-tag ${ended ? "end" : ""}`}>{ended ? "완료" : "지금"}</span><b>{step}</b><small>{FLOW_NOTE[step]}</small></p>
    <ol className="cx-stepper" aria-label={`진행 단계: ${step}`}>
      {FLOW_STEPS.map((s, i) => {
        const state = i < at ? "done" : i === at ? "current" : "";
        return <li key={s} className={state} aria-current={state === "current" ? "step" : undefined}>
          <span className="cx-dot" aria-hidden="true">{state === "done" ? <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 6.2 5 8.6l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : state === "current" ? null : i + 1}</span>
          <span className="cx-step-label">{s}<span className="sr">{state === "done" ? " (완료)" : state === "current" ? " (지금)" : ""}</span></span>
        </li>;
      })}
    </ol>
  </div>;
}

/** 의사 확인 내용 (금기·주의) */
export function DoctorCheckBox({ check }: { check?: { doctor: string; at: string; opinion: string; contraindications: string[]; cautions: string[] } }) {
  if (!check) return <div className="cx-box doctor"><h3>센터 의사 확인</h3><p className="cx-hint">아직 센터 의사가 확인하지 않았어요. 확인 전에는 회차를 진행하지 않습니다.</p></div>;
  return <div className="cx-box doctor">
    <h3>센터 의사 확인 · {check.doctor.split(" ")[0]}</h3>
    <p style={{ margin: "0 0 10px", fontSize: 14, lineHeight: 1.6 }}>{check.opinion}</p>
    {check.contraindications.length > 0 && <><p className="cx-hint" style={{ marginBottom: 4 }}>하지 않을 운동</p><div className="cx-chips">{check.contraindications.map(c => <span key={c} className="cx-chip contra">{c}</span>)}</div></>}
    {check.cautions.length > 0 && <><p className="cx-hint" style={{ margin: "10px 0 4px" }}>주의사항</p><div className="cx-chips">{check.cautions.map(c => <span key={c} className="cx-chip caution">{c}</span>)}</div></>}
    <p className="cx-hint" style={{ marginTop: 10 }}>확인일 {check.at.slice(0, 10).replaceAll("-", ".")}</p>
  </div>;
}
