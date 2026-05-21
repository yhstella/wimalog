import React, { useState, useEffect } from 'react';
import { DIET_HIERARCHY, PORTION_OPTIONS, nutritionForMenu } from '../lib/dietHierarchy.js';

// 식단 4단계 계층 선택기 — 카테고리 → 종류 → 메뉴 → 양
// onChange({ menu, portion, protein, kcal, categoryId })로 부모에 영양 정보 전달
export function DietHierarchyPicker({ value = '', onChange }) {
  const [step, setStep] = useState(value ? 'done' : 'category');
  const [categoryId, setCategoryId] = useState(null);
  const [subId, setSubId] = useState(null);
  const [pickedMenu, setPickedMenu] = useState(value);
  const [portion, setPortion] = useState('normal');
  const [freeInput, setFreeInput] = useState(value);
  const [showFree, setShowFree] = useState(false);

  // 부모가 value를 ''로 reset하면 picker도 카테고리부터 다시 시작
  useEffect(() => {
    if (!value) {
      setStep('category');
      setCategoryId(null);
      setSubId(null);
      setPickedMenu('');
      setPortion('normal');
      setShowFree(false);
      setFreeInput('');
    }
  }, [value]);

  // 양 변경 시 부모에 nutrition 다시 전달
  const emit = (menu, port) => {
    const nutri = nutritionForMenu(menu, port, categoryId);
    // 단순 string 호환 + nutrition 포함 객체 전달
    onChange?.(menu, { menu, portion: port, ...nutri, categoryId });
  };

  const category = categoryId ? DIET_HIERARCHY[categoryId] : null;
  const sub = category && subId ? category.subcategories[subId] : null;

  const reset = () => {
    setStep('category');
    setCategoryId(null);
    setSubId(null);
    setShowFree(false);
    setPickedMenu('');
    setPortion('normal');
    onChange?.('', null);
  };

  const pickMenu = (menu) => {
    setPickedMenu(menu);
    setStep('done');
    emit(menu, portion);
  };

  const changePortion = (p) => {
    setPortion(p);
    if (pickedMenu) emit(pickedMenu, p);
  };

  const submitFree = () => {
    if (!freeInput.trim()) return;
    setPickedMenu(freeInput.trim());
    setStep('done');
    setShowFree(false);
    emit(freeInput.trim(), portion);
  };

  // 색상 매핑
  const colorClass = (color, selected) => {
    const map = {
      emerald: selected ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-emerald-50 dark:bg-emerald-900/15 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/40 hover:border-emerald-400',
      amber:   selected ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-amber-50 dark:bg-amber-900/15 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800/40 hover:border-amber-400',
      rose:    selected ? 'bg-rose-500 text-white border-rose-500'
                        : 'bg-rose-50 dark:bg-rose-900/15 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-800/40 hover:border-rose-400',
      sky:     selected ? 'bg-sky-500 text-white border-sky-500'
                        : 'bg-sky-50 dark:bg-sky-900/15 text-sky-900 dark:text-sky-200 border-sky-200 dark:border-sky-800/40 hover:border-sky-400',
    };
    return map[color] || '';
  };

  // 완료 상태 — 선택된 메뉴 + 양 선택 + 변경 버튼
  if (step === 'done' && value) {
    const nutri = nutritionForMenu(value, portion, categoryId);
    return (
      <div className="space-y-2">
        <div className="rounded-xl border-2 border-brand-300 dark:border-brand-700 bg-brand-50/60 dark:bg-brand-900/15 p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-xl flex-shrink-0">✓</span>
            <span className="font-semibold text-ink-900 dark:text-slate-100 truncate">{value}</span>
          </div>
          <button onClick={reset} className="text-xs text-brand-700 dark:text-brand-400 underline flex-shrink-0">
            변경
          </button>
        </div>
        {/* 양 선택 — 약간/적당히/많이 */}
        <div>
          <div className="text-xs font-semibold text-ink-500 dark:text-slate-400 mb-1.5">먹은 양</div>
          <div className="grid grid-cols-3 gap-1.5">
            {PORTION_OPTIONS.map(p => (
              <button key={p.id} type="button" onClick={() => changePortion(p.id)}
                      className={`py-2 rounded-lg text-sm font-medium border-2 transition
                                  ${portion === p.id
                                    ? 'bg-brand-500 text-white border-brand-500'
                                    : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-200 dark:border-slate-700 hover:border-brand-400'}`}>
                <span className="mr-1">{p.icon}</span>{p.label}
              </button>
            ))}
          </div>
        </div>
        {/* 자동 계산된 영양 정보 미리보기 */}
        <div className="rounded-lg bg-ink-100/60 dark:bg-slate-800/60 px-3 py-1.5 text-xs text-ink-700 dark:text-slate-300 flex gap-4 justify-center">
          <span>단백질 <b className="text-brand-700 dark:text-brand-400 tabular-nums">{nutri.protein}g</b></span>
          <span>·</span>
          <span>칼로리 <b className="text-brand-700 dark:text-brand-400 tabular-nums">{nutri.kcal} kcal</b></span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 경로 표시 + 뒤로 */}
      {step !== 'category' && (
        <div className="flex items-center gap-2 text-xs text-ink-500 dark:text-slate-400">
          <button onClick={() => setStep('category')} className="hover:text-brand-700 dark:hover:text-brand-400">
            카테고리
          </button>
          {category && (
            <>
              <span>›</span>
              <button onClick={() => { setStep('sub'); setSubId(null); }} className="hover:text-brand-700 dark:hover:text-brand-400">
                {category.label}
              </button>
            </>
          )}
          {sub && <><span>›</span><span className="text-ink-700 dark:text-slate-300 font-semibold">{sub.label}</span></>}
        </div>
      )}

      {/* Step 1: 카테고리 4개 */}
      {step === 'category' && !showFree && (
        <div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(DIET_HIERARCHY).map(([id, c]) => (
              <button key={id} type="button"
                      onClick={() => { setCategoryId(id); setStep('sub'); }}
                      className={`rounded-xl border-2 p-3 text-left transition ${colorClass(c.color, false)}`}>
                <div className="text-2xl">{c.icon}</div>
                <div className="font-bold text-sm mt-1">{c.label}</div>
                <div className="text-[10px] opacity-80 mt-0.5">{c.desc}</div>
              </button>
            ))}
          </div>
          <button onClick={() => setShowFree(true)}
                  className="mt-2 w-full text-xs text-ink-500 dark:text-slate-500 hover:text-brand-700 dark:hover:text-brand-400 py-2 border border-dashed border-ink-200 dark:border-slate-700 rounded-lg">
            ✏️ 직접 입력하기
          </button>
        </div>
      )}

      {/* Step 2: 서브카테고리 */}
      {step === 'sub' && category && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(category.subcategories).map(([id, s]) => (
            <button key={id} type="button"
                    onClick={() => { setSubId(id); setStep('menu'); }}
                    className={`rounded-xl border-2 p-3 text-left transition ${colorClass(category.color, false)}`}>
              <div className="text-xl">{s.icon}</div>
              <div className="font-semibold text-sm mt-1">{s.label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Step 3: 메뉴 */}
      {step === 'menu' && sub && (
        <div className="grid grid-cols-2 gap-2">
          {sub.items.map(menu => (
            <button key={menu} type="button"
                    onClick={() => pickMenu(menu)}
                    className={`rounded-lg border p-2.5 text-sm text-left transition ${colorClass(category.color, false)}`}>
              {menu}
            </button>
          ))}
        </div>
      )}

      {/* 자유 입력 모드 */}
      {showFree && (
        <div className="space-y-2">
          <input type="text" className="input" maxLength={50} autoFocus
                 value={freeInput} onChange={e => setFreeInput(e.target.value)}
                 placeholder="예: 닭갈비, 떡볶이 등"
                 onKeyDown={e => e.key === 'Enter' && submitFree()} />
          <div className="flex gap-2">
            <button onClick={submitFree} disabled={!freeInput.trim()} className="btn-primary !py-2 flex-1">저장</button>
            <button onClick={() => { setShowFree(false); }} className="btn-secondary !py-2">취소</button>
          </div>
        </div>
      )}
    </div>
  );
}
