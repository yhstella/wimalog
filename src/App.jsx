import React, { useEffect, useState, useCallback } from 'react';
import { Storage } from './lib/storage.js';
import { seedIfNeeded } from './lib/seedData.js';
import { applyTheme, watchSystemTheme } from './lib/theme.js';
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

  // 시드 + 마이그레이션 + 다크모드 적용
  useEffect(() => {
    applyTheme();
    const unwatch = watchSystemTheme();
    Storage.migrateV1ToV2();
    seedIfNeeded(1000);
    return unwatch;
  }, []);

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
  const effectiveRoute = !user && authedRoutes.includes(route) ? 'landing' : route;

  return (
    <ToastProvider>
      <Layout route={effectiveRoute} navigate={navigate} user={user} onLogout={logout}>
        {effectiveRoute === 'landing'    && (
          <Landing navigate={navigate}
                   onSignup={(id) => { setUserId(id); navigate('dashboard'); }} />
        )}
        {effectiveRoute === 'onboarding' && (
          <Onboarding navigate={navigate}
                      onComplete={(id) => { setUserId(id); navigate('dashboard'); }} />
        )}
        {effectiveRoute === 'dashboard'  && user && <Dashboard user={user} navigate={navigate} />}
        {effectiveRoute === 'records'    && user && <Records user={user} navigate={navigate} />}
        {effectiveRoute === 'meds'       && user && <MedManager user={user} />}
        {effectiveRoute === 'stats'      && (
          <Statistics user={user} navigate={navigate}
                      onSignup={(id) => { setUserId(id); navigate('dashboard'); }} />
        )}
        {effectiveRoute === 'profile'    && user && (
          <Profile user={user} navigate={navigate} onLogout={logout} refresh={refresh} />
        )}
        {effectiveRoute === 'info'       && <Info />}
      </Layout>
    </ToastProvider>
  );
}
