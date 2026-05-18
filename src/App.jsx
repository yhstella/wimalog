import React, { useEffect, useState, useCallback } from 'react';
import { Storage } from './lib/storage.js';
import { applyTheme, watchSystemTheme } from './lib/theme.js';
import { seoFor, setSEO } from './lib/seo.js';
import { Layout } from './components/Layout.jsx';
import { Landing } from './components/Landing.jsx';
import { Onboarding } from './components/Onboarding.jsx';
import { Dashboard } from './components/Dashboard.jsx';
import { Records } from './components/Records.jsx';
import { MedManager } from './components/MedManager.jsx';
import { Statistics } from './components/Statistics.jsx';
import { Profile } from './components/Profile.jsx';
import { Info } from './components/Info.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { DrugInfoPage } from './components/pages/DrugInfoPage.jsx';
import { SideEffectPage } from './components/pages/SideEffectPage.jsx';
import { GuidePage } from './components/pages/GuidePage.jsx';
import { CalculatorPage } from './components/pages/CalculatorPage.jsx';
import { CompareDrugsPage } from './components/pages/CompareDrugsPage.jsx';
import { DoctorReport } from './components/DoctorReport.jsx';
import { AboutPage, PrivacyPage, TermsPage } from './components/pages/StaticPages.jsx';
import { recordVisit } from './components/RecentPages.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';

// path 우선 + hash 호환 — SEO 봇은 path로 접근, 기존 사용자 hash URL도 동작
function readRoute() {
  // 우선: hash가 있으면 hash (사용자 기존 bookmark 호환)
  const h = (window.location.hash || '').replace(/^#\/?/, '');
  if (h) return h;
  // 그 다음: path (검색봇/sitemap path URL 진입)
  const p = window.location.pathname.replace(/^\//, '').replace(/\/$/, '');
  return p || 'landing';
}
function writeRoute(route) {
  // 내부 navigate: path 사용 (SEO 친화), hash 자동 제거
  const target = '/' + route;
  if (window.location.pathname + window.location.hash !== target) {
    window.history.pushState(null, '', target);
  }
}

export default function App() {
  const [route, setRoute] = useState(readRoute);
  const [userId, setUserId] = useState(() => Storage.getSession());
  const [, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    applyTheme();
    const unwatch = watchSystemTheme();
    Storage.migrateV1ToV2();
    // 시드는 main.jsx에서 React mount 전에 이미 호출됨 (sync) — 여기선 보장만
    return unwatch;
  }, []);

  // 라우트가 바뀔 때 SEO 메타 갱신 + 방문 기록
  useEffect(() => {
    const meta = seoFor(route) || {};
    setSEO({ ...meta, route });
    recordVisit(route);
  }, [route]);

  const navigate = useCallback((r) => {
    setRoute(r);
    writeRoute(r);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onPop = () => setRoute(readRoute());
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onPop);
    };
  }, []);

  useEffect(() => {
    // 첫 진입 시 path가 / 이면 사용자 상태에 맞게 redirect
    if (window.location.pathname === '/' && !window.location.hash) {
      writeRoute(userId ? 'dashboard' : 'landing');
    }
  }, [userId]);

  const user = userId ? Storage.getUser(userId) : null;
  useEffect(() => {
    if (userId && !user) {
      Storage.setSession(null);
      setUserId(null);
    }
  }, [userId, user]);

  const logout = () => {
    Storage.setSession(null);
    setUserId(null);
    navigate('landing');
  };

  const authedRoutes = ['dashboard', 'records', 'meds', 'profile'];
  const isPublicContent = route.startsWith('drug/') || route.startsWith('effect/')
    || route.startsWith('guide/') || route.startsWith('calc/') || route === 'compare';
  const effectiveRoute = (!user && authedRoutes.includes(route)) ? 'landing' : route;

  // route 파싱: 'drug/wegovy' → { kind: 'drug', id: 'wegovy' }
  const parseSub = (route, prefix) => route.startsWith(prefix) ? route.slice(prefix.length) : null;
  const drugId = parseSub(effectiveRoute, 'drug/');
  const effectId = parseSub(effectiveRoute, 'effect/');
  const guideId = parseSub(effectiveRoute, 'guide/');
  const calcKind = parseSub(effectiveRoute, 'calc/');

  const onSignupGo = (id) => { setUserId(id); navigate('dashboard'); };
  const onSignupStay = (id) => { setUserId(id); refresh(); }; // 가입 후 현재 페이지 유지

  return (
    <ToastProvider>
      <Layout route={effectiveRoute} navigate={navigate} user={user} onLogout={logout} onSignup={onSignupGo}>
        {/* ErrorBoundary key=route — 라우트 변경 시 boundary state 리셋 */}
        <ErrorBoundary key={effectiveRoute}>
          {effectiveRoute === 'landing'    && <Landing navigate={navigate} onSignup={onSignupGo} />}
          {effectiveRoute === 'onboarding' && <Onboarding navigate={navigate} onComplete={onSignupGo} />}
          {effectiveRoute === 'dashboard'  && user && <Dashboard user={user} navigate={navigate} />}
          {effectiveRoute === 'records'    && user && <Records user={user} navigate={navigate} />}
          {effectiveRoute === 'meds'       && user && <MedManager user={user} />}
          {effectiveRoute === 'stats'      && (
            <Statistics user={user} navigate={navigate} onSignup={onSignupGo} />
          )}
          {effectiveRoute === 'profile'    && user && (
            <Profile user={user} navigate={navigate} onLogout={logout} refresh={refresh} />
          )}
          {effectiveRoute === 'info'       && <Info />}
          {effectiveRoute === 'doctor-report' && user && (
            <DoctorReport user={user} onBack={() => navigate('profile')} />
          )}
          {effectiveRoute === 'about'   && <AboutPage />}
          {effectiveRoute === 'privacy' && <PrivacyPage />}
          {effectiveRoute === 'terms'   && <TermsPage />}

          {/* SEO 콘텐츠 페이지 */}
          {effectiveRoute === 'compare' && <CompareDrugsPage navigate={navigate} user={user} />}
          {drugId   && <DrugInfoPage medId={drugId} navigate={navigate} user={user} onSignup={onSignupStay} />}
          {effectId && <SideEffectPage effectId={effectId} navigate={navigate} user={user} onSignup={onSignupStay} />}
          {guideId  && <GuidePage guideId={guideId} navigate={navigate} onSignup={onSignupStay} />}
          {calcKind && <CalculatorPage kind={calcKind} navigate={navigate} user={user} />}
        </ErrorBoundary>
      </Layout>
    </ToastProvider>
  );
}
