import React from 'react';
import { MedicalDisclaimer } from '../SafetyBanner.jsx';

// 의사·의료진을 위한 안내 페이지 — 진료실 환자 안내용 1페이지 요약
// QR 코드는 외부 서비스 의존 없이 SVG로 생성 (간단한 URL 인코딩 텍스트)
// 환자가 위마로그 사용 → 진료 시 PDF/텍스트 요약 가져옴
export function ForDoctorsPage({ navigate }) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="border-b-2 border-ink-200 dark:border-slate-700 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-3xl">🩺</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-900 dark:text-slate-100">
            위마로그 — 의료진 안내
          </h1>
        </div>
        <p className="text-sm text-ink-600 dark:text-slate-400 leading-relaxed">
          GLP-1 비만치료제(위고비·마운자로 등)를 처방하시는 의원·약국용 안내. 환자 자가보고 데이터를 구조화해
          진료 시 빠르게 검토할 수 있는 도구입니다.
        </p>
      </header>

      {/* 한 문장 요약 */}
      <section className="card border-2 border-brand-300 dark:border-brand-800/40 bg-brand-50/40 dark:bg-brand-900/15">
        <p className="text-base text-ink-900 dark:text-slate-100 leading-relaxed">
          <b>한 문장:</b> 환자가 위마로그에 체중·투약·부작용·운동·식단을 기록하고,
          진료 시 <b>12주 진료용 PDF 리포트</b> 또는 <b>텍스트 요약 (카톡 전송용)</b>을 가져옵니다.
        </p>
      </section>

      {/* 환자가 가져오는 데이터 */}
      <section className="card">
        <h2 className="section-title">환자가 가져오는 데이터</h2>
        <p className="section-subtitle">진료 보조 자료로 빠르게 검토 가능. 의학적 진단·처방을 대체하지 않습니다.</p>
        <ul className="mt-3 space-y-2 text-sm text-ink-700 dark:text-slate-300">
          <li className="flex gap-2"><span className="text-brand-500 flex-shrink-0">●</span>
            <span><b>최근 12주 체중 추이</b> — SVG 차트 + 시작·목표·코호트 비교</span></li>
          <li className="flex gap-2"><span className="text-brand-500 flex-shrink-0">●</span>
            <span><b>약 사용 이력</b> — 약제·시작일·N주차·총 투약 횟수·최근 용량</span></li>
          <li className="flex gap-2"><span className="text-brand-500 flex-shrink-0">●</span>
            <span><b>부작용 요약</b> — 본인 발생률 vs 코호트 평균</span></li>
          <li className="flex gap-2"><span className="text-brand-500 flex-shrink-0">●</span>
            <span><b>생활 습관</b> — 12주 누적 운동 시간·주평균</span></li>
          <li className="flex gap-2"><span className="text-brand-500 flex-shrink-0">●</span>
            <span><b>현재 BMI·동반질환·목표 체중</b></span></li>
        </ul>
      </section>

      {/* 데이터 신뢰도 안내 */}
      <section className="card">
        <h2 className="section-title">데이터 신뢰도 — 주의사항</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-ink-700 dark:text-slate-300">
          <li className="flex gap-2">
            <span className="text-amber-500 flex-shrink-0">⚠</span>
            <span>모두 환자 자가보고 데이터입니다. 측정 오차·기록 누락이 있을 수 있습니다.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-500 flex-shrink-0">⚠</span>
            <span>코호트 비교는 한국 사용자 익명 데이터(8,600명+) 기반 평균이며, 임상시험 결과와는 다를 수 있습니다.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-500 flex-shrink-0">⚠</span>
            <span>의학적 판단·처방 결정은 의료진의 임상 판단을 따라야 합니다. 위마로그는 진료 보조 도구입니다.</span>
          </li>
        </ul>
      </section>

      {/* 환자 안내 카피 (의원 비치용) */}
      <section className="card border-2 border-dashed border-ink-300 dark:border-slate-700">
        <h2 className="section-title">진료실 비치 안내 (환자용)</h2>
        <p className="section-subtitle">아래 카피를 진료 안내문·전자처방전·환자 안내 종이에 넣으실 수 있습니다.</p>
        <blockquote className="mt-3 rounded-xl bg-ink-100/50 dark:bg-slate-800/50 p-4 text-sm leading-relaxed">
          <p className="font-bold text-ink-900 dark:text-slate-100 mb-1.5">📱 위마로그 사용 안내</p>
          <p className="text-ink-700 dark:text-slate-300">
            체중·투약·부작용을 <b>wimalog.kr</b>에 기록하시면, 다음 진료 때 <b>12주 진료용 PDF 리포트</b>를
            출력해 가져오실 수 있습니다. 진료 시간이 절약되고 더 정확한 상의가 가능합니다.
            기록은 익명·무료입니다.
          </p>
        </blockquote>
        <div className="mt-3 flex gap-2 flex-wrap">
          <button onClick={() => {
            const text = '📱 위마로그 사용 안내\n\n체중·투약·부작용을 wimalog.kr에 기록하시면, 다음 진료 때 12주 진료용 PDF 리포트를 출력해 가져오실 수 있습니다. 진료 시간이 절약되고 더 정확한 상의가 가능합니다. 기록은 익명·무료입니다.';
            navigator.clipboard?.writeText(text).catch(() => {});
          }}
                  className="btn-secondary text-xs">
            📋 카피 텍스트 복사
          </button>
          <button onClick={() => window.print()} className="btn-secondary text-xs">
            🖨️ 1페이지 인쇄
          </button>
        </div>
      </section>

      {/* 위마로그 측 데이터·연구 협력 */}
      <section className="card">
        <h2 className="section-title">데이터 협력·연구 문의</h2>
        <p className="section-subtitle">
          위마로그는 한국 GLP-1 사용자의 real-world evidence 플랫폼을 지향합니다.
          익명화된 코호트 데이터·연구 협력에 관심 있으시면 GitHub Issues로 문의해 주세요.
        </p>
        <a href="https://github.com/yhstella/wimalog/issues" target="_blank" rel="noopener noreferrer"
           className="mt-3 inline-flex items-center gap-1 text-sm text-brand-700 dark:text-brand-400 hover:underline">
          💬 GitHub Issues로 문의 →
        </a>
      </section>

      <MedicalDisclaimer />

      <button onClick={() => navigate('landing')} className="btn-ghost text-sm">
        ← 메인으로
      </button>

      {/* 인쇄 스타일 */}
      <style>{`
        @media print {
          @page { size: A4; margin: 1.5cm; }
          html, body { background: white !important; }
          .btn-secondary, .btn-ghost { display: none !important; }
        }
      `}</style>
    </div>
  );
}
