import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from './Toast.jsx';
import {
  fetchRecentEncouragements, submitEncouragement, reportEncouragement,
} from '../lib/supabaseEncouragement.js';
import { track } from '../lib/analytics.js';

// 응원의 한마디 wall — 짧은 익명 응원. 답글·DM 없음(설계 제약 = 모더레이션 비용 최소화).
// 두 청중: 어른(사회적 증거)·아이(동기·재방문). Supabase 서버 공유 + localStorage fallback.
const LS_KEY = 'wimalog_encouragements_local';   // 내가 쓴 글 / Supabase 미설정 시 보관
const MAX_LEN = 80;

// cold start / Supabase 미설정용 클라 seed — 실제 응원과 자연스럽게 섞임 (가짜 뉘앙스 X, 짧고 진솔)
const CLIENT_SEED = [
  { id: 's1', text: '3주차 정체기였는데 여기 보고 다시 힘내요', gender: 'F', ageGroup: '40s', date: daysAgo(2), seed: true },
  { id: 's2', text: '오심 2주 지나니 정말 살 만해요. 화이팅!', gender: 'M', ageGroup: '30s', date: daysAgo(3), seed: true },
  { id: 's3', text: '−5kg 찍었어요! 다들 할 수 있어요', gender: 'F', ageGroup: '30s', date: daysAgo(5), seed: true },
  { id: 's4', text: '격주로 줄여도 유지되네요. 포기 안 하길 잘했어요', gender: 'F', ageGroup: '50s', date: daysAgo(6), seed: true },
  { id: 's5', text: '첫 주사 무서웠는데 막상 해보니 괜찮아요', gender: 'F', ageGroup: '20s', date: daysAgo(8), seed: true },
  { id: 's6', text: '같이 기록하니 덜 외로워요', gender: 'M', ageGroup: '40s', date: daysAgo(10), seed: true },
];

function daysAgo(n) {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().slice(0, 10);
}
function loadLocal() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; }
}
function saveLocal(list) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, 50))); } catch {}
}
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return '';
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  return `${Math.floor(days / 30)}개월 전`;
}

// 약거래·광고·스팸 차단 — 한 줄 응원만 받기 위한 가벼운 필터 (모더레이션 비용↓)
const BANNED = ['판매', '팝니다', '삽니다', '구해요', '직거래', '오픈카톡', '오카', '텔레', '입금', '계좌', '광고', 'http', 'www.', '.com', '.kr/'];
function looksBad(text) {
  const t = text.toLowerCase();
  if (BANNED.some(w => t.includes(w.toLowerCase()))) return '응원의 한마디만 남길 수 있어요 (거래·링크·연락처는 제외)';
  const digits = (text.match(/\d/g) || []).length;
  if (digits >= 9) return '연락처처럼 보이는 숫자는 넣을 수 없어요';
  return null;
}

