import React, { useState } from 'react';
import { RED_FLAG_SYMPTOMS } from '../lib/constants.js';

export function MedicalDisclaimer({ className = '' }) {
  return (
    <p className={`text-xs text-ink-500 leading-relaxed ${className}`}>
      본 서비스는 사용자의 자가보고 데이터를 익명으로 수집·시각화하는 기록 도구이며,
      의학적 진단이나 처방을 제공하지 않습니다. 약제의 사용 여부, 용량 조절, 중단 결정은
      반드시 담당 의료진과 상의해 주세요.
    </p>
  );
}

export function RedFlagBanner() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-rose-500 text-white text-sm font-bold">!</span>
          <div>
            <div className="text-sm font-semibold text-rose-900">즉시 의료기관에 문의해야 할 증상</div>
            <div className="text-xs text-rose-700">아래 증상이 있다면 기록보다 진료가 우선입니다</div>
          </div>
        </div>
        <span className="text-rose-700 text-sm">{open ? '접기' : '펼치기'}</span>
      </button>
      {open && (
        <ul className="px-4 pb-4 space-y-1.5 text-sm text-rose-900 list-disc list-inside">
          {RED_FLAG_SYMPTOMS.map(s => <li key={s}>{s}</li>)}
        </ul>
      )}
    </div>
  );
}
