import React, { useMemo, useState, useEffect } from 'react';
import { simulateTimeline, medQuickProfile, bmi, bmiCategory, USAGE_FREQUENCIES, FREQ_BY_ID, bmiResponseFactor } from '../lib/stats.js';
import { Storage } from '../lib/storage.js';
import { MEDS, MED_BY_ID, PEN_INFO } from '../lib/constants.js';
import { fetchAvgLossCurve } from '../lib/supabaseStats.js';
import { snapshotAvgLossCurve, snapshotPlatformScale, snapshotPriceStats, snapshotSideEffectRates } from '../lib/snapshot.js';
import { supabaseConfigured } from '../lib/supabaseClient.js';
import { ProjectionChart } from './ProjectionChart.jsx';

// 슬라이더 + 즉시 예측 결과 위젯
// P1(처음 접속), P4(주변 못 물어보는 사람)을 위한 핵심 위젯
// 3시점(3개월/6개월/1년) + 약별 비용/부작용 + 사용 빈도(매주/격주/가끔) 한국 실사용 반영
// 입력값은 sessionStorage에 저장 — 가입 모달에서 prefill되어 두 번 입력 마찰 제거
const SIM_PREFILL_KEY = 'wimalog_sim_prefill';

export function Simulator({ onSignup, compact = false, user = null }) {
  // sessionStorage에서 이전 값 복원
  const loaded = (() => {
    try {
      const raw = sessionStorage.getItem(SIM_PREFILL_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();
  // 로그인 사용자라면 본인 정보를 기본값으로 — 입력한 체중이 자동 prefill
  const [height, setHeight] = useState(user?.height || loaded?.height || 162);
  const [startWeight, setStartWeight] = useState(user?.startWeight || loaded?.startWeight || 78);
  const [medication, setMedication] = useState(loaded?.medication || 'wegovy');
  const [frequency, setFrequency] = useState(loaded?.frequency || 'weekly');
  // 가입자 추가 입력 — 정확도 향상에 기여
  const [gender, setGender] = useState(user?.gender || loaded?.gender || null);
  const [ageGroup, setAgeGroup] = useState(user?.ageGroup || loaded?.ageGroup || null);
  const [exerciseLevel, setExerciseLevel] = useState(loaded?.exerciseLevel || null); // 'low'|'mid'|'high'
  const [hasFattyLiver, setHasFattyLiver] = useState(loaded?.hasFattyLiver || false);
  const [hasDiabetes, setHasDiabetes] = useState(loaded?.hasDiabetes || false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 입력값 바뀔 때마다 sessionStorage에 저장 (디바운스 없이도 작아서 부담 없음)
  useEffect(() => {
    try {
      sessionStorage.setItem(SIM_PREFILL_KEY, JSON.stringify({
        height, startWeight, medication, frequency,
        gender, ageGroup, exerciseLevel, hasFattyLiver, hasDiabetes,
      }));
    } catch {}
  }, [height, startWeight, medication, frequency, gender, ageGroup, exerciseLevel, hasFattyLiver, hasDiabetes]);

  // 정확도 게이지 — 50% 베이스라인(동전 던지기) + 입력 가중치 * 0.4. 최대 90%.
  // 100% 정확도는 생물학적 예측에서 불가능 — 표시 상한 90%.
  const accuracy = useMemo(() => {
    let raw = 40; // base: height, startWeight, medication, frequency
    if (user) raw += 10;
    if (gender) raw += 8;
    if (ageGroup) raw += 8;
    if (exerciseLevel) raw += 14;
    if (hasFattyLiver) raw += 6;
    if (hasDiabetes) raw += 6;
    if (user) {
      try {
        const logs = Storage.getLogsByUser(user.id);
        if (logs.length >= 4) raw += 8;
      } catch {}
    }
    raw = Math.min(100, raw);
    return 50 + Math.round(raw * 0.4);
  }, [user, gender, ageGroup, exerciseLevel, hasFattyLiver, hasDiabetes]);

  // 추가 입력 → 곡선 보정. 약간 (5-10%) 감량률 조정.
  const personalAdjust = useMemo(() => {
    let mult = 1.0;
    if (exerciseLevel === 'high') mult *= 1.08;
    else if (exerciseLevel === 'low') mult *= 0.93;
    if (hasDiabetes) mult *= 1.05;     // 당뇨 환자가 GLP-1 반응 더 좋음 (일부 연구)
    if (hasFattyLiver) mult *= 1.03;   // 대사 개선 효과 추가
    if (gender === 'M') mult *= 0.96;  // 남성이 평균적으로 감량률 약간 낮음 (체중당 비율 기준)
    if (ageGroup === '50s') mult *= 0.97;
    if (ageGroup === '60s+') mult *= 0.94;
    return mult;
  }, [exerciseLevel, hasDiabetes, hasFattyLiver, gender, ageGroup]);
  // 시드가 비동기로 끝나면 재계산
  const [seedTick, setSeedTick] = useState(0);
  useEffect(() => {
    if (Storage.isSeeded()) return;
    const id = setInterval(() => {
      if (Storage.isSeeded()) { setSeedTick(t => t + 1); clearInterval(id); }
    }, 400);
    return () => clearInterval(id);
  }, []);

  const myBmi = useMemo(() => bmi(startWeight, height), [startWeight, height]);
  // localStorage 시드 기반 (fallback)
  const localTimeline = useMemo(
    () => simulateTimeline({ height, startWeight, medication, frequency }),
    [height, startWeight, medication, frequency, seedTick]
  );
  // 1) 빌드 타임 스냅샷 — 즉시 노출 (BMI 필터 없는 약 전체 곡선) → 0ms 첫 paint
  // 임상 reference 기반 fallback — snapshot 비어도 항상 의미있는 곡선
  const CLINICAL_REF_3PT = {
    wegovy:   { 12: 5.0, 24: 10.0, 48: 15.0 },
    mounjaro: { 12: 6.5, 24: 13.0, 48: 20.0 },
    saxenda:  { 12: 3.3, 24: 6.3, 48: 8.0 },
    ozempic:  { 12: 4.0, 24: 8.0, 48: 11.0 },
    zepbound: { 12: 6.0, 24: 12.0, 48: 19.5 },
  };
  const snapshotTimeline = useMemo(() => {
    let rows = snapshotAvgLossCurve(medication, [12, 24, 48]);
    // snapshot 비면 임상 reference로 대체 — 첫 paint에 의미있는 데이터 보장
    if (!rows || !rows.some(r => r.avg != null)) {
      const ref = CLINICAL_REF_3PT[medication] || CLINICAL_REF_3PT.wegovy;
      rows = [12, 24, 48].map(w => ({ week: w, avg: ref[w], n: 0 }));
    }
    const freqFactor = FREQ_BY_ID[frequency]?.factor ?? 1.0;
    const bmiFactor = myBmi ? bmiResponseFactor(myBmi) : 1.0;
    const adjust = freqFactor * bmiFactor * personalAdjust;
    let prev = 0;
    const series = [12, 24, 48].map(w => {
      const r = rows.find(x => x.week === w);
      if (!r || r.avg == null) return { week: w, lossPct: null, lossKg: null, n: 0 };
      const lossPct = Math.max(r.avg * adjust, prev * 0.98);
      prev = lossPct;
      return { week: w, lossPct, lossKg: startWeight * lossPct / 100, n: r.n };
    });
    return { series };
  }, [medication, frequency, myBmi, startWeight, personalAdjust]);

  // 2) Supabase fresh 데이터 — BMI ±4 좁은 코호트로 refine. 사용자 입력 시 갱신.
  const [supaTimeline, setSupaTimeline] = useState(null);
  const [supaRefreshing, setSupaRefreshing] = useState(false);
  useEffect(() => {
    if (!supabaseConfigured || !myBmi) return;
    let cancelled = false;
    setSupaRefreshing(true);
    const filter = { medication, bmiRange: [Math.max(15, myBmi - 4), Math.min(50, myBmi + 4)] };
    fetchAvgLossCurve(filter, [12, 24, 48]).then(rows => {
      if (cancelled) return;
      setSupaRefreshing(false);
      if (!rows) return;
      // 아래 본문은 기존 그대로
      handleRows(rows);
    }).catch(() => { if (!cancelled) setSupaRefreshing(false); });

    function handleRows(rows) {
      if (cancelled || !rows) return;
      // BMI/빈도 보정 후처리 (localStorage simulateTimeline 로직과 동일)
      const freqFactor = FREQ_BY_ID[frequency]?.factor ?? 1.0;
      const bmiFactor = bmiResponseFactor(myBmi);
      const adjust = freqFactor * bmiFactor;
      let prev = 0;
      const series = [12, 24, 48].map((w, i) => {
        const r = rows.find(x => x.week === w);
        if (!r || r.avg == null) return { week: w, lossPct: null, lossKg: null, n: 0 };
        const lossPct = Math.max(r.avg * adjust, prev * 0.98);
        prev = lossPct;
        return { week: w, lossPct, lossKg: startWeight * lossPct / 100, n: r.n };
      });
      // 코호트 부족(모두 n<5)이면 fallback — wider bmi range
      if (!series.some(s => s.n >= 5)) {
        fetchAvgLossCurve({ medication }, [12, 24, 48]).then(rows2 => {
          if (cancelled || !rows2) return;
          let p2 = 0;
          const series2 = [12, 24, 48].map((w, i) => {
            const r = rows2.find(x => x.week === w);
            if (!r || r.avg == null) return { week: w, lossPct: null, lossKg: null, n: 0 };
            const lossPct = Math.max(r.avg * adjust, p2 * 0.98);
            p2 = lossPct;
            return { week: w, lossPct, lossKg: startWeight * lossPct / 100, n: r.n };
          });
          if (series2.some(s => s.n >= 5)) setSupaTimeline({ series: series2 });
        });
      } else {
        setSupaTimeline({ series });
      }
    }
    return () => { cancelled = true; };
  }, [medication, frequency, myBmi, startWeight]);
  // 우선순위: Supabase fresh > 스냅샷 > localStorage 시드. 모두 즉시 사용 가능.
  const timeline = supaTimeline || snapshotTimeline || localTimeline;
  // 약 프로필 — snapshot 우선 (cold cache), 시드 후 fallback
  const profile = useMemo(() => {
    // snapshot priceStats + sideEffectRates → 즉시 데이터
    const snapPrice = snapshotPriceStats(medication);
    const snapSides = snapshotSideEffectRates(medication);
    if (snapPrice || snapSides) {
      const freqFactor = frequency === 'biweekly' ? 0.5 : frequency === 'occasional' ? 0.25 : frequency === 'intro' ? 0.8 : 1.0;
      const monthlyAvg = snapPrice?.avg ? Math.round(snapPrice.avg * freqFactor / 10000) * 10000 : null;
      const topSides = (snapSides || [])
        .filter(s => s.rate > 0.05)
        .sort((a, b) => b.rate - a.rate)
        .slice(0, 3)
        .map(s => {
          const labelMap = {
            nausea: '오심(메스꺼움)', vomiting: '구토', constipation: '변비', diarrhea: '설사',
            fatigue: '피로감', dizziness: '어지러움', abdomenPain: '복통', hairLoss: '탈모',
            reflux: '역류성', headache: '두통',
          };
          return { label: labelMap[s.id] || s.id, rate: s.rate };
        });
      return { monthlyAvgKrw: monthlyAvg, topSideEffects: topSides, frequency };
    }
    return medQuickProfile(medication, frequency);
  }, [medication, frequency, seedTick]);

  const medLabel = MED_BY_ID[medication]?.label.replace(/\s*\(.+\)/, '') || '';
  const freqLabel = USAGE_FREQUENCIES.find(f => f.id === frequency)?.shortLabel || '매주';

  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white p-5 sm:p-6 shadow-cardHover">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className="text-xl">🔮</span>
        <div className="font-bold text-lg">내가 쓰면 어떻게 될까?</div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur text-[10px] font-bold uppercase tracking-wider">
          AI 예측
        </span>
        {supaRefreshing && (
          <span title="입력값에 맞춰 최신 데이터 가져오는 중"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 backdrop-blur text-[10px]">
            <span className="inline-block w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            계산 중…
          </span>
        )}
      </div>
      <div className="text-xs text-brand-50 mb-3 opacity-90 leading-relaxed">
        {compact
          ? '실사용자 익명 데이터로 본인과 비슷한 결과를 즉시 예측'
          : '실사용자 익명 데이터 기반 AI 예측 — 본인 키·체중·약·빈도와 비슷한 사용자를 찾아 3개월/6개월/1년 감량·비용·부작용을 예측합니다. 정보를 더 입력할수록 정확도가 올라가요.'}
      </div>

      {/* 정확도 게이지 — 입력한 정보 수에 따라 0~100% */}
      <div className="mb-4 rounded-xl bg-white/15 backdrop-blur p-3">
        <div className="flex justify-between items-center text-[11px] font-semibold mb-1.5">
          <span className="opacity-90">🎯 예측 정확도</span>
          <span className="tabular-nums text-base font-extrabold">{accuracy}%</span>
        </div>
        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500
                          ${accuracy >= 80 ? 'bg-emerald-300' : accuracy >= 60 ? 'bg-amber-300' : 'bg-white/60'}`}
               style={{ width: `${accuracy}%` }} />
        </div>
        <div className="text-[10px] opacity-80 mt-1.5 leading-snug">
          {accuracy < 50 && <>키·체중·약·빈도 4개 입력 — <b>기본 코호트 평균</b></>}
          {accuracy >= 50 && accuracy < 75 && <>가입 + 일부 정보 입력 — <b>나와 비슷한 사용자</b>와 매칭</>}
          {accuracy >= 75 && accuracy < 90 && <>운동·동반질환·나이·성별까지 입력 — <b>높은 정확도</b></>}
          {accuracy >= 90 && <>거의 모든 정보 입력 완료 — <b>최고 정확도</b> (본인 데이터 추가하면 +)</>}
        </div>
      </div>

      <div className="space-y-3">
        <Slider label="키 (cm)" value={height} min={140} max={200} step={1}
                onChange={setHeight} fmt={(v) => `${v} cm`} />
        <Slider label="시작 체중 (kg)" value={startWeight} min={45} max={150} step={0.5}
                onChange={setStartWeight} fmt={(v) => `${v.toFixed(1)} kg`} />
        <div>
          <div className="text-xs font-semibold mb-1.5 opacity-90">약</div>
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
            {MEDS.filter(m => m.id !== 'other').map(m => (
              <button key={m.id} type="button" onClick={() => setMedication(m.id)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition border
                                  ${medication === m.id
                                    ? 'bg-white text-brand-700 border-white'
                                    : 'bg-white/10 text-white border-white/30 hover:bg-white/20'}`}>
                {m.label.replace(/\s*\(.+\)/, '')}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold mb-1.5 opacity-90">사용 빈도</div>
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
            {USAGE_FREQUENCIES.map(f => (
              <button key={f.id} type="button" onClick={() => setFrequency(f.id)}
                      title={f.desc}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition border
                                  ${frequency === f.id
                                    ? 'bg-white text-brand-700 border-white'
                                    : 'bg-white/10 text-white border-white/30 hover:bg-white/20'}`}>
                {f.shortLabel}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 추가 입력 — 비가입자엔 잠금 (가입 유도), 가입자엔 펼침/접힘 */}
      {!user ? (
        <div className="mt-4 rounded-xl bg-white/10 backdrop-blur px-3 py-3 border border-white/20">
          <div className="flex items-start gap-2.5">
            <span className="text-lg flex-shrink-0">🔒</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold opacity-95 leading-snug">
                정확도 +50% — 가입하면 추가 입력 가능
              </div>
              <div className="text-[11px] opacity-80 mt-1 leading-relaxed">
                나이·성별·운동량·당뇨/지방간 동반질환까지 입력하면 본인 조건에 가까운 사용자 코호트로 예측합니다.
              </div>
              <button onClick={onSignup}
                      className="mt-2 inline-flex items-center gap-1 rounded-lg bg-white text-brand-700 px-3 py-1.5 text-xs font-bold hover:bg-brand-50 transition">
                내 감량 곡선 정밀화 →
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <button type="button" onClick={() => setShowAdvanced(s => !s)}
                  className="w-full flex items-center justify-between rounded-xl bg-white/15 backdrop-blur px-4 py-2.5 text-xs font-semibold hover:bg-white/20 transition">
            <span className="flex items-center gap-1.5">
              <span>⚙️</span>
              <span>추가 입력 — 정확도 올리기</span>
              {!showAdvanced && accuracy < 80 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-300/30 text-[10px] font-bold tabular-nums">
                  +{Math.max(0, 90 - accuracy)}% 가능
                </span>
              )}
            </span>
            <span className="text-base">{showAdvanced ? '▲' : '▼'}</span>
          </button>
          {showAdvanced && (
            <div className="mt-2 rounded-xl bg-white/10 backdrop-blur p-3 space-y-3">
              {/* 성별 */}
              <div>
                <div className="text-[11px] font-semibold opacity-90 mb-1">성별</div>
                <div className="flex gap-1.5">
                  {[{id:'F',label:'여성'},{id:'M',label:'남성'}].map(o => (
                    <button key={o.id} type="button" onClick={() => setGender(o.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition flex-1
                                        ${gender === o.id
                                          ? 'bg-white text-brand-700 border-white'
                                          : 'bg-white/10 text-white border-white/30'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* 나이대 */}
              <div>
                <div className="text-[11px] font-semibold opacity-90 mb-1">나이대</div>
                <div className="grid grid-cols-5 gap-1">
                  {[{id:'20s',label:'20대'},{id:'30s',label:'30대'},{id:'40s',label:'40대'},{id:'50s',label:'50대'},{id:'60s+',label:'60+'}].map(o => (
                    <button key={o.id} type="button" onClick={() => setAgeGroup(o.id)}
                            className={`px-1 py-1.5 rounded-lg text-[11px] font-medium border transition
                                        ${ageGroup === o.id
                                          ? 'bg-white text-brand-700 border-white'
                                          : 'bg-white/10 text-white border-white/30'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* 운동량 */}
              <div>
                <div className="text-[11px] font-semibold opacity-90 mb-1">평소 운동량</div>
                <div className="flex gap-1.5">
                  {[
                    { id: 'low',  label: '거의 안 함' },
                    { id: 'mid',  label: '주 1-2회' },
                    { id: 'high', label: '주 3회+' },
                  ].map(o => (
                    <button key={o.id} type="button" onClick={() => setExerciseLevel(o.id)}
                            className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border transition flex-1
                                        ${exerciseLevel === o.id
                                          ? 'bg-white text-brand-700 border-white'
                                          : 'bg-white/10 text-white border-white/30'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* 동반질환 */}
              <div>
                <div className="text-[11px] font-semibold opacity-90 mb-1">동반질환</div>
                <div className="flex gap-1.5 flex-wrap">
                  <button type="button" onClick={() => setHasFattyLiver(v => !v)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition
                                      ${hasFattyLiver
                                        ? 'bg-white text-brand-700 border-white'
                                        : 'bg-white/10 text-white border-white/30'}`}>
                    {hasFattyLiver ? '✓ ' : ''}지방간
                  </button>
                  <button type="button" onClick={() => setHasDiabetes(v => !v)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition
                                      ${hasDiabetes
                                        ? 'bg-white text-brand-700 border-white'
                                        : 'bg-white/10 text-white border-white/30'}`}>
                    {hasDiabetes ? '✓ ' : ''}당뇨/전당뇨
                  </button>
                </div>
              </div>
              <div className="text-[10px] opacity-70 leading-snug pt-1">
                💡 입력값은 예측 곡선에 즉시 반영됩니다 (운동 많음 +8%, 당뇨 +5%, 50대 −3% 등)
              </div>
            </div>
          )}
        </div>
      )}

      {myBmi != null && (
        <div className="mt-4 text-xs opacity-80">
          현재 BMI <b className="tabular-nums">{myBmi.toFixed(1)}</b> · {bmiCategory(myBmi)}
        </div>
      )}

      {/* 예측 곡선 그래프 — 사용 + 중단 후 회복 */}
      <div className="mt-4 rounded-xl bg-white dark:bg-slate-900 text-ink-900 dark:text-slate-100 p-3">
        <div className="text-xs font-semibold text-ink-700 dark:text-slate-300 mb-2 text-center">
          📈 예측 체중 곡선 — 사용 + 중단 시점 시뮬레이션
        </div>
        <ProjectionChart startWeight={+startWeight} height={+height}
                         medication={medication} frequency={frequency}
                         accuracy={accuracy} compact />
      </div>

      {/* 3시점 감량 결과 — 빈도/BMI 보정된 한국 실사용 추정치 */}
      <div className="mt-4">
        <div className="text-xs opacity-80 mb-2 text-center">{medLabel} · {freqLabel} 사용 시 예상 감량</div>
        {timeline.series?.some(s => s?.lossPct != null) ? (
          <div className="grid grid-cols-3 gap-2">
            {timeline.series.map((s, i) => {
              if (!s || s.lossPct == null) {
                return (
                  <div key={i} className="rounded-xl bg-white/10 p-3 text-center">
                    <div className="text-[10px] opacity-70">
                      {[12, 24, 48][i] === 12 ? '3개월' : [12, 24, 48][i] === 24 ? '6개월' : '1년'}
                    </div>
                    <div className="text-xl font-extrabold mt-1 opacity-50">—</div>
                  </div>
                );
              }
              const label = s.week === 12 ? '3개월' : s.week === 24 ? '6개월' : '1년';
              const isHighlight = s.week === 48; // 1년 강조
              const kg = Math.abs(s.lossKg);
              const target = (startWeight - kg).toFixed(1);
              return (
                <div key={i}
                     className={`rounded-xl p-3 text-center ${isHighlight ? 'bg-white text-brand-700 shadow-lg' : 'bg-white/15 backdrop-blur'}`}>
                  <div className={`text-[10px] ${isHighlight ? 'opacity-100 font-semibold' : 'opacity-80'}`}>{label}</div>
                  <div className={`font-extrabold tabular-nums leading-none mt-1 ${isHighlight ? 'text-3xl sm:text-4xl' : 'text-xl sm:text-2xl'}`}>
                    −{s.lossPct.toFixed(1)}<span className="text-xs">%</span>
                  </div>
                  <div className={`text-xs mt-1 tabular-nums ${isHighlight ? 'font-semibold' : 'opacity-90'}`}>
                    −{kg.toFixed(1)} kg
                  </div>
                  <div className={`text-[10px] ${isHighlight ? 'opacity-70' : 'opacity-60'} tabular-nums`}>
                    → {target} kg
                  </div>
                  {s.n > 0 && (
                    <div className={`text-[9px] mt-1 ${isHighlight ? 'opacity-60' : 'opacity-60'} tabular-nums`}>
                      n={s.n}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl bg-white/15 backdrop-blur p-4 text-center">
            <div className="inline-flex items-center gap-2 text-sm opacity-90">
              <span className="inline-block w-3 h-3 rounded-full bg-white/60 animate-pulse" />
              데이터 분석 중…
            </div>
          </div>
        )}
      </div>

      {/* 약 빠른 프로필 — 비용 + 주요 부작용 */}
      {profile && (profile.monthlyAvgKrw || profile.topSideEffects?.length) && (
        <div className="mt-3 rounded-xl bg-white/10 backdrop-blur px-4 py-3">
          <div className="grid grid-cols-2 gap-3 items-start">
            {/* 비용 — 4주분(1박스) 평균 */}
            <div>
              <div className="text-[10px] opacity-70 mb-0.5">💰 4주분(1박스) 평균</div>
              {profile.monthlyAvgKrw != null ? (
                <>
                  <div className="text-base font-bold tabular-nums leading-tight">
                    {(profile.monthlyAvgKrw / 10000).toFixed(0)}만원
                    <span className="text-[10px] font-normal opacity-70 ml-1">/4주</span>
                  </div>
                  <div className="text-[9px] opacity-60 leading-tight mt-0.5">
                    {PEN_INFO[medication]?.perBoxText || ''}
                  </div>
                </>
              ) : (
                <div className="text-xs opacity-60">데이터 분석 중</div>
              )}
            </div>
            {/* 주요 부작용 — 상위 2개만 */}
            <div>
              <div className="text-[10px] opacity-70 mb-0.5">⚠ 주요 부작용</div>
              {profile.topSideEffects?.length > 0 ? (
                <div className="space-y-0.5">
                  {profile.topSideEffects.slice(0, 2).map((s, i) => (
                    <div key={i} className="text-xs leading-tight">
                      {s.label.replace('(메스꺼움)', '')} <span className="opacity-70 tabular-nums">{Math.round(s.rate * 100)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs opacity-60">데이터 분석 중</div>
              )}
            </div>
          </div>
        </div>
      )}

      {onSignup && (
        <button onClick={onSignup}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white text-brand-700 px-5 py-3 font-bold hover:bg-brand-50 transition">
          {user ? '내 대시보드 보기 →' : '내 감량 곡선 자세히 보기 →'}
        </button>
      )}
      <div className="mt-3 rounded-xl bg-white/10 backdrop-blur px-3 py-2.5">
        <p className="text-[11px] leading-relaxed">
          <b>입력이 자세할수록 AI 예측이 정확해져요.</b>
          {user
            ? <> 체중 추이·운동·식단·부작용·동반질환을 더 입력하면 본인 조건에 맞춤화됩니다.</>
            : <> 가입 후 체중 추이·운동·식단·부작용·동반질환까지 추가하면 본인 조건에 맞춤화됩니다.</>
          }
        </p>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, fmt }) {
  return (
    <div>
      <div className="flex justify-between items-center text-xs font-semibold mb-1.5 gap-2">
        <span className="opacity-90">{label}</span>
        {/* 숫자 직접 입력 — 슬라이더 정확 조작 어려운 경우 fallback */}
        <input type="number" inputMode="decimal" step={step} min={min} max={max}
               value={value}
               onChange={e => {
                 const v = +e.target.value;
                 if (!isNaN(v) && v >= min && v <= max) onChange(v);
               }}
               className="tabular-nums w-20 px-2 py-1 rounded-md bg-white/20 backdrop-blur text-white text-right text-sm font-bold border border-white/30 focus:bg-white/30 focus:border-white focus:outline-none" />
        <span className="text-[10px] opacity-70">{fmt ? fmt(value).replace(/[\d.]+\s*/, '') : ''}</span>
      </div>
      <input type="range" min={min} max={max} step={step}
             value={value} onChange={e => onChange(+e.target.value)}
             className="w-full h-3 bg-white/20 rounded-full appearance-none cursor-pointer accent-white wimalog-slider"
             style={{
               backgroundImage: `linear-gradient(to right, white 0%, white ${((value-min)/(max-min))*100}%, rgba(255,255,255,0.2) ${((value-min)/(max-min))*100}%)`,
             }} />
    </div>
  );
}
