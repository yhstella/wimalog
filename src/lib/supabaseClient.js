// Supabase 클라이언트 — Auth + (추후) DB
// anon key는 브라우저에 공개되어도 안전 (RLS로 데이터 보호).
// 환경변수 미설정 시 supabase 기능 비활성화 — 기존 localStorage 흐름은 유지.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = supabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,  // OAuth redirect 후 URL의 토큰 자동 처리
        storage: window.localStorage,
        storageKey: 'wimalog.auth',
      },
    })
  : null;

if (!supabaseConfigured && typeof console !== 'undefined') {
  console.warn('[supabase] VITE_SUPABASE_URL/ANON_KEY 미설정 — 소셜 로그인 비활성화 (localStorage 익명 가입은 정상)');
}
