import React, { useEffect, useState } from 'react';
import { MedicalDisclaimer } from './SafetyBanner.jsx';
import { getTheme, setTheme as setStoredTheme } from '../lib/theme.js';

const NAV_AUTHED = [
  { id: 'dashboard',  label: '홈',     icon: '🏠' },
  { id: 'records',    label: '기록',   icon: '📝' },
  { id: 'meds',       label: '약',     icon: '💊' },
  { id: 'stats',      label: '통계',   icon: '📊' },
  { id: 'profile',    label: '프로필', icon: '⚙️' },
];

const NAV_GUEST = [
  { id: 'stats',      label: '통계',   icon: '📊' },
  { id: 'info',       label: '안전',   icon: '🛡️' },
];

export function Layout({ route, navigate, user, onLogout, children }) {
  const nav = user ? NAV_AUTHED : NAV_GUEST;
  const [theme, setTheme] = useState(getTheme());

  const cycleTheme = () => {
    const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    setTheme(next);
    setStoredTheme(next);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-ink-100 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <button onClick={() => navigate(user ? 'dashboard' : 'landing')}
                  className="flex items-center gap-2 group">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-brand-500 text-white font-bold">감</span>
            <div className="text-left leading-tight">
              <div className="text-sm font-bold text-ink-900 dark:text-slate-100 group-hover:text-brand-600 transition">감량로그</div>
              <div className="text-[10px] text-ink-500 dark:text-slate-500 -mt-0.5">위고비·마운자로 리얼데이터</div>
            </div>
          </button>

          {/* 데스크탑 nav */}
          <nav className="hidden sm:flex items-center gap-1">
            {nav.map(item => (
              <button key={item.id}
                      onClick={() => navigate(item.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition
                                  ${route === item.id
                                    ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                                    : 'text-ink-700 dark:text-slate-300 hover:bg-ink-100 dark:hover:bg-slate-800'}`}>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <button onClick={cycleTheme}
                    title={`테마: ${theme}`}
                    className="btn-ghost !p-2 text-base"
                    aria-label="테마 전환">
              {theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '🖥️'}
            </button>
            {user ? (
              <button onClick={onLogout} className="btn-ghost text-xs hidden sm:inline-flex">로그아웃</button>
            ) : (
              <button onClick={() => navigate('onboarding')} className="btn-primary !py-2 !px-3 text-sm">
                시작하기
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 pb-24 sm:pb-6">
        {children}
      </main>

      <footer className="border-t border-ink-100 dark:border-slate-800 bg-white dark:bg-slate-900 mb-16 sm:mb-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-2">
          <MedicalDisclaimer />
          <p className="text-[10px] text-ink-300 dark:text-slate-600">
            © 2026 감량로그 · 모든 데이터는 사용자의 브라우저에 익명으로 저장됩니다 (MVP).
          </p>
        </div>
      </footer>

      {/* 모바일 하단 nav (fixed) */}
      <nav aria-label="모바일 메뉴"
           className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-ink-100 dark:border-slate-800 flex"
           style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {nav.map(item => (
          <button key={item.id} onClick={() => navigate(item.id)}
                  aria-label={item.label}
                  aria-current={route === item.id ? 'page' : undefined}
                  className={`flex-1 min-h-[56px] py-2.5 px-1 text-[10px] font-medium transition flex flex-col items-center gap-0.5
                              ${route === item.id
                                ? 'text-brand-700 dark:text-brand-400'
                                : 'text-ink-500 dark:text-slate-500'}`}>
            <span className="text-lg leading-none" aria-hidden>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
        {user && (
          <button onClick={onLogout}
                  aria-label="로그아웃"
                  className="flex-1 min-h-[56px] py-2.5 px-1 text-[10px] font-medium text-ink-500 dark:text-slate-500 flex flex-col items-center gap-0.5">
            <span className="text-lg leading-none" aria-hidden>↩</span>
            <span>나가기</span>
          </button>
        )}
      </nav>
    </div>
  );
}
