const test = require('node:test'), assert = require('node:assert/strict');
const { fixture } = require('./fixture.cjs');
const { flowStep, balanceOf, settlement } = require('../src/lib/center.ts');
const { scopedState, authorize } = require('../src/lib/server/authorization.ts');
const apply = { name:'신청 환자', age:70, sex:'여', condition:'무릎 수술 후', area:'서울', goal:'', precautions:'', nextDate:'2026-11-20', nextTime:'10:00', applicant:'보호자', guardianAccountId:'guardian', consent:true };
const withProgram = (payment='이용권') => { const f=fixture(); f.state={...f.state, programs:[{ id:'pg', center:'병원A', providerId:'a', title:'방문 재활', method:'방문', minutes:60, payment, price:50000, packSessions:payment==='이용권'?10:undefined, packPrice:payment==='이용권'?450000:undefined, active:true }]}; return f; };
const check = { doctor:'센터 의사', opinion:'진행 가능', contraindications:['점프'], cautions:['낙상 주의'] };

test('신청 → 치료사 수락 → 의사 확인 순서로만 예약이 확정된다', () => {
  const f = withProgram();
  const id = f.repo.applyToProvider(apply, 'a', 'pg'); const p = () => f.state.patients.find(x => x.id === id);
  assert.equal(flowStep(f.state, p()), '치료사 수락 대기');
  assert.equal(f.repo.confirmByDoctor(id, check, '2026-11-20', '10:00'), false, '수락 전에는 의사 확인 불가');
  assert.equal(f.repo.acceptRequest(id, { id:'b', name:'다른 치료사' }), false, '신청받지 않은 치료사는 수락 불가');
  assert.equal(f.repo.acceptRequest(id, { id:'a', name:'테스트 치료사 a' }), true);
  assert.equal(flowStep(f.state, p()), '의사 확인 대기');
  assert.equal(f.repo.confirmByDoctor(id, { ...check, opinion:' ' }, '2026-11-20', '10:00'), false, '소견 없이 확인 불가');
  assert.equal(f.repo.confirmByDoctor(id, check, '2026-11-20', '10:00'), true);
  assert.equal(flowStep(f.state, p()), '예약 확정');
  assert.deepEqual(p().doctorCheck.contraindications, ['점프']);
  const b = balanceOf(f.state, p()); assert.equal(b.pending.length, 1); assert.equal(b.pendingAmount, 450000);
});

test('치료사가 거절하면 센터가 담당을 정하고 결제 대기는 한 건만 둔다', () => {
  const f = withProgram('회차별');
  const id = f.repo.applyToProvider(apply, 'a', 'pg');
  f.repo.declineAssignment(id, { id:'a', name:'테스트 치료사 a' }, '일정 불가');
  assert.equal(flowStep(f.state, f.state.patients.find(x => x.id === id)), '담당 배정 필요');
  assert.equal(f.repo.changeProvider(id, { id:'b', name:'테스트 치료사 b' }, '대체 배정', '센터 의사'), true);
  assert.equal(f.state.patients.find(x => x.id === id).status, '승인 대기');
  f.repo.confirmByDoctor(id, check, '2026-11-21', '11:00');
  assert.equal(f.repo.requestPayment(id, 'pg', '회차', '센터 의사'), '', '결제 대기가 있으면 새 요청 안 함');
  const pay = f.state.payments.find(x => x.patientId === id);
  assert.equal(f.repo.markPaid(pay.id, '카드'), true);
  assert.equal(f.repo.markPaid(pay.id, '카드'), false, '두 번 결제 표시 불가');
});

test('정산은 확정 회차 × 1회 금액 × 비율', () => {
  const f = withProgram('회차별'); f.state.patients[0].programId = 'pg';
  const s = settlement(f.state, 'a', '2026-10'); assert.equal(s.rows.length, 1); assert.equal(s.gross, 50000); assert.equal(s.share, 30000);
});

test('서버: 센터는 자기 센터 회원만 보고, 의사 확인 서명은 서버가 정한다', () => {
  const f = withProgram();
  const center = { id:'c', username:'c', name:'센터 의사', role:'center', organization:'병원A', providerId:'' };
  const other = { ...center, organization:'병원B' };
  assert.equal(scopedState(f.state, center).patients.length, 1);
  assert.equal(scopedState(f.state, other).patients.length, 0);
  assert.throws(() => authorize(f.state, other, 'confirmByDoctor', ['p', check, '2026-11-20', '10:00']));
  const args = authorize(f.state, center, 'confirmByDoctor', ['p', { ...check, doctor:'위조 의사' }, '2026-11-20', '10:00']);
  assert.equal(args[1].doctor, '센터 의사 · 병원A');
  assert.throws(() => authorize(f.state, { ...center, role:'patient', id:'guardian' }, 'confirmByDoctor', ['p', check, '2026-11-20', '10:00']));
});

test('다른 장소 프로그램은 제휴 공간이 있어야 하고, 신청하면 그 공간이 진행 장소가 된다', () => {
  const f = withProgram('회차별');
  const base = { id:'', center:'병원A', providerId:'a', title:'공원 걷기 교실', method:'외부', minutes:50, payment:'회차별', price:40000, active:true };
  assert.equal(f.repo.saveProgram(base), false, '장소 없이 저장 불가');
  assert.equal(f.repo.saveProgram({ ...base, placeId:'live' }), true);
  const pg = f.state.programs.find(x => x.title === '공원 걷기 교실');
  const id = f.repo.applyToProvider(apply, 'a', pg.id);
  const p = f.state.patients.find(x => x.id === id);
  assert.deepEqual(p.place, { kind:'센터', centerId:'live' }); assert.equal(p.method, '센터');
});
