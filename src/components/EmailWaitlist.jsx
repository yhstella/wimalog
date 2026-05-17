import React, { useState } from 'react';
import { useToast } from './Toast.jsx';

// 이메일 알림 대기열 — 백엔드 출시 시 활용
const KEY = 'gl_waitlist';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; }
  catch { return []; }
}

export function EmailWaitlist({ title, description, feature = 'updates' }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(() => {
    try { return localStorage.getItem(`${KEY}_${feature}_done`) === '1'; }
    catch { return false; }
  });

  const submit = (e) => {
    e?.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('이메일 형식 확인');
      return;
    }
    const list = load();
    list.push({ email, feature, date: new Date().toISOString() });
    localStorage.setItem(KEY, JSON.stringify(list));
    localStorage.setItem(`${KEY}_${feature}_done`, '1');
    setDone(true);
    toast.success('신청 완료 — 출시 시 알려드릴게요');
  };

  if (done) {
    return (
      <div className="card !p-4 bg-brand-50/60 dark:bg-brand-900/15 border border-brand-200 dark:border-brand-800/40 flex items-center gap-3">
        <div className="text-2xl">✓</div>
        <div className="text-sm text-ink-700 dark:text-slate-300">
          신청 완료 — 출시 시 알림 받아보실 수 있어요
        </div>
      </div>
    );
  }

  return (
    <div className="card !p-4">
      <div className="flex items-start gap-3">
        <div className="text-2xl">📧</div>
        <div className="flex-1">
          <div className="font-bold text-ink-900 dark:text-slate-100">{title}</div>
          <p className="text-xs text-ink-500 dark:text-slate-400 mt-1">{description}</p>
        </div>
      </div>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input type="email" required value={email}
               onChange={e => setEmail(e.target.value)}
               placeholder="이메일 주소"
               className="input flex-1" />
        <button type="submit" className="btn-primary !py-2 !px-4 text-sm">신청</button>
      </form>
      <p className="text-[10px] text-ink-500 dark:text-slate-500 mt-2">
        ⚠ 현재 MVP 단계 — 백엔드 출시 후 실제 알림 발송 예정. 이메일은 본인 브라우저에만 저장됩니다.
      </p>
    </div>
  );
}
