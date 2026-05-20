import React, { useState } from 'react';
import { Storage, uid } from '../lib/storage.js';

const todayISO = () => new Date().toISOString().slice(0, 10);

// 가입 직후 dashboard 첫 화면 — 다른 위젯 다 가리고 2-column 단순 입력
// 왼쪽: 현재 체중 (숫자) / 오른쪽: 방문 목적 (4 버튼)
// 완료 시 user.visitPurpose 업데이트 + 첫 weight log 저장 → dashboard 정상 활성화
export function InitialSetup({ user, onDone }) {
  const lastLog = Storage.getLogsByUser(user.id).slice(-1)[0];
  const [weight, setWeight] = useState(lastLog?.weight ? String(lastLog.weight) : (user.startWeight ? String(user.startWeight) : ''));
  const [purpose, setPurpose] = useState(user.visitPurpose || '');

  const w = +weight;
  const canStart = w >= 30 && w <= 250 && !!purpose;

  const start = () => {
    if (!canStart) return;
    // user.visitPurpose + startWeight 업데이트
    const updates = { ...user, visitPurpose: purpose };
    if (!user.startWeight) updates.startWeight = w;
    if (!user.targetWeight) updates.targetWeight = +(w * 0.85).toFixed(1);
    Storage.upsertUser(updates);
    // 첫 체중 log (오늘) — 이미 있으면 중복 안 함
    const today = todayISO();
    const todayLog = Storage.getLogsByUser(user.id).find(l => l.date === today);
    if (!todayLog) {
      Storage.addLog({
        id: uid('log'),
        userId: user.id,
        date: today,
        weight: w,
        appetiteChange: 3,
        satiety: 3,
        sideEffects: {},
        mealReduction: 3,
        notes: '',
        createdAt: new Date().toISOString(),
      });
    }
    onDone?.();
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="card w-full max-w-3xl border-2 border-brand-300 dark:border-brand-700/50 bg-gradient-to-br from-brand-50/40 to-white dark:from-brand-900/15 dark:to-slate-900 !p-6 sm:!p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-900 dark:text-slate-100">
            {user.nickname}님 환영합니다 👋
          </h1>
          <p className="text-sm text-ink-500 dark:text-slate-400 mt-2">
            2가지만 알려주시면 본인 맞춤 통계가 시작됩니다
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* 왼쪽: 체중 (숫자 input) */}
          <div>
            <label className="block">
              <div className="text-sm font-semibold text-ink-900 dark:text-slate-100 mb-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-bold mr-2">1</span>
                현재 체중
              </div>
              <div className="relative">
                <input
                  type="number" inputMode="decimal" step="0.1" min={30} max={250}
                  value={weight}
                  onChange={e => setWeight(e.target.value)}
                  placeholder="예: 72.5"
                  autoFocus
                  className="w-full text-4xl font-extrabold tabular-nums text-center py-6 rounded-2xl border-2 border-ink-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-brand-500 focus:outline-none transition"
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-base text-ink-500 dark:text-slate-500 font-semibold">kg</span>
              </div>
              <p className="text-xs text-ink-500 dark:text-slate-400 mt-2 text-center">
                30 - 250 kg 사이로 입력
              </p>
            </label>
          </div>

          {/* 오른쪽: 방문 목적 (4 버튼) */}
          <div>
            <div className="text-sm font-semibold text-ink-900 dark:text-slate-100 mb-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-bold mr-2">2</span>
              현재 어느 단계인가요?
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'using',      icon: '💉', label: '약 사용 중' },
                { id: 'planning',   icon: '🤔', label: '곧 시작 예정' },
                { id: 'stopped',    icon: '⏸️', label: '중단 고려 중' },
                { id: 'sideeffect', icon: '⚠️', label: '부작용 경험' },
              ].map(o => (
                <button key={o.id} type="button" onClick={() => setPurpose(o.id)}
                        className={`px-3 py-4 rounded-xl font-medium border-2 transition text-center
                                    ${purpose === o.id
                                      ? 'bg-brand-500 text-white border-brand-500 shadow-md'
                                      : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-200 dark:border-slate-700 hover:border-brand-400'}`}>
                  <div className="text-2xl mb-1">{o.icon}</div>
                  <div className="text-xs sm:text-sm">{o.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <button onClick={start} disabled={!canStart}
                className="btn-primary w-full mt-6 !py-4 text-base font-bold">
          {canStart ? '✓ 시작하기' : '체중 + 단계를 모두 입력하세요'}
        </button>

        <p className="text-[11px] text-ink-500 dark:text-slate-500 text-center mt-3">
          키·성별·나이대는 가입 후 프로필에서 보강할 수 있어요. 입력할수록 통계가 더 정확해집니다.
        </p>
      </div>
    </div>
  );
}
