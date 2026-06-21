import React, { useEffect, useState } from 'react';
import { MedicalDisclaimer } from './SafetyBanner.jsx';
import { getTheme, setTheme as setStoredTheme } from '../lib/theme.js';
import { SearchTrigger } from './SearchModal.jsx';
import { QuickSignupModal } from './Paywall.jsx';
import { Storage } from '../lib/storage.js';
import { signOut as supaSignOut } from '../lib/auth.js';

const NAV_AUTHED = [
  { id: 'drug/wegovy',  label: '약 정보',  icon: '💊' },
  { id: 'stats',        label: 'AI 예측',  icon: '🎯' },
  { id: 'info',         label: '안전',     icon: '🛡️' },
];

const NAV_GUEST = [
  { id: 'drug/wegovy',  label: '약 정보',  icon: '💊' },
  { id: 'stats',        label: 'AI 예측',  icon: '🎯' },
  { id: 'info',         label: '안전',     icon: '🛡️' },
];

export function Layout({ route, navigate, user, onLogout, onSignup, children }) {
  const nav = user ? NAV_AUTHED : NAV_GUEST;
  const [theme, setTheme] = useState(getTheme());
  const [showSignup, setShowSignup] = useState(false);

  const cycleTheme = () => {
    const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    setTheme(next);
    setStoredTheme(next);
  };

  // 테스트용 탈퇴 — confirm 한 번 + localStorage 강제 정리 + 페이지 리로드.
  // 모바일/데스크탑 공용 핸들러. 사용자가 OAuth 가입/탈퇴 반복 테스트 중이라 매끄럽게.
  const handleDelete = () => {
    if (!user) return;
    if (!confirm(`${user.nickname || '본인'}님의 모든 데이터를 영구 삭제합니다.\n이 작업은 되돌릴 수 없습니다.\n계속하시겠습니까?`)) return;
    try {
      Storage.deleteUser(user.id);
      Storage.setUsers(Storage.getUsers().filter(u => u.id !== user.id));
      Storage.setSession(null);
    } catch (e) {
      console.error('[delete]', e);
    }
    (async () => {
      try { await supaSignOut(); } catch {}
      window.location.replace('/');
    })();
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* 스킵 링크 (a11y) */}
      <a href="#main"
         className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-brand-500 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold">
        본문으로 건너뛰기
      </a>
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-ink-100 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <button onClick={() => navigate(user ? 'dashboard' : 'landing')}
                  className="flex items-center gap-2 group">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-brand-500 text-white font-bold text-xs">위마</span>
            <div className="text-left leading-tight">
              <div className="text-sm font-bold text-ink-900 dark:text-slate-100 group-hover:text-brand-600 transition">위마로그</div>
              <div className="text-[10px] text-ink-500 dark:text-slate-500 -mt-0.5">위고비·마운자로 리얼데이터</div>
            </div>
          </button>

          {/* 데스크탑 nav */}
          <nav className="hidden sm:flex items-center gap-1">
            {nav.map(item => (
              <button key={item.id}
                      onClick={() => navigate(item.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition
                                  ${route === item.id || (item.id.includes('/') && route.startsWith(item.id.split('/')[0] + '/'))
                                    ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                                    : 'text-ink-700 dark:text-slate-300 hover:bg-ink-100 dark:hover:bg-slate-800'}`}>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <SearchTrigger navigate={navigate} />
            <button onClick={cycleTheme}
                    title={`테마: ${theme}`}
                    className="btn-ghost !p-2 text-base"
                    aria-label="테마 전환">
              {theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '🖥️'}
            </button>
            {user ? (
              <div className="flex items-center gap-1.5">
                {/* 로그인 상태 명확히 표시 — 아바타 + 닉네임 (sm 이상) */}
                <button onClick={() => navigate('profile')}
                        title={user.email || user.nickname}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-ink-100 dark:hover:bg-slate-800 transition">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-500 text-white text-[10px] font-bold">
                      {(user.nickname || user.email || '나').charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="hidden sm:inline text-xs font-medium text-ink-900 dark:text-slate-100 max-w-[100px] truncate">
                    {user.nickname || user.email?.split('@')[0] || '나'}
                  </span>
                </button>
                <button onClick={onLogout} className="btn-ghost text-xs hidden sm:inline-flex">로그아웃</button>
                <button onClick={handleDelete}
                        title="탈퇴 (테스트용)"
                        className="text-[11px] font-semibold px-2 py-1 rounded-md bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 transition hidden sm:inline-flex">
                  탈퇴
                </button>
              </div>
            ) : (
              <button onClick={() => setShowSignup(true)} className="btn-primary !py-2 !px-3 text-sm">
                내 감량 곡선
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 pb-24 sm:pb-6">
        {children}
      </main>

      <footer className="border-t border-ink-100 dark:border-slate-800 bg-white dark:bg-slate-900 mb-16 sm:mb-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-2">
          <MedicalDisclaimer />
          <div className="flex gap-3 text-[10px] text-ink-500 dark:text-slate-500 flex-wrap items-center">
            <button onClick={() => navigate('about')} className="hover:underline">소개</button>
            <span>·</span>
            <button onClick={() => navigate('for-doctors')} className="hover:underline">의료진 안내</button>
            <span>·</span>
            <button onClick={() => navigate('privacy')} className="hover:underline">개인정보</button>
            <span>·</span>
            <button onClick={() => navigate('terms')} className="hover:underline">이용약관</button>
            <span>·</span>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold">
              🆓 Free
            </span>
          </div>
          <p className="text-[11px] text-ink-500 dark:text-slate-400 leading-relaxed">
            © 2026 위마로그 · 대학병원 진료 경력의 의료진과 헬스케어 엔지니어가 설계·운영.
            개인정보는 본인 브라우저, 익명 통계는 안전한 서버에 저장됩니다.
            추후 일부 기능 유료화 검토 중.
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
                              ${route === item.id || (item.id.includes('/') && route.startsWith(item.id.split('/')[0] + '/'))
                                ? 'text-brand-700 dark:text-brand-400'
                                : 'text-ink-500 dark:text-slate-500'}`}>
            <span className="text-lg leading-none" aria-hidden>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
        {user && (
          <>
            <button onClick={onLogout}
                    aria-label="로그아웃"
                    className="flex-1 min-h-[56px] py-2.5 px-1 text-[10px] font-medium text-ink-500 dark:text-slate-500 flex flex-col items-center gap-0.5">
              <span className="text-lg leading-none" aria-hidden>↩</span>
              <span>나가기</span>
            </button>
            {/* 테스트용 탈퇴 — 모바일에서도 즉시 가입/탈퇴 반복 가능하도록 */}
            <button onClick={handleDelete}
                    aria-label="탈퇴 (테스트용)"
                    className="flex-1 min-h-[56px] py-2.5 px-1 text-[10px] font-medium text-rose-600 dark:text-rose-400 flex flex-col items-center gap-0.5">
              <span className="text-lg leading-none" aria-hidden>✕</span>
              <span>탈퇴</span>
            </button>
          </>
        )}
      </nav>

      {/* 모바일 floating CTA — 비가입자만, 첫 viewport 지나친 후에만 노출 (Hero 가림 방지) */}
      {!user && <MobileFloatingCTA onClick={() => setShowSignup(true)} />}

      {showSignup && (
        <QuickSignupModal onClose={() => setShowSignup(false)}
                          onComplete={(id) => { setShowSignup(false); onSignup?.(id); }} />
      )}
    </div>
  );
}

// 모바일 floating CTA — 첫 viewport 지나친 후에만 표시 (P0: hero·하단 컨텐츠 가림 방지)
function MobileFloatingCTA({ onClick }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const check = () => setShow(window.scrollY > 200);
    check();
    window.addEventListener('scroll', check, { passive: true });
    return () => window.removeEventListener('scroll', check);
  }, []);
  if (!show) return null;
  return (
    <button onClick={onClick}
            aria-label="내 감량 곡선 보기"
            className="sm:hidden fixed right-4 z-40 inline-flex items-center gap-1.5 rounded-full bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-bold px-4 py-3 shadow-cardHover transition text-sm animate-fadeIn"
            style={{ bottom: 'calc(64px + env(safe-area-inset-bottom))' }}>
      🔮 <span>내 감량 곡선</span>
    </button>
  );
}
