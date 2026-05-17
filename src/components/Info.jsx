import React from 'react';
import { RED_FLAG_SYMPTOMS } from '../lib/constants.js';
import { MedicalDisclaimer, RedFlagBanner } from './SafetyBanner.jsx';

export function Info() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-ink-900">안전 정보 · 자주 묻는 질문</h1>
        <p className="text-sm text-ink-500 mt-1">
          GLP-1 계열 약제(위고비·마운자로·삭센다·오젬픽·젭바운드)에 대한 일반 안전 정보입니다.
          개인의 상황에 맞는 판단은 반드시 담당 의료진과 상의해 주세요.
        </p>
      </div>

      <RedFlagBanner />

      <Section title="GLP-1 계열 약은 어떤 약인가요?">
        <p>
          GLP-1(글루카곤 유사 펩타이드-1) 수용체 작용제는 원래 제2형 당뇨 치료제로 개발됐다가,
          식욕 억제 및 위 배출 지연 효과로 비만 치료에도 사용됩니다. 마운자로·젭바운드는 GLP-1과 GIP 이중 작용제입니다.
        </p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li><b>위고비/오젬픽</b> — 성분 세마글루타이드 (주 1회 피하주사)</li>
          <li><b>마운자로/젭바운드</b> — 성분 티르제파타이드 (주 1회 피하주사)</li>
          <li><b>삭센다</b> — 성분 리라글루타이드 (매일 피하주사)</li>
        </ul>
      </Section>

      <Section title="흔한 부작용은 무엇인가요?">
        <p>위장관 증상이 가장 흔하며, 대부분 용량을 점진적으로 늘리는 초기에 집중됩니다.</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>오심(메스꺼움), 구토, 변비, 설사</li>
          <li>복부 불편감, 역류, 피로감</li>
          <li>드물게: 담낭질환, 췌장염, 신장 기능 저하, 심한 저혈당</li>
        </ul>
        <p className="mt-2 text-sm text-ink-500">
          심하거나 오래 지속되는 증상은 의료진과 상의해 용량 조절·일시 중단 등을 검토해야 합니다.
        </p>
      </Section>

      <Section title="이런 증상이 있다면 즉시 의료기관에 문의하세요" tone="danger">
        <ul className="list-disc list-inside space-y-1">
          {RED_FLAG_SYMPTOMS.map(s => <li key={s}>{s}</li>)}
        </ul>
      </Section>

      <Section title="이런 분은 사용 전에 의사와 더 신중히 상의하세요">
        <ul className="list-disc list-inside space-y-1">
          <li>본인 또는 가족에 갑상선 수질암(MTC) 또는 다발성 내분비 종양 2형(MEN2) 병력</li>
          <li>췌장염 과거력</li>
          <li>심한 위마비, 위장관 운동장애</li>
          <li>임신 중이거나 임신 계획 중</li>
          <li>중증 신장·간 질환</li>
          <li>섭식장애 병력</li>
        </ul>
      </Section>

      <Section title="중단하면 다시 살이 찌나요?">
        <p>
          대부분의 임상 연구에서 GLP-1을 중단하면 시간이 지남에 따라 체중이 부분적으로 다시 증가하는 경향이
          보고됩니다. 중단 결정과 이후 유지 전략(식이·운동·필요 시 저용량 유지 등)은 의료진과 상의해야 합니다.
        </p>
      </Section>

      <Section title="이 사이트의 데이터는 어떻게 해석해야 하나요?">
        <ul className="list-disc list-inside space-y-1">
          <li><b>자가보고 기반</b>: 사용자가 직접 입력한 정보로, 임상시험 결과와 다를 수 있습니다.</li>
          <li><b>개인차가 큼</b>: 평균값은 참고용이며, 본인의 반응을 보장하지 않습니다.</li>
          <li><b>약제 비교는 표본 차이</b>: 사용자가 약을 무작위로 배정받은 게 아니므로, 단순 평균 비교에는 한계가 있습니다.</li>
          <li><b>안전 결정은 의료진과</b>: 통계가 좋아 보여도 본인 상황은 다를 수 있습니다.</li>
        </ul>
      </Section>

      <MedicalDisclaimer />
    </div>
  );
}

function Section({ title, children, tone }) {
  const toneClass = tone === 'danger'
    ? 'border-rose-200 bg-rose-50 text-rose-900'
    : 'border-ink-100 bg-white text-ink-700';
  return (
    <section className={`rounded-2xl border p-5 ${toneClass}`}>
      <h2 className={`text-lg font-bold mb-2 ${tone === 'danger' ? 'text-rose-900' : 'text-ink-900'}`}>{title}</h2>
      <div className="text-sm leading-relaxed space-y-2">
        {children}
      </div>
    </section>
  );
}
