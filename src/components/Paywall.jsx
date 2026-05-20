import React, { useState, useEffect } from 'react';
import { Storage, uid } from '../lib/storage.js';
import { bmi, bmiCategory } from '../lib/stats.js';
import { supabaseConfigured } from '../lib/supabaseClient.js';
import { signInWithOAuth } from '../lib/auth.js';
import { DialInput } from './DialInput.jsx';

/* ============================================================
   Locked Overlay — 잠긴 콘텐츠 위에 가입 CTA를 띄움
============================================================ */
export function LockedOverlay({
  children,
  reason = 'free',  // 'free' (가입 필요) | 'premium' (유료)
  title,
  message,
  onUnlock,
  minHeight = 160,
}) {
  const isPremium = reason === 'premium';
  return (
    <div className="relative" style={{ minHeight }}>
      <div className="blur-[6px] pointer-events-none select-none" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-white/40 via-white/70 to-white/90 rounded-2xl">
        <div className="text-center max-w-xs px-6 py-5">
          <div className="text-3xl mb-1">{isPremium ? '✨' : '🔒'}</div>
          <div className="font-bold text-ink-900">
            {title || (isPremium ? 'Premium 기능' : '가입자 전용')}
          </div>
          <div className="text-sm text-ink-500 mt-1 leading-snug">
            {message || (isPremium
              ? '곧 출시될 Premium 기능입니다. 알림을 신청해 주세요.'
              : '1분만 입력하면 전체 데이터를 볼 수 있어요')}
          </div>
          {onUnlock && (
            <button onClick={onUnlock} className="btn-primary mt-3 !py-2 !px-4 text-sm">
              {isPremium ? '얼리액세스 신청' : '1분 가입하고 전체 보기 →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Lock Hint — 인라인 작은 잠금 표시 (테이블 추가행 등에 사용)
============================================================ */
export function LockHint({ count, label, onUnlock }) {
  return (
    <button
      onClick={onUnlock}
      className="w-full flex items-center justify-center gap-2 py-3 text-sm rounded-xl bg-brand-50 hover:bg-brand-100 transition border border-dashed border-brand-200 text-brand-700 font-medium"
    >
      <span>🔒</span>
      <span>{count ? `${count}개 더 보기` : (label || '전체 데이터 보기')}</span>
      <span className="text-xs text-brand-500">· 가입 후</span>
    </button>
  );
}

/* ============================================================
   Premium Badge
============================================================ */
export function PremiumBadge({ size = 'sm' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 text-white font-bold
                      ${size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'}`}>
      ✨ Premium
    </span>
  );
}

/* ============================================================
   Quick Signup Modal — 1분 가입
============================================================ */
const todayISO = () => new Date().toISOString().slice(0, 10);

const SIM_PREFILL_KEY = 'wimalog_sim_prefill';
const readPrefill = () => {
  try {
    const raw = sessionStorage.getItem(SIM_PREFILL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export function QuickSignupModal({ onClose, onComplete }) {
  const [step, setStep] = useState(0);
  const [authProvider, setAuthProvider] = useState(null); // 'google' | 'kakao' | 'naver' | 'anonymous' | null
  const [oauthError, setOauthError] = useState(null);
  const [oauthLoading, setOauthLoading] = useState(null); // provider id 또는 null
  // Simulator에서 입력한 값 자동 prefill — lazy user 마찰 제거
  const prefill = readPrefill();
  const [data, setData] = useState({
    nickname: '',
    gender: 'F',
    ageGroup: '40s',
    height: prefill?.height ? String(prefill.height) : '',
    startWeight: prefill?.startWeight ? String(prefill.startWeight) : '',
    currentWeight: prefill?.startWeight ? String(prefill.startWeight) : '',
    targetWeight: '',
    consent: false,
    _prefilled: !!prefill,
  });

  // 실제 OAuth 시작 — Supabase가 redirect 처리, 콜백 후 App.jsx가 syncOAuthUser 호출
  const handleOAuth = async (provider) => {
    if (!supabaseConfigured) {
      setOauthError('소셜 로그인 미설정 — 익명 가입을 사용해 주세요');
      return;
    }
    setOauthError(null);
    setOauthLoading(provider);
    try {
      await signInWithOAuth(provider);
      // 위 호출은 페이지 redirect를 일으킴 → 아래 코드는 실행 안 됨
    } catch (e) {
      setOauthLoading(null);
      setOauthError(e?.message || `${provider} 로그인 실패`);
    }
  };

  const set = (k, v) => setData(d => ({ ...d, [k]: v }));

  const startBmi = bmi(+data.startWeight, +data.height);

  const canFinish = +data.height >= 130 && +data.height <= 220
    && +data.startWeight >= 35 && +data.startWeight <= 250
    && +data.currentWeight >= 35 && +data.currentWeight <= 250
    && data.consent;

  const complete = () => {
    if (!canFinish) return;
    const userId = uid('u');
    const user = {
      id: userId,
      seed: false,
      nickname: data.nickname || '나',
      gender: data.gender,
      ageGroup: data.ageGroup,
      height: +data.height,
      startWeight: +data.startWeight,
      targetWeight: +(data.targetWeight || (data.startWeight * 0.85).toFixed(1)),
      conditions: {},
      purpose: 'weight',
      concerns: [],
      consents: { privacy: true, sensitiveData: true, anonymizedShare: true },
      authProvider, // 'google' | 'kakao' | 'naver' | null (이메일)
      createdAt: new Date().toISOString(),
    };
    Storage.upsertUser(user);
    if (+data.currentWeight) {
      Storage.addLog({
        id: uid('log'),
        userId,
        date: todayISO(),
        weight: +data.currentWeight,
        appetiteChange: 3,
        satiety: 3,
        sideEffects: {},
        mealReduction: 3,
        notes: '',
        createdAt: new Date().toISOString(),
      });
    }
    Storage.setSession(userId);
    // prefill 정리 — 가입 완료했으니 sessionStorage 비움
    try { sessionStorage.removeItem(SIM_PREFILL_KEY); } catch {}
    onComplete(userId);
  };

  // ESC 닫기
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-ink-100 px-5 py-3 flex justify-between items-center">
          <div>
            <div className="font-bold text-ink-900">1분 가입</div>
            <div className="text-xs text-ink-500">키와 체중만 알려주세요</div>
          </div>
          <button onClick={onClose} className="btn-ghost !p-2">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* 소셜 로그인 — Google만 */}
          {!authProvider && (
            <>
              <button onClick={() => handleOAuth('google')}
                      disabled={!!oauthLoading}
                      className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-ink-900 border-2 border-ink-900 px-4 py-3.5 text-white font-bold shadow-md hover:bg-ink-700 hover:shadow-lg transition disabled:opacity-50">
                <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                {oauthLoading === 'google' ? '연결 중…' : 'Google로 계속하기'}
              </button>
              {oauthError && (
                <div className="rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 px-3 py-2 text-xs text-rose-900 dark:text-rose-200">
                  ⚠ {oauthError}
                </div>
              )}
              <p className="text-[11px] text-ink-500 dark:text-slate-500 text-center leading-relaxed">
                Google 계정으로 안전하게 시작하세요.
              </p>
            </>
          )}

          {/* 입력 폼 (소셜/익명 선택 후 노출) */}
          {authProvider && (
          <>
          <div className="rounded-lg bg-ink-100 dark:bg-slate-800 px-3 py-2 text-xs text-ink-700 dark:text-slate-300 flex items-center justify-between">
            <span>🔵 Google로 시작합니다</span>
            <button onClick={() => setAuthProvider(null)} className="text-brand-700 dark:text-brand-400 underline">
              변경
            </button>
          </div>
          {data._prefilled && (
            <div className="rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800/40 px-3 py-2 text-xs text-brand-800 dark:text-brand-200">
              ✨ 시뮬레이터에서 입력한 키·체중을 자동으로 채웠어요. 확인만 하고 가입하세요.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label">키 (cm)</div>
              <input type="number" inputMode="decimal" min={130} max={220} step="0.1"
                     className="input" value={data.height}
                     onChange={e => set('height', e.target.value)} placeholder="예: 162" autoFocus />
              <details className="mt-1 text-[10px]">
                <summary className="cursor-pointer text-ink-500 hover:text-brand-700">🎛 다이얼</summary>
                <div className="mt-1 p-2 rounded-lg border border-ink-200 dark:border-slate-700">
                  <DialInput value={+data.height || 162} onChange={(v) => set('height', String(v))}
                             min={130} max={220} step={1} majorTick={10} unit="cm" />
                </div>
              </details>
            </div>
            <div>
              <div className="label">성별</div>
              <div className="flex gap-1">
                {[
                  { id: 'F', label: '여' },
                  { id: 'M', label: '남' },
                  { id: 'X', label: '비공개' },
                ].map(o => (
                  <button key={o.id} type="button" onClick={() => set('gender', o.id)}
                          className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition
                                      ${data.gender === o.id
                                        ? 'bg-brand-500 text-white border-brand-500'
                                        : 'bg-white text-ink-700 border-ink-300'}`}>{o.label}</button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="label">나이대</div>
            <div className="grid grid-cols-5 gap-1">
              {[
                { id: '20s', label: '20대' }, { id: '30s', label: '30대' },
                { id: '40s', label: '40대' }, { id: '50s', label: '50대' },
                { id: '60s+', label: '60+' },
              ].map(o => (
                <button key={o.id} type="button" onClick={() => set('ageGroup', o.id)}
                        className={`py-2 rounded-lg text-xs font-medium border transition
                                    ${data.ageGroup === o.id
                                      ? 'bg-brand-500 text-white border-brand-500'
                                      : 'bg-white text-ink-700 border-ink-300'}`}>{o.label}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label">시작 체중 (kg)</div>
              <input type="number" inputMode="decimal" min={35} max={250} step="0.1"
                     className="input" value={data.startWeight}
                     onChange={e => {
                       set('startWeight', e.target.value);
                       if (!data.currentWeight) set('currentWeight', e.target.value);
                     }} />
              <details className="mt-1 text-[10px]">
                <summary className="cursor-pointer text-ink-500 hover:text-brand-700">🎛 다이얼</summary>
                <div className="mt-1 p-2 rounded-lg border border-ink-200 dark:border-slate-700">
                  <DialInput value={+data.startWeight || 70} onChange={(v) => {
                    set('startWeight', String(v));
                    if (!data.currentWeight) set('currentWeight', String(v));
                  }} min={35} max={250} step={1} majorTick={10} unit="kg" />
                </div>
              </details>
            </div>
            <div>
              <div className="label">현재 체중 (kg)</div>
              <input type="number" inputMode="decimal" min={35} max={250} step="0.1"
                     className="input" value={data.currentWeight}
                     onChange={e => set('currentWeight', e.target.value)} />
              <details className="mt-1 text-[10px]">
                <summary className="cursor-pointer text-ink-500 hover:text-brand-700">🎛 다이얼</summary>
                <div className="mt-1 p-2 rounded-lg border border-ink-200 dark:border-slate-700">
                  <DialInput value={+data.currentWeight || +data.startWeight || 70}
                             onChange={(v) => set('currentWeight', String(v))}
                             min={35} max={250} step={1} majorTick={10} unit="kg" />
                </div>
              </details>
            </div>
          </div>

          {startBmi != null && +data.height > 0 && +data.startWeight > 0 && (
            <div className="rounded-xl bg-brand-50 px-3 py-2 text-sm">
              시작 BMI <b className="text-brand-700 tabular-nums">{startBmi.toFixed(1)}</b>
              <span className="ml-2 chip-brand">{bmiCategory(startBmi)}</span>
            </div>
          )}

          <label className="flex items-start gap-2 p-3 rounded-xl border border-ink-300 cursor-pointer">
            <input type="checkbox" className="mt-0.5 w-5 h-5 accent-brand-500 flex-shrink-0"
                   checked={data.consent}
                   onChange={e => set('consent', e.target.checked)} />
            <div>
              <div className="text-sm font-medium text-ink-900">개인정보·민감정보 수집·이용에 동의합니다</div>
              <div className="text-xs text-ink-500 mt-0.5">데이터는 익명 처리되어 본인 브라우저에만 저장됩니다</div>
            </div>
          </label>

          <button onClick={complete} disabled={!canFinish} className="btn-primary w-full !py-3 text-base">
            가입하고 전체 데이터 보기 →
          </button>

          <button onClick={onClose} className="w-full text-xs text-ink-500 hover:text-ink-700 transition py-1">
            나중에 할게요
          </button>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
