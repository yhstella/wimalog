import React, { useEffect, useState } from 'react';

// PWA 홈 화면 추가 (Add to Home Screen) 프롬프트
// 1) Chrome/Edge — beforeinstallprompt 이벤트 캡처 후 trigger 가능
// 2) iOS Safari — 자체 install 이벤트 없음. 사용자 안내만 가능
// 3) 한 번 닫으면 7일간 다시 안 뜸 (localStorage)
const DISMISS_KEY = 'wimalog_install_dismissed_at';
const DISMISS_DAYS = 7;

export function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // dismiss 이력 체크
    try {
      const dismissedAt = +localStorage.getItem(DISMISS_KEY) || 0;
      if (Date.now() - dismissedAt < DISMISS_DAYS * 86400000) return;
    } catch {}

    // 이미 설치된 PWA 모드면 표시 안 함
    if (window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone) return;

    // iOS Safari 감지 — 별도 UI
    const ua = window.navigator.userAgent || '';
    const ios = /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/Chrome|CriOS/.test(ua);
    if (ios) {
      // 30초 dwell 후 노출 (즉시 띄우면 거슬림)
      const t = setTimeout(() => { setIsIOS(true); setShow(true); }, 30000);
      return () => clearTimeout(t);
    }

    // Chrome/Edge — beforeinstallprompt 이벤트 캡처
    const handler = (e) => {
      e.preventDefault();
      setDeferred(e);
      // 30초 dwell 후 노출
      setTimeout(() => setShow(true), 30000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (deferred) {
      deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === 'accepted') {
        dismiss();
      }
      setDeferred(null);
    }
    setShow(false);
  };

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-20 sm:bottom-4 z-40 flex justify-center pointer-events-none px-4"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="pointer-events-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-ink-200 dark:border-slate-700 p-4 max-w-sm w-full animate-slideUp">
        <div className="flex items-start gap-3">
          <div className="text-2xl flex-shrink-0">📱</div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-ink-900 dark:text-slate-100">
              홈 화면에 설치하기
            </div>
            <p className="text-xs text-ink-700 dark:text-slate-300 mt-1 leading-relaxed">
              {isIOS
                ? '하단 공유 버튼 → "홈 화면에 추가"를 누르면 앱처럼 사용할 수 있어요.'
                : '한 번 설치하면 오프라인에서도 빠르게 열려요. 체중 기록·통계가 한 탭에.'}
            </p>
            <div className="flex gap-2 mt-2.5">
              {!isIOS && deferred && (
                <button onClick={install}
                        className="px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-bold hover:bg-brand-600 transition">
                  설치
                </button>
              )}
              <button onClick={dismiss}
                      className="px-3 py-1.5 rounded-lg text-ink-500 dark:text-slate-400 text-xs font-medium hover:bg-ink-100 dark:hover:bg-slate-800 transition">
                나중에
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
