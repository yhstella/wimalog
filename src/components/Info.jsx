import React, { useState } from 'react';
import { RED_FLAG_SYMPTOMS } from '../lib/constants.js';
import { MedicalDisclaimer, RedFlagBanner } from './SafetyBanner.jsx';
import { ShareButtons } from './Share.jsx';

const FAQ_SECTIONS = [
  {
    title: '🤔 처음 알게 된 분',
    items: [
      {
        q: '위고비/마운자로가 안전한 약인가요?',
        a: 'FDA·식약처 승인된 약입니다. GLP-1 호르몬 작용을 모방하는 비교적 새로운 약으로, 임상시험에서 효과와 안전성이 검증됐습니다. 다만 본인의 동반질환·복용약을 고려해 의사 상담이 필수입니다.',
      },
      {
        q: '평생 맞아야 하나요?',
        a: '중단 후 평균 6개월에 감량분의 30-50%가 회복됩니다. 그래서 일부 환자는 저용량 유지, 일부는 식이·운동으로 유지 시도. 평생은 아니지만 장기 사용이 흔합니다.',
      },
      {
        q: '운동 안 해도 살이 빠지나요?',
        a: '식욕 억제만으로도 빠지지만, 운동 병행 시 결과가 더 좋고 근손실 방지에도 좋습니다. 위마로그 데이터로는 운동 지속 그룹 회복률이 절반.',
      },
    ],
  },
  {
    title: '📋 시작 예정자',
    items: [
      {
        q: 'BMI 27인데 처방받을 수 있나요?',
        a: '한국 기준: BMI ≥ 30 또는 BMI ≥ 27이면서 동반질환(당뇨·고혈압·지방간·이상지질혈증 등). BMI 27이라도 동반질환 있으면 처방 가능.',
      },
      {
        q: '어디서 처방받나요?',
        a: '비만 클리닉, 가정의학과, 내과, 일부 내분비내과. 비대면 진료 + 약 배송도 가능. /guide/prescription 참고.',
      },
      {
        q: '얼마나 비싼가요?',
        a: '위고비 25만원~47만원/월, 마운자로 29만원~82만원/월. 6개월 사용 시 약 200~500만원. /calc/cost 계산기 사용.',
      },
    ],
  },
  {
    title: '💉 현재 사용 중',
    items: [
      {
        q: '오심이 너무 심해요',
        a: '시작 초기 4주에 가장 흔합니다. 식사를 천천히, 소량씩 자주, 기름진 음식 피하기. 2주 이상 지속되거나 식사 못 할 정도면 의사 상담. /effect/nausea 참고.',
      },
      {
        q: '용량 언제 올려야 하나요?',
        a: '보통 4주마다 한 단계씩. 부작용이 심하면 같은 용량 유지 또는 천천히 증량. 의사와 상의.',
      },
      {
        q: '정체기에 빠진 것 같아요',
        a: '체중 변화가 4주 이상 ±0.5kg 미만이면 정체기. 운동 시간 +50%, 단백질 증량, 식이 점검, 의사와 용량 조정 상의.',
      },
      {
        q: '주사 잊었어요',
        a: '주 1회 약(위고비/마운자로): 48시간 내면 즉시 맞고 다음 주기 유지. 48시간 초과면 그 주는 스킵, 다음 주 정상. 매일 약(삭센다): 다음 식사 전 맞고 평소 시간 유지.',
      },
    ],
  },
  {
    title: '📉 중단했거나 중단 예정',
    items: [
      {
        q: '중단하면 얼마나 다시 찌나요?',
        a: '평균 6개월에 감량분의 30-50% 회복. 운동 지속 그룹은 20% 정도로 절반 수준. /guide/after-stop 참고.',
      },
      {
        q: '갑자기 끊어도 되나요?',
        a: '안전상 문제는 없으나, 용량을 단계적으로 낮춰 식욕 변화를 부드럽게 하는 것이 권장됩니다. 의사 상의 권장.',
      },
      {
        q: '저용량 유지 가능한가요?',
        a: '일부 사용자는 위고비 1.0mg을 격주로 맞으며 유지. 정식 적응증은 아니지만 실제 임상에서 사용되는 전략. 의사와 상의.',
      },
    ],
  },
  {
    title: '🥗 다이어트만 (약 안 씀)',
    items: [
      {
        q: '약 없이 얼마나 빠지나요?',
        a: '균형 잡힌 식이 + 운동으로 연 5-7% 감량이 일반적. 약의 1/3-1/2 수준이지만 안전하고 지속 가능. /calc/bmr로 칼로리 계산.',
      },
      {
        q: '단백질을 얼마나 먹어야 하나요?',
        a: '감량기 권장 1.2-1.6g/체중kg. 닭가슴살·생선·계란·두부·콩 위주. 단백질 충분 시 포만감 + 근손실 방지.',
      },
      {
        q: '운동은 얼마나?',
        a: '주 150분 유산소 + 주 2회 근력 운동 권장. 일상 활동(걷기·계단)도 누적 효과.',
      },
    ],
  },
  {
    title: '🔒 개인정보·데이터',
    items: [
      {
        q: '제 데이터가 다른 사람에게 보이나요?',
        a: '익명 통계로만 집계되며, 닉네임·메모·구매 정보는 본인만 봅니다. 본인 데이터는 본인 브라우저에 저장되고, 익명 통계 집계용으로만 안전한 서버에 전송됩니다.',
      },
      {
        q: '계정 삭제 가능한가요?',
        a: '프로필 페이지 → 계정/내 데이터 삭제. 즉시 모든 데이터 영구 삭제.',
      },
      {
        q: '데이터 내보낼 수 있나요?',
        a: '프로필에서 CSV/JSON 내보내기 가능 (체중·투약·전체).',
      },
    ],
  },
];

