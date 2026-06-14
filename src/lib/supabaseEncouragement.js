// 응원의 한마디 wall — Supabase wrapper (RPC). 실패 시 null → 컴포넌트가 localStorage seed fallback.
// 보안: 읽기는 recent_encouragements RPC로만 (전체 덤프 차단, 009 참고).
import { supabase, supabaseConfigured } from './supabaseClient.js';

let _cache = null;
let _cacheTs = 0;
const TTL = 30 * 1000;

// 최근 응원 N개
export async function fetchRecentEncouragements(limit = 12) {
  if (!supabaseConfigured) return null;
  if (_cache && Date.now() - _cacheTs < TTL) return _cache;
  try {
    const { data, error } = await supabase.rpc('recent_encouragements', { lim: limit });
    if (error) {
      if (!/does not exist/i.test(error.message)) console.warn('[enc fetch]', error.message);
      return null;
    }
    const rows = (data || []).map(r => ({
      id: r.id,
      text: r.text,
      gender: r.gender,
      ageGroup: r.age_group,
      date: r.submitted_at ? r.submitted_at.slice(0, 10) : null,
      submittedAt: r.submitted_at,
      seed: !!r.is_seed,
    }));
    _cache = rows; _cacheTs = Date.now();
    return rows;
  } catch (e) {
    console.warn('[enc fetch] threw', e);
    return null;
  }
}

// 응원 등록
export async function submitEncouragement({ text, gender, ageGroup, userId }) {
  if (!supabaseConfigured) return { ok: false, error: 'supabase 미설정' };
  try {
    const { data, error } = await supabase.from('encouragements').insert({
      seed: false,
      text,
      gender: gender || 'X',
      age_group: ageGroup || null,
      submitted_by: userId || null,
    }).select('id').single();
    if (error) {
      console.warn('[enc submit]', error.message);
      return { ok: false, error: error.message };
    }
    _cache = null;  // 무효화
    return { ok: true, id: data?.id };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

// 응원 신고 (reported_count++, 임계 3이면 서버에서 자동 숨김)
export async function reportEncouragement(id) {
  if (!supabaseConfigured) return { ok: false };
  try {
    const { error } = await supabase.rpc('report_encouragement', { eid: id });
    if (error) { console.warn('[enc report]', error.message); return { ok: false }; }
    _cache = null;
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

// 총 응원 수
export async function fetchEncouragementCount() {
  if (!supabaseConfigured) return null;
  try {
    const { data, error } = await supabase.rpc('encouragement_count');
    if (error) return null;
    return Number(data) || 0;
  } catch {
    return null;
  }
}
