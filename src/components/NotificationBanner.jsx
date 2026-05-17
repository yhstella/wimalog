import React, { useState } from 'react';
import { useToast } from './Toast.jsx';

const KEY = 'gl_notify';

export function NotificationBanner({ user }) {
  const toast = useToast();
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(KEY + '_dismissed'));
  const [enabled, setEnabled] = useState(() => !!localStorage.getItem(KEY + '_enabled'));
  if (dismissed || enabled) return null;

  const enable = async () => {
    if ('Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          localStorage.setItem(KEY + '_enabled', '1');
          setEnabled(true);
          toast.success('알림 권한 허용됨 — 백엔드 출시 후 일일 알림 발송 시작');
          new Notification('위마로그', { body: '오늘 체중을 기록해 보세요 🌱' });
          return;
        }
      } catch {}
    }
    toast.error('알림 권한 거부됨 또는 브라우저 미지원');
  };

  const dismiss = () => {
    localStorage.setItem(KEY + '_dismissed', '1');
    setDismissed(true);
  };

  return (
    <div className="card !p-4 bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/20 dark:to-slate-900 border border-brand-200 dark:border-brand-800/40">
      <div className="flex items-start gap-3">
        <div className="text-2xl">🔔</div>
        <div className="flex-1">
          <div className="font-bold text-ink-900 dark:text-slate-100">매일 체중 기록 알림</div>
          <p className="text-xs text-ink-500 dark:text-slate-400 mt-1">
            매일 같은 시간 알림 — 스트릭 유지에 도움. 브라우저 권한 필요.
          </p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={enable} className="btn-primary !py-2 !px-3 text-xs">권한 허용</button>
        <button onClick={dismiss} className="btn-secondary !py-2 !px-3 text-xs">나중에</button>
      </div>
      <p className="text-[10px] text-ink-500 dark:text-slate-500 mt-2">
        ⚠ 현재 MVP는 권한만 받음. 백엔드 출시 후 일일 알림 발송 시작.
      </p>
    </div>
  );
}