export function Info() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-ink-900 dark:text-slate-100">안전 정보 + FAQ</h1>
        <p className="text-sm text-ink-500 dark:text-slate-400 mt-1">
          GLP-1 비만 치료제(위고비·마운자로·삭센다)에 대한 일반 안전 정보와 자주 묻는 질문입니다.
        </p>
      </div>

      <RedFlagBanner />

      {/* 세그먼트별 FAQ */}
      {FAQ_SECTIONS.map((section, i) => (
        <FaqSection key={i} title={section.title} items={section.items} />
      ))}

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

      <Section title="이 사이트의 데이터는 어떻게 해석해야 하나요?">
        <ul className="list-disc list-inside space-y-1">
          <li><b>자가보고 기반</b>: 사용자가 직접 입력한 정보로, 임상시험 결과와 다를 수 있습니다.</li>
          <li><b>개인차가 큼</b>: 평균값은 참고용이며, 본인의 반응을 보장하지 않습니다.</li>
          <li><b>약제 비교는 표본 차이</b>: 사용자가 약을 무작위로 배정받은 게 아니므로, 단순 평균 비교에는 한계가 있습니다.</li>
          <li><b>안전 결정은 의료진과</b>: 통계가 좋아 보여도 본인 상황은 다를 수 있습니다.</li>
        </ul>
      </Section>

      <ShareButtons title="위마로그 안전 정보 + FAQ"
                    text="위고비·마운자로·삭센다 사용 전후 자주 묻는 질문" />

      <MedicalDisclaimer />
    </div>
  );
}

function FaqSection({ title, items }) {
  return (
    <section className="card">
      <h2 className="section-title">{title}</h2>
      <div className="mt-3 divide-y divide-ink-100 dark:divide-slate-800">
        {items.map((item, i) => <FaqItem key={i} q={item.q} a={item.a} />)}
      </div>
    </section>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(o => !o)}
              className="w-full flex justify-between items-start gap-3 text-left py-3 hover:bg-ink-100/40 dark:hover:bg-slate-800/40 -mx-2 px-2 rounded-lg transition">
        <span className="font-semibold text-ink-900 dark:text-slate-100 text-sm">{q}</span>
        <span className="text-ink-500 dark:text-slate-400 text-lg flex-shrink-0">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="text-sm text-ink-700 dark:text-slate-300 leading-relaxed pb-3 -mt-1">{a}</div>}
    </div>
  );
}

function Section({ title, children, tone }) {
  const toneClass = tone === 'danger'
    ? 'border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-900/15 text-rose-900 dark:text-rose-200'
    : 'border-ink-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-ink-700 dark:text-slate-300';
  return (
    <section className={`rounded-2xl border p-5 ${toneClass}`}>
      <h2 className={`text-lg font-bold mb-2 ${tone === 'danger' ? 'text-rose-900 dark:text-rose-200' : 'text-ink-900 dark:text-slate-100'}`}>{title}</h2>
      <div className="text-sm leading-relaxed space-y-2">
        {children}
      </div>
    </section>
  );
}
