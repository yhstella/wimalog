import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { Storage } from './lib/storage.js'
import { seedIfNeeded } from './lib/seedData.js'
import './index.css'

// React mount 전 시드 보장 — Simulator/CohortLive useMemo 첫 호출부터 데이터 있음
// 첫 paint 1-2초 지연되지만 빈 데이터 표시 문제 완전 제거
try {
  if (!Storage.isSeeded()) seedIfNeeded(1031);
} catch (e) {
  // QuotaExceededError 등은 무시 — 부분 시드라도 진행
  console.warn('Seed bootstrap warning:', e?.message || e);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