export function EncouragementWall({ user, navigate, onSignup, variant = 'default', limit = 6 }) {
  const toast = useToast();
  const [items, setItems] = useState(null);   // null = 로딩
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    const remote = await fetchRecentEncouragements(Math.max(limit, 12));
    const local = loadLocal();
    if (remote && remote.length) {
      // 서버 + 내 로컬 글 병합 (중복 id 제거), 최신순
      const map = new Map();
      [...local, ...remote].forEach(r => { if (r?.id) map.set(r.id, r); });
      const merged = [...map.values()].sort((a, b) =>
        new Date(b.submittedAt || b.date) - new Date(a.submittedAt || a.date));
      setItems(merged);
    } else {
      // Supabase 미설정/미적용 — 클라 seed + 내 로컬 글
      const merged = [...local, ...CLIENT_SEED].sort((a, b) =>
        new Date(b.date) - new Date(a.date));
      setItems(merged);
    }
  }, [limit]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e?.preventDefault();
    if (!user) {
      toast.info('가입하고 응원 한마디를 남겨보세요');
      (onSignup || (() => navigate?.('landing')))();
      return;
    }
    const trimmed = text.trim();
    if (trimmed.length < 2) { toast.error('너무 짧아요'); return; }
    if (trimmed.length > MAX_LEN) { toast.error(`최대 ${MAX_LEN}자`); return; }
    const bad = looksBad(trimmed);
    if (bad) { toast.error(bad); return; }

    setPosting(true);
    const entry = {
      id: 'local_' + Math.random().toString(36).slice(2, 10),
      text: trimmed,
      gender: user.gender,
      ageGroup: user.ageGroup,
      date: new Date().toISOString().slice(0, 10),
      submittedAt: new Date().toISOString(),
      mine: true,
    };
    // 낙관적 prepend + 로컬 보관(서버 실패해도 내 글은 보임)
    setItems(prev => [entry, ...(prev || [])]);
    saveLocal([entry, ...loadLocal()]);
    setText('');

    const res = await submitEncouragement({
      text: trimmed, gender: user.gender, ageGroup: user.ageGroup, userId: user.id,
    });
    setPosting(false);
    if (res.ok) {
      if (res.id) {
        // 서버 id로 교체 (신고 가능하도록)
        setItems(prev => (prev || []).map(it => it.id === entry.id ? { ...it, id: res.id } : it));
      }
      track('encouragement_post', { variant });
      toast.success('응원 고마워요 💪 익명으로 함께 보여요');
    } else {
      // 서버 실패 — 로컬엔 남아 본인은 봄. 조용히 처리 (offline-friendly)
      track('encouragement_post', { variant, local: true });
    }
  };

  const report = async (item) => {
    if (item.seed || item.mine) return;
    if (!window.confirm('이 응원을 신고할까요? 부적절한 내용이면 가려집니다.')) return;
    setItems(prev => (prev || []).filter(it => it.id !== item.id));
    if (typeof item.id === 'string' && item.id.startsWith('local_')) return;
    await reportEncouragement(item.id);
    toast.info('신고 접수됐어요');
  };

  const shown = (items || []).slice(0, limit);
  const compact = variant === 'dashboard';

  return (
    <section className={compact
      ? 'card !p-4'
      : 'rounded-2xl bg-gradient-to-br from-rose-50 to-amber-50 dark:from-rose-900/15 dark:to-amber-900/10 border border-rose-100 dark:border-rose-900/30 p-5 sm:p-6'}>
      <div className="flex items-end justify-between mb-3 gap-2">
        <div>
          <h2 className="font-bold text-ink-900 dark:text-slate-100 flex items-center gap-1.5 text-base sm:text-lg">
            <span>💪</span> 함께 가는 사람들
          </h2>
          <p className="text-xs text-ink-500 dark:text-slate-400 mt-0.5">
            익명 응원 한마디 — 혼자가 아니에요
          </p>
        </div>
      </div>

      {/* 입력 — 가입자만, 비가입자는 가입 유도 */}
      {user ? (
        <form onSubmit={submit} className="flex gap-2 mb-4">
          <input
            type="text" value={text}
            onChange={e => setText(e.target.value)}
            maxLength={MAX_LEN}
            placeholder="응원 한마디 남기기 (익명)"
            className="flex-1 rounded-xl border border-ink-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900/40 transition" />
          <button type="submit" disabled={posting || text.trim().length < 2}
                  className="rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white px-4 py-2.5 text-sm font-bold transition flex-shrink-0">
            {posting ? '…' : '남기기'}
          </button>
        </form>
      ) : (
        <button onClick={() => (onSignup || (() => navigate?.('landing')))()}
                className="w-full mb-4 rounded-xl border-2 border-dashed border-rose-200 dark:border-rose-800/50 bg-white/60 dark:bg-slate-900/40 px-4 py-3 text-sm font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition">
          + 가입하고 응원 한마디 남기기
        </button>
      )}

      {/* 리스트 */}
      {items === null ? (
        <div className="text-center py-6 text-sm text-ink-400 dark:text-slate-500">
          <span className="inline-block w-2 h-2 rounded-full bg-rose-300 animate-pulse mr-1.5" />
          불러오는 중…
        </div>
      ) : shown.length === 0 ? (
        <div className="text-center py-6 text-sm text-ink-500 dark:text-slate-400">
          첫 응원을 남겨보세요 🌱
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map(item => (
            <div key={item.id}
                 className="group rounded-xl bg-white/70 dark:bg-slate-900/50 px-3.5 py-2.5 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-ink-800 dark:text-slate-200 leading-snug break-words">
                  {item.mine && <span className="text-brand-600 dark:text-brand-400 font-semibold">[나] </span>}
                  {item.text}
                </p>
                <div className="text-[10px] text-ink-400 dark:text-slate-500 mt-1">
                  {item.gender === 'F' ? '여성' : item.gender === 'M' ? '남성' : '익명'}
                  {item.ageGroup ? ` · ${item.ageGroup.replace('s', '대').replace('60대+', '60대+')}` : ''}
                  {' · '}{timeAgo(item.submittedAt || item.date)}
                </div>
              </div>
              {!item.seed && !item.mine && (
                <button onClick={() => report(item)}
                        title="신고"
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-[10px] text-ink-300 dark:text-slate-600 hover:text-rose-500 transition flex-shrink-0">
                  신고
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
