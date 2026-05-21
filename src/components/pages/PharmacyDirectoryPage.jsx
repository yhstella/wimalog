import React, { useEffect, useMemo, useState } from 'react';
import { MEDS, MED_BY_ID, PEN_INFO, REFERENCE_PRICE_4W } from '../../lib/constants.js';
import { pharmaciesByRegion, regionDetail, pharmacyDirectorySummary } from '../../lib/pharmacyStats.js';
import { seedPharmacyReports } from '../../lib/pharmacySeed.js';
import { Storage, uid } from '../../lib/storage.js';
import { useToast } from '../Toast.jsx';
import { MedicalDisclaimer } from '../SafetyBanner.jsx';

// 한국 GLP-1 약국 가격 디렉토리
// - 지역 클러스터 (서울 대학로·강남·종로 등)
// - 약국별 약·용량 가격
// - 익명 가격 제보 폼
// 처방은 의료법 때문에 안내 불가 → 가격(약국) 정보만 공개
const todayISO = () => new Date().toISOString().slice(0, 10);

export function PharmacyDirectoryPage({ navigate, user, regionId }) {
  const [filter, setFilter] = useState({ medication: null });
  const [showReportModal, setShowReportModal] = useState(false);
  const [version, setVersion] = useState(0);

  // 첫 진입 시 시드 보장
  useEffect(() => {
    try { seedPharmacyReports(); } catch (e) { console.warn('[pharmacy seed]', e); }
    setVersion(v => v + 1);
  }, []);

  const summary = useMemo(() => pharmacyDirectorySummary(), [version]);
  const regions = useMemo(() => pharmaciesByRegion(filter), [filter, version]);
  const detail  = useMemo(() => regionId ? regionDetail(regionId, filter) : null, [regionId, filter, version]);

  // 단일 지역 보기 모드
  if (regionId) {
    return (
      <div className="space-y-6">
        <PharmacyHeader navigate={navigate} summary={summary} onReport={() => setShowReportModal(true)} />
        <button onClick={() => navigate('pharmacies')}
                className="text-sm text-brand-700 dark:text-brand-400 hover:underline">
          ← 전체 지역 보기
        </button>
        {detail ? (
          <RegionDetailView detail={detail} filter={filter} onFilterChange={setFilter} navigate={navigate} />
        ) : (
          <div className="card text-center py-10 text-ink-500">존재하지 않는 지역입니다</div>
        )}
        <MedicalDisclaimer />
        {showReportModal && (
          <PharmacyReportModal
            onClose={() => setShowReportModal(false)}
            onComplete={() => { setShowReportModal(false); setVersion(v => v + 1); }}
            defaultRegion={detail?.region}
            user={user}
          />
        )}
      </div>
    );
  }

  // 전체 디렉토리 모드
  return (
    <div className="space-y-6">
      <PharmacyHeader navigate={navigate} summary={summary} onReport={() => setShowReportModal(true)} />

      {/* 약 필터 */}
      <section className="card">
        <div className="text-xs font-semibold text-ink-700 dark:text-slate-300 mb-2">약 종류 필터</div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setFilter({ medication: null })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition
                              ${!filter.medication
                                ? 'bg-brand-500 text-white border-brand-500'
                                : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700 hover:border-brand-400'}`}>
            전체
          </button>
          {MEDS.filter(m => m.id !== 'other').map(m => (
            <button key={m.id} onClick={() => setFilter({ medication: m.id })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition
                                ${filter.medication === m.id
                                  ? 'bg-brand-500 text-white border-brand-500'
                                  : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700 hover:border-brand-400'}`}>
              {m.label.replace(/\s*\(.+\)/, '')}
            </button>
          ))}
        </div>
      </section>

      {/* 지역 리스트 */}
      <section className="space-y-3">
        {regions.map(r => (
          <RegionCard key={r.regionId} region={r} navigate={navigate} medFilter={filter.medication} />
        ))}
      </section>

      {/* 안내 */}
      <section className="rounded-2xl bg-amber-50/60 dark:bg-amber-900/15 border border-amber-200/60 dark:border-amber-800/30 p-4 text-xs leading-relaxed text-amber-900 dark:text-amber-100">
        <b>⚠ 처방은 의원에서, 약 구매는 약국에서.</b><br />
        한국 의료법상 위마로그는 의원·의사 추천은 할 수 없습니다. 다만 약국 가격은 공개 정보이므로 사용자 제보로 디렉토리를 만듭니다.
        가격은 약국별 ±30%까지 차이날 수 있으므로 방문 전 전화 확인을 권합니다.
      </section>

      <MedicalDisclaimer />

      {showReportModal && (
        <PharmacyReportModal
          onClose={() => setShowReportModal(false)}
          onComplete={() => { setShowReportModal(false); setVersion(v => v + 1); }}
          user={user}
        />
      )}
    </div>
  );
}

function PharmacyHeader({ navigate, summary, onReport }) {
  return (
    <section className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white p-5 sm:p-7">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs font-bold opacity-80 uppercase tracking-wider mb-1">🏪 한국 GLP-1 약국 가격</div>
          <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight">
            약국별 최근 가격 디렉토리
          </h1>
          <p className="text-sm mt-2 opacity-90 leading-relaxed max-w-lg">
            한국은 GLP-1 비만치료제 가격이 약국별·지역별로 30% 이상 차이납니다.
            사용자가 직접 제보한 약국 가격을 익명으로 공개합니다.
          </p>
        </div>
        <button onClick={onReport}
                className="rounded-xl bg-white text-brand-700 font-bold px-4 py-2.5 text-sm hover:bg-brand-50 transition shadow-md flex-shrink-0">
          ✍ 가격 제보하기
        </button>
      </div>
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <SummaryStat big={summary.totalReports.toLocaleString()} label="총 제보" />
        <SummaryStat big={summary.totalPharmacies.toLocaleString()} label="약국 수" />
        <SummaryStat big={summary.totalRegions.toLocaleString()} label="지역" />
        <SummaryStat big={summary.recent30.toLocaleString()} label="최근 30일 제보" />
      </div>
    </section>
  );
}

function SummaryStat({ big, label }) {
  return (
    <div className="rounded-xl bg-white/10 backdrop-blur p-2.5">
      <div className="text-xl sm:text-2xl font-extrabold tabular-nums">{big}</div>
      <div className="text-[10px] opacity-80 mt-0.5">{label}</div>
    </div>
  );
}

function RegionCard({ region, navigate, medFilter }) {
  const topPharm = region.pharmacies[0];
  const hasReports = region.reportCount > 0;
  return (
    <div className="card hover:shadow-cardHover transition">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <button onClick={() => navigate(`pharmacy/${region.regionId}`)}
                  className="font-bold text-lg text-ink-900 dark:text-slate-100 hover:text-brand-600 transition text-left">
            {region.region} →
          </button>
          <div className="text-xs text-ink-500 dark:text-slate-500 mt-0.5">
            {region.pharmacies.length}개 약국
            {hasReports && <> · {region.reportCount}건 제보</>}
            {medFilter && <> · {MED_BY_ID[medFilter]?.label.replace(/\s*\(.+\)/, '')} 필터</>}
          </div>
        </div>
        {topPharm?.avgPrice && (
          <div className="text-right">
            <div className="text-[10px] text-ink-500 dark:text-slate-500">최다 제보 약국 평균</div>
            <div className="text-base font-bold text-brand-700 dark:text-brand-400 tabular-nums">
              {Math.round(topPharm.avgPrice / 10000)}만원
            </div>
          </div>
        )}
      </div>
      {region.pharmacies.length > 0 && (
        <div className="mt-3 pt-3 border-t border-ink-100 dark:border-slate-800 space-y-1.5">
          {region.pharmacies.slice(0, 3).map(p => (
            <div key={p.name} className="flex justify-between items-center text-sm gap-3">
              <div className="flex-1 min-w-0">
                <span className="text-ink-900 dark:text-slate-100 font-medium">{p.name}</span>
                <span className="text-[10px] text-ink-500 dark:text-slate-500 ml-2 tabular-nums">
                  {p.medsHandled.length}개 약 취급
                </span>
              </div>
              {p.avgPrice ? (
                <span className="tabular-nums text-ink-700 dark:text-slate-300">
                  평균 {Math.round(p.avgPrice / 10000)}만원
                  <span className="text-[10px] text-ink-500 ml-1">/ 4주분</span>
                </span>
              ) : (
                <span className="text-[10px] text-ink-300 dark:text-slate-600">제보 없음</span>
              )}
            </div>
          ))}
          {region.pharmacies.length > 3 && (
            <button onClick={() => navigate(`pharmacy/${region.regionId}`)}
                    className="w-full text-center text-xs text-brand-700 dark:text-brand-400 hover:underline pt-1.5">
              + {region.pharmacies.length - 3}개 약국 더 보기 →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RegionDetailView({ detail, filter, onFilterChange, navigate }) {
  return (
    <div className="space-y-5">
      <section className="card">
        <h2 className="text-2xl font-extrabold text-ink-900 dark:text-slate-100">{detail.region} 약국 가격</h2>
        <div className="text-xs text-ink-500 dark:text-slate-500 mt-1">
          {detail.pharmacies.length}개 약국 · 총 {detail.totalReports}건 제보
        </div>
      </section>

      <section className="card">
        <div className="text-xs font-semibold text-ink-700 dark:text-slate-300 mb-2">약 종류 필터</div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => onFilterChange({ medication: null })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition
                              ${!filter.medication
                                ? 'bg-brand-500 text-white border-brand-500'
                                : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700 hover:border-brand-400'}`}>
            전체
          </button>
          {MEDS.filter(m => m.id !== 'other').map(m => (
            <button key={m.id} onClick={() => onFilterChange({ medication: m.id })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition
                                ${filter.medication === m.id
                                  ? 'bg-brand-500 text-white border-brand-500'
                                  : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700 hover:border-brand-400'}`}>
              {m.label.replace(/\s*\(.+\)/, '')}
            </button>
          ))}
        </div>
      </section>

      {detail.pharmacies.length === 0 ? (
        <div className="card text-center py-10">
          <div className="text-3xl mb-2">📭</div>
          <div className="font-bold text-ink-900 dark:text-slate-100">아직 제보가 없습니다</div>
          <div className="text-xs text-ink-500 mt-1">
            이 지역의 첫 가격 제보자가 되어주세요
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {detail.pharmacies.map(p => (
            <PharmacyCard key={p.name} pharmacy={p} navigate={navigate} />
          ))}
        </div>
      )}
    </div>
  );
}

function PharmacyCard({ pharmacy, navigate }) {
  return (
    <div className="card">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div>
          <div className="font-bold text-ink-900 dark:text-slate-100">{pharmacy.name}</div>
          <div className="text-[10px] text-ink-500 dark:text-slate-500 mt-0.5">
            {pharmacy.reportCount}건 제보 · 최근 {pharmacy.lastReportAt}
          </div>
        </div>
      </div>
      {pharmacy.offerings.length > 0 ? (
        <div className="mt-3 pt-3 border-t border-ink-100 dark:border-slate-800">
          <div className="text-xs font-semibold text-ink-700 dark:text-slate-300 mb-2">취급 약·용량별 가격 (4주분)</div>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase text-ink-500 dark:text-slate-500">
                  <th className="py-1.5 px-2 font-medium">약</th>
                  <th className="py-1.5 px-2 font-medium">용량</th>
                  <th className="py-1.5 px-2 font-medium text-right">평균</th>
                  <th className="py-1.5 px-2 font-medium text-right">최저</th>
                  <th className="py-1.5 px-2 font-medium text-right">n</th>
                </tr>
              </thead>
              <tbody>
                {pharmacy.offerings.map((o, i) => (
                  <tr key={i} className="border-t border-ink-100 dark:border-slate-800">
                    <td className="py-1.5 px-2">
                      <button onClick={() => navigate(`drug/${o.medication}`)}
                              className="text-brand-700 dark:text-brand-400 hover:underline">
                        {MED_BY_ID[o.medication]?.label.replace(/\s*\(.+\)/, '') || o.medication}
                      </button>
                    </td>
                    <td className="py-1.5 px-2 tabular-nums">{o.dose}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums font-semibold">
                      {Math.round(o.avg / 10000)}만원
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                      {Math.round(o.min / 10000)}만원
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-ink-500">{o.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-ink-100 dark:border-slate-800 text-xs text-ink-500">
          이 약국 가격 제보 없음
        </div>
      )}
    </div>
  );
}

// 익명 가격 제보 모달
export function PharmacyReportModal({ onClose, onComplete, defaultRegion = null, user = null }) {
  const toast = useToast();
  const [form, setForm] = useState({
    region: defaultRegion || '서울 대학로',
    pharmacyName: '',
    medication: 'wegovy',
    dose: '0.25mg',
    pricePer4W: '',
    purchaseDate: todayISO(),
    notes: '',
  });
  const dosesAvail = REFERENCE_PRICE_4W[form.medication] ? Object.keys(REFERENCE_PRICE_4W[form.medication]) : [];

  // 약 변경 시 첫 용량으로
  const setMed = (m) => setForm(f => ({ ...f, medication: m, dose: Object.keys(REFERENCE_PRICE_4W[m] || {})[0] || '' }));
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const canSubmit = form.region && form.pharmacyName.trim() && form.medication && form.dose && +form.pricePer4W >= 10000 && +form.pricePer4W <= 5000000;

  const submit = () => {
    if (!canSubmit) return;
    Storage.addPharmacyReport({
      id: uid('phr'),
      region: form.region,
      pharmacyName: form.pharmacyName.trim(),
      medication: form.medication,
      dose: form.dose,
      pricePer4W: +form.pricePer4W,
      purchaseDate: form.purchaseDate,
      submittedAt: todayISO(),
      submittedBy: user?.id || null,
      notes: form.notes.trim() || '',
      seed: false,
    });
    toast?.show?.({ kind: 'success', msg: '제보 감사합니다! 디렉토리에 반영됐어요.' });
    onComplete?.();
  };

  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-ink-100 dark:border-slate-800 px-5 py-3 flex justify-between items-center">
          <div>
            <div className="font-bold text-ink-900 dark:text-slate-100">약국 가격 제보</div>
            <div className="text-xs text-ink-500 dark:text-slate-500">익명 제보 · 1분</div>
          </div>
          <button onClick={onClose} className="btn-ghost !p-2">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <div className="label">지역</div>
            <select className="input" value={form.region} onChange={e => set('region', e.target.value)}>
              {['서울 대학로', '서울 강남', '서울 종로', '서울 신촌', '서울 송파', '경기 분당', '경기 일산', '경기 수원',
                '부산', '대구', '인천', '대전', '광주', '울산', '기타'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <div className="label">약국명 <span className="text-[10px] text-ink-500 font-normal">(예: 대학로A약국)</span></div>
            <input type="text" className="input" value={form.pharmacyName}
                   onChange={e => set('pharmacyName', e.target.value)}
                   placeholder="약국 상호 또는 약사·위치 식별 키워드" maxLength={30} />
          </div>
          <div>
            <div className="label">약</div>
            <div className="flex flex-wrap gap-1.5">
              {MEDS.filter(m => m.id !== 'other').map(m => (
                <button key={m.id} type="button" onClick={() => setMed(m.id)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition
                                    ${form.medication === m.id
                                      ? 'bg-brand-500 text-white border-brand-500'
                                      : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700'}`}>
                  {m.label.replace(/\s*\(.+\)/, '')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="label">용량</div>
            <select className="input" value={form.dose} onChange={e => set('dose', e.target.value)}>
              {dosesAvail.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            {PEN_INFO[form.medication]?.note && (
              <div className="text-[10px] text-ink-500 dark:text-slate-500 mt-1">
                {PEN_INFO[form.medication].perBoxText}
              </div>
            )}
          </div>
          <div>
            <div className="label">가격 (4주분 / 1박스, 원)</div>
            <input type="number" inputMode="numeric" className="input"
                   value={form.pricePer4W} onChange={e => set('pricePer4W', e.target.value)}
                   placeholder={`예: ${REFERENCE_PRICE_4W[form.medication]?.[form.dose]?.toLocaleString() || '280000'}`}
                   min={10000} max={5000000} step={1000} />
            <div className="text-[10px] text-ink-500 dark:text-slate-500 mt-1">
              💉 펜·박스 1개 가격을 입력해주세요 (회당·일당 X)
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label">구매일</div>
              <input type="date" className="input" value={form.purchaseDate}
                     onChange={e => set('purchaseDate', e.target.value)} />
            </div>
          </div>
          <div>
            <div className="label">메모 <span className="text-[10px] text-ink-500 font-normal">(선택)</span></div>
            <textarea className="input min-h-[60px] resize-none" value={form.notes}
                      onChange={e => set('notes', e.target.value)}
                      placeholder="예: 처방전 가져가면 5천원 할인, 진료비 별도, 마운자로 재고 잘 있음 등"
                      maxLength={200} />
          </div>
          <button onClick={submit} disabled={!canSubmit} className="btn-primary w-full !py-3 text-base">
            ✍ 익명 제보
          </button>
          <p className="text-[10px] text-ink-500 text-center -mt-2">
            제보는 익명으로 디렉토리에 즉시 반영됩니다. 개인 정보는 저장되지 않습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
