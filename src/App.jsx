import React, { useEffect, useState, useCallback } from 'react';
import { Storage } from './lib/storage.js';
import { seedIfNeeded } from './lib/seedData.js';
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

function readRouteFromHash() {
  const h = (window.location.hash || '').replace(/^#\/?/, '');
  return h || 'landing';
}
function writeRouteToHash(route) {
  const target = '#/' + route;
  if (window.location.hash !== target) {
    window.history.pushState(null, '', target);
  }
}

export default function App() {
  const [route, setRoute] = useState(readRouteFromHash);
  const [userId, setUserId] = useState(() => Storage.getSession());
  const [, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    applyTheme();
    const unwatch = watchSystemTheme();
    Storage.migrateV1ToV2();
    seedIfNeeded(1000);
    return unwatch;
  }, []);

  // 라우트가 바뀔 때 SEO 메타 갱신
  useEffect(() => {
    const meta = seoFor(route);
    if (meta) setSEO(meta);
  }, [route]);

  const navigate = useCallback((r) => {
    setRoute(r);
    writeRouteToHash(r);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onPop = () => setRoute(readRouteFromHash());
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onPop);
    };
  }, []);

  useEffect(() => {
    if (!window.location.hash) writeRouteToHash(userId ? 'dashboard' : 'landing');
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
    || route.startsWith('guide/') || route.startsWith('calc/');
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
      <Layout route={effectiveRoute} navigate={navigate} user={user} onLogout={logout}>
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

        {/* SEO 콘텐츠 페이지 */}
        {drugId   && <DrugInfoPage medId={drugId} navigate={navigate} user={user} onSignup={onSignupStay} />}
        {effectId && <SideEffectPage effectId={effectId} navigate={navigate} onSignup={onSignupStay} />}
        {guideId  && <GuidePage guideId={guideId} navigate={navigate} onSignup={onSignupStay} />}
        {calcKind && <CalculatorPage kind={calcKind} navigate={navigate} user={user} />}
      </Layout>
    </ToastProvider>
  );
}
