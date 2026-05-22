import React, { useState } from 'react';

// 시뮬레이터 옆 안전성 체크 — GLP-1 금기·신중 사용 사용자 분류
// 사용자가 "내가 써도 되는지" 즉답 + 잘못 사용 방지.
// 의학 가이드라인 기반: FDA boxed warning, KDA 가이드, ADA Standard of Care
const CHECK_ITEMS = [
  {
    id: 'mtcOrMen2',
    label: '갑상선 수질암(MTC) 또는 다발성 내분비선종(MEN2) 본인/가족력',
    severity: 'absolute',  // 절대 금기
  },
  {
    id: 'pancreatitis',
    label: '췌장염 병력 또는 반복 복통 + 등통증',
    severity: 'absolute',
  },
  {
    id: 'pregnancy',
    label: '임신·수유 중 또는 2개월 내 임신 계획',
    severity: 'absolute',
  },
  {
    id: 'gastroparesis',
    label: '위마비증·심한 GERD·반복 구토 등 위장관 운동 장애',
    severity: 'caution',  // 신중
  },
  {
    id: 'gallstone',
    label: '담석증 활동기 또는 최근 1년 내 담석 시술',
    severity: 'caution',
  },
  {
    id: 'highAge',
    label: '65세 이상 또는 18세 미만',
    severity: 'caution',
  },
];

export function SafetyChecklist({ compact = false }) {
  const [checks, setChecks] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const toggle = (id) => {
    setChecks(c => ({ ...c, [id]: !c[id] }));
    setSubmitted(true);
  };

  // 평가
  const absolute = CHECK_ITEMS.filter(i => i.severity === 'absolute' && checks[i.id]);
  const caution = CHECK_ITEMS.filter(i => i.severity === 'caution' && checks[i.id]);
  const anyChecked = absolute.length + caution.length > 0;

  let resultTone, resultIcon, resultTitle, resultMsg;
  if (absolute.length > 0) {
    resultTone = 'rose';
    resultIcon = '⛔';
    resultTitle = '사용 권장 안 됨';
    resultMsg = `${absolute.map(i => i.label.split('(')[0].trim()).join(', ')} — 절대 금기 또는 그에 준하는 항목입니다. 본인 의료진과 반드시 다른 옵션을 상의하세요.`;
  } else if (caution.length > 0) {
    resultTone = 'amber';
    resultIcon = '⚠';
    resultTitle = '신중 검토 필요';
    resultMsg = `${caution.length}개 항목에서 신중 사용 대상에 해당합니다. 사용 가능 여부·시작 용량·모니터링 강도를 의료진과 면밀히 상의하세요.`;
  } else if (submitted) {
    resultTone = 'emerald';
    resultIcon = '✓';
    resultTitle = '일반 사용 후보';
    resultMsg = '체크된 금기·신중 항목 없음. 본인 BMI·동반질환·기존 약을 종합해 의료진과 결정하세요.';
  }

  const toneClass = {
    rose:    'bg-rose-50 dark:bg-rose-900/15 border-rose-300 dark:border-rose-800/40 text-rose-900 dark:text-rose-200',
    amber:   'bg-amber-50 dark:bg-amber-900/15 border-amber-300 dark:border-amber-800/40 text-amber-900 dark:text-amber-200',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/15 border-emerald-300 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200',
  };

  return (
    <section className="rounded-2xl bg-white dark:bg-slate-900 border-2 border-ink-200 dark:border-slate-700 p-5">
      <div className="flex items-start gap-3 mb-3">
        <div className="text-2xl">🛡️</div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-ink-900 dark:text-slate-100">내가 써도 되는지 자가 체크</h3>
          <p className="text-xs text-ink-500 dark:text-slate-400 mt-0.5 leading-relaxed">
            아래 중 본인에 해당하는 항목을 클릭하세요. 의학 가이드라인 기반의 금기·신중 사용 기준입니다.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {CHECK_ITEMS.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => toggle(item.id)}
            className={`w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-xl border transition
                        ${checks[item.id]
                          ? (item.severity === 'absolute'
                              ? 'border-rose-400 bg-rose-50 dark:bg-rose-900/15'
                              : 'border-amber-400 bg-amber-50 dark:bg-amber-900/15')
                          : 'border-ink-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 hover:border-brand-400'}`}>
            <span className={`w-5 h-5 rounded-md flex-shrink-0 mt-0.5 flex items-center justify-center text-[11px] font-bold border-2
                              ${checks[item.id]
                                ? (item.severity === 'absolute' ? 'bg-rose-500 border-rose-500 text-white' : 'bg-amber-500 border-amber-500 text-white')
                                : 'border-ink-300 dark:border-slate-600 text-transparent'}`}>
              ✓
            </span>
            <span className="text-sm text-ink-900 dark:text-slate-100 leading-snug">
              {item.label}
              <span className={`ml-1.5 text-[10px] font-semibold tabular-nums
                                ${item.severity === 'absolute' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {item.severity === 'absolute' ? '금기' : '신중'}
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* 결과 */}
      {submitted && (
        <div className={`mt-4 rounded-xl border-2 p-4 ${toneClass[resultTone]}`}>
          <div className="flex items-start gap-2">
            <div className="text-xl">{resultIcon}</div>
            <div>
              <div className="font-bold">{resultTitle}</div>
              <p className="text-xs mt-1 leading-relaxed">{resultMsg}</p>
            </div>
          </div>
        </div>
      )}

      {!anyChecked && !submitted && (
        <p className="text-[11px] text-ink-500 dark:text-slate-500 mt-3 leading-relaxed">
          ※ 해당 사항이 없다면 그대로 두세요. 자가 체크는 의료진 진단을 대체하지 않으며 일반적인 위험 신호를 알려드릴 뿐입니다.
        </p>
      )}
    </section>
  );
}
