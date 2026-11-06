"use client";
import { visiblePatients } from "@/lib/access";
import { useCare } from "@/lib/repo";
import { useCenterAccount, useRole } from "@/lib/demo-session";
import { allProviders } from "@/lib/workflow";
import { centerByName, centerOfProvider, DEMO_CENTER, flowStep } from "@/lib/center";

/** 센터 소속 이용자·치료사·프로그램·결제만 봅니다. */
export function useCenterCare() {
  const state = useCare();
  const me = useCenterAccount();
  const patients = visiblePatients(state, useRole() === "center" ? "center" : null);
  const center = centerByName(me.organization) ?? DEMO_CENTER;
  const providers = allProviders(state).filter(e => centerOfProvider(e.id).id === center.id);
  const programs = state.programs.filter(p => p.center === center.name);
  const ids = new Set(patients.map(p => p.id));
  const payments = state.payments.filter(x => ids.has(x.patientId));
  const stepOf = (id: string) => { const p = patients.find(x => x.id === id); return p ? flowStep(state, p) : null; };
  return { state, me, center, patients, providers, programs, payments, stepOf };
}
