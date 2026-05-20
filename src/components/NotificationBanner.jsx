import React, { useState, useEffect } from 'react';
import { useToast } from './Toast.jsx';

const KEY = 'gl_notify';

// 모바일 환경 감지 — touch + 좁은 viewport 둘 다 충족 시 모바일로 판정
// 데스크탑 브라우저는 매일 알림 의미가 약함 (탭 안 열려있으면 안 옴)
function isMobileDevice() {
  if (typeof window === 'undefined') return false;
  const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const isNarrow = window.matchMedia('(max-width: 768px)').matches;
  // UA fallback (iPadOS는 macOS UA를 쓸 수 있어 보조)
  const uaMobile = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent || '');
  return (hasTouch && isNarrow) || uaMobile;
}

export function NotificationBanner({ user }) {
  const toast = useToast();
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(KEY + '_dismissed'));
  const [enabled, setEnabled] = useState(() => !!localStorage.getItem(KEY + '_enabled'));
  const [mobile, setMobile] = useState(() => isMobileDevice());
  useEffect(() => {
    const handler = () => setMobile(isMobileDevice());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  // 데스크탑에서는 노출 안 함 — 매일 알림은 모바일 환경에서만 효과적
  if (!mobile) return null;
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
        브라우저 알림 권한이 필요합니다. 알림은 본인 기기에서만 동작합니다.
      </p>
    </div>
  );
}
