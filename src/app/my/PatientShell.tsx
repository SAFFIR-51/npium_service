"use client";
import { useState } from "react";
import { Modal } from "@/components/CareUI";
import { usePatientAccount } from "@/lib/demo-session";
import Link from "next/link";
import { type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { RoleShell } from "@/components/RoleShell";
import { selectPatient, usePatientCare } from "./use-patient-care";
import { flowStep } from "@/lib/center";
import "./my-page.css";

export function PatientShell({ children }: { children: ReactNode }) {
  const { patients } = usePatientCare();
  const me = usePatientAccount();
  return <RoleShell layout="list" area="patient" person={{ name: `${me.name} 님`, sub: `${me.relation} · 연결된 대상 ${patients.length}명`, icon: "user" }} menu={[]}>{children}</RoleShell>;
}

/** 하위 화면 상단: 숨고 하위 화면처럼 뒤로 가기 + 제목. */
export function MySubHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="my-subheader">
    <Link href="/my" className="my-back" aria-label="내 관리로 돌아가기"><Icon name="chevron" size={20} /></Link>
    <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
    {action}
  </div>;
}

/** 같은 화면에서 관리 대상을 선택하고 바로 닫는 팝업입니다. */
export function PatientSwitch() {
  const { state, patients, patient } = usePatientCare();
  const [open, setOpen] = useState(false);
  if (!patient) return null;
  return <div className="my-picker"><button type="button" className="my-picker-btn" aria-label="관리 대상 선택" disabled={patients.length < 2} onClick={() => setOpen(true)}><span className="my-picker-text"><b>{patient.name} 님</b><small>{patient.condition}</small></span><span className="care-status">{flowStep(state, patient)}</span>{patients.length > 1 && <Icon name="down" size={16} />}</button>{open && <Modal title="관리 대상 선택" onClose={() => setOpen(false)}><div className="patient-choice-list">{patients.map(p => <button key={p.id} type="button" aria-pressed={p.id === patient.id} onClick={() => { selectPatient(p.id); setOpen(false); }}><span><b>{p.name} 님</b><small>{p.condition} · {flowStep(state, p)}</small></span>{p.id === patient.id && <Icon name="check" size={18} />}</button>)}</div></Modal>}</div>;
}
