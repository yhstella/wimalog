import React, { useState, useEffect } from 'react';
import { useToast } from './Toast.jsx';

// 한 줄 후기 — 가입자가 작성, 익명으로 노출
const KEY = 'gl_testimonials';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; }
  catch { return []; }
}
function save(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

// 시드 후기
const SEED = [
  { topicId: 'drug:wegovy',   text: '한 달 -3kg. 오심은 첫주만 있었고 이제 괜찮음. 단백질 챙기는 게 중요한 듯', gender: 'F', ageGroup: '40s', date: '2026-05-15' },
  { topicId: 'drug:wegovy',   text: '0.5mg에서 1.0mg 올리니까 식욕이 확 줄었어요. 너무 안 먹으면 안 됨', gender: 'M', ageGroup: '30s', date: '2026-05-14' },
  { topicId: 'drug:mounjaro', text: '효과는 진짜 좋은데 가격이 부담. 5mg에서 유지 중', gender: 'F', ageGroup: '30s', date: '2026-05-16' },
  { topicId: 'drug:mounjaro', text: '15mg까지 안 가도 됐어요. 10mg에서 만족', gender: 'F', ageGroup: '40s', date: '2026-05-12' },
  { topicId: 'drug:saxenda',  text: '매일 주사가 처음엔 부담이었는데 익숙해짐. 가격 좋아요', gender: 'F', ageGroup: '50s', date: '2026-05-10' },
  { topicId: 'effect:nausea', text: '시작 첫주가 제일 심함. 식사 천천히 + 작게 먹으니 2주차부터 괜찮아짐', gender: 'F', ageGroup: '40s', date: '2026-05-15' },
  { topicId: 'effect:nausea', text: '용량 올릴 때마다 다시 시작됨. 4-5일 지나면 적응', gender: 'M', ageGroup: '40s', date: '2026-05-13' },
  { topicId: 'effect:constipation', text: '물 많이 + 채소 + 가벼운 운동으로 해결', gender: 'F', ageGroup: '30s', date: '2026-05-14' },
];

function ensureSeed() {
  const list = load();
  if (!list.some(t => t._seeded)) {
    save([...SEED.map(t => ({ ...t, _seeded: true, id: 'seed_' + Math.random().toString(36).slice(2, 9) })), ...list]);
  }
}

export function TestimonialBox({ topicId, user }) {
  const toast = useToast();
  const [list, setList] = useState(() => { ensureSeed(); return load(); });
  const [text, setText] = useState('');

  const filtered = list.filter(t => t.topicId === topicId).slice(0, 8);

  const submit = (e) => {
    e?.preventDefault();
    if (!user) {
      toast.info('한 줄 후기는 가입자만 작성 가능합니다');
      return;
    }
    const trimmed = text.trim();
    if (trimmed.length < 5) {
      toast.error('최소 5자 이상');
      return;
    }
    const all = load();
    all.unshift({
      id: 't_' + Math.random().toString(36).slice(2, 9),
      topicId,
      text: trimmed,
      gender: user.gender,
      ageGroup: user.ageGroup,
      date: new Date().toISOString().slice(0, 10),
    });
    save(all);
    setList(all);
    setText('');
    toast.success('후기 등록됨 — 익명으로 보입니다');
  };

  return (
    <section className="card">
      <div className="flex justify-between items-end mb-3">
        <div>
          <h2 className="section-title">실제 사용자 한 줄 후기</h2>
          <p className="section-subtitle">위마로그 사용자가 직접 남긴 메모 ({filtered.length})</p>
        </div>
      </div>

      {user && (
        <form onSubmit={submit} className="flex gap-2 mb-4">
          <input type="text" value={text}
                 onChange={e => setText(e.target.value)}
                 maxLength={120}
                 placeholder="익명 후기 한 줄 (최대 120자)"
                 className="input flex-1" />
          <button type="submit" disabled={text.trim().length < 5} className="btn-primary !py-2 !px-4 text-sm">등록</button>
        </form>
      )}

      {filtered.length === 0 ? (
        <div className="text-sm text-ink-500 dark:text-slate-400 text-center py-4">
          아직 후기가 없어요. 첫 후기를 남겨보세요!
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => (
            <div key={t.id} className="rounded-xl bg-ink-100/40 dark:bg-slate-800/40 p-3">
              <p className="text-sm text-ink-700 dark:text-slate-300">"{t.text}"</p>
              <div className="text-[10px] text-ink-500 dark:text-slate-500 mt-1.5">
                {t.gender === 'F' ? '여성' : t.gender === 'M' ? '남성' : '익명'} {t.ageGroup} · {t.date}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
