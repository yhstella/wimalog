import React, { useMemo, useState } from 'react';
import { Storage } from '../lib/storage.js';
import { track } from '../lib/analytics.js';

// 기록 공백 감지 — 마지막 체중 기록이 N일 이상 지나면 부드러운 재기록 넛지.
// 리텐션 도구지만 게이미피케이션(스트릭/배지)이 아니라 "오늘 기록" 실용 안내.
// 조건: 이전에 기록한 적 있는 사용자(logs≥1) + 마지막 기록 3일+ 경과.
const GAP_DAYS = 3;
const DISMISS_KEY = 'wimalog_gap_dismissed';   // 값 = 오늘 날짜 (하루 단위로만 숨김)

function todayStr() { return new Date().toISOString().slice(0, 10); }

export function RecordGapBanner({ user, navigate }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === todayStr(); } catch { return false; }
  });

  const gap = useMemo(() => {
    if (!user?.id) return null;
    let logs = [];
    try { logs = Storage.getLogsByUser(user.id) || []; } catch { return null; }
    if (logs.length < 1) return null;   // 한 번도 기록 안 한 사용자는 EmptyDashboard가 담당
    const lastDate = logs
      .map(l => l.date)
      .filter(Boolean)
      .sort()
      .pop();
    if (!lastDate) return null;
    const days = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000);
    return days >= GAP_DAYS ? { days, lastDate } : null;
  }, [user]);

  if (dismissed || !gap) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, todayStr()); } catch {}
    setDismissed(true);
  };

  const goRecord = () => {
    track('record_gap_cta', { days: gap.days });
    navigate('records');
  };

  return (
    <div className="card !p-4 border border-amber-200 dark:border-amber-900/40 bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/15 dark:to-slate-900">
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0">📅</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-ink-900 dark:text-slate-100 text-sm">
            {gap.days}일째 기록이 없어요
          </div>
          <p className="text-xs text-ink-500 dark:text-slate-400 mt-1 leading-relaxed">
            오늘 체중 한 번이면 추세선이 이어집니다. 30초면 충분해요.
          </p>
          <div className="flex gap-2 mt-3">
            <button onClick={goRecord} className="btn-primary !py-2 !px-3 text-xs">
              오늘 기록하기 →
            </button>
            <button onClick={dismiss} className="btn-secondary !py-2 !px-3 text-xs">
              나중에
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
