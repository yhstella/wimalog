import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { Storage } from './lib/storage.js'
import { seedIfNeeded } from './lib/seedData.js'
import { initAnalytics } from './lib/analytics.js'
import './index.css'

// 트래픽 측정 — Vercel Web Analytics 주입 (페이지뷰 + 커스텀 funnel 이벤트)
initAnalytics();

// 시드 데이터는 더 이상 mount를 막지 않음 — Simulator/CohortLive 첫 paint는 snapshot.generated.js로 즉시.
// 시드는 백그라운드에서 idle 시점에 생성 (필터 통계용 secondary 데이터).
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// React mount 후 idle 시점에 시드 (블로킹 X)
const ric = window.requestIdleCallback || ((cb) => setTimeout(cb, 500));
ric(() => {
  try {
    const seedUsers = Storage.getUsers().filter(u => u.seed).length;
    if (Storage.isSeeded() && seedUsers < 50) {
      Storage.resetSeed();
    }
    if (!Storage.isSeeded()) {
      // 500 → 150 — 코호트 통계는 Supabase RPC + 빌드타임 snapshot이 담당.
      // localStorage 시드는 Supabase 미설정 시 fallback일 뿐이라 작게 유지해 quota 여유 확보.
      // (시드 과다 → write QuotaExceededError → 사용자 체중 저장 실패 회귀 방지)
      seedIfNeeded(150);
    }
  } catch (e) {
    console.warn('Seed bootstrap warning:', e?.message || e);
  }
});
