import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { Storage } from './lib/storage.js'
import { seedIfNeeded } from './lib/seedData.js'
import './index.css'

// React mount 전 localStorage 시드 보장 — Simulator/CohortLive useMemo 첫 호출부터 데이터 있음
// 작은 사이즈(300명)로 quota 안전. 실제 통계는 Supabase 3000명+ 코호트에서 supabaseStats.js로 가져옴.
try {
  if (!Storage.isSeeded()) seedIfNeeded();
} catch (e) {
  // QuotaExceededError 등은 무시 — 부분 시드라도 진행
  console.warn('Seed bootstrap warning:', e?.message || e);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
