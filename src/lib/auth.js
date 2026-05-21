// 인증 헬퍼 — Supabase OAuth + 익명(localStorage) 통합
// 사용자가 어떤 방식으로 가입했든 동일한 user 객체 반환
import { supabase, supabaseConfigured } from './supabaseClient.js';
import { Storage, uid } from './storage.js';

/**
 * 소셜 OAuth 로그인 — Supabase가 redirect/callback 처리
 * provider: 'google' | 'kakao' | 'naver' (naver는 Supabase 직접 지원 X — Custom Provider 필요)
 */
export async function signInWithOAuth(provider) {
  if (!supabaseConfigured) {
    throw new Error('Supabase 미설정 — 익명 가입을 사용해 주세요');
  }
  // 콜백 후 돌아올 URL — 현재 페이지로
  const redirectTo = `${window.location.origin}/?auth=callback`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,  // supabase가 'google', 'kakao' 등 직접 지원
    options: { redirectTo },
  });
  if (error) throw error;
  return data;
}

/**
 * 현재 Supabase 세션 가져오기 (페이지 로드 시 자동 호출)
 */
export async function getSession() {
  if (!supabaseConfigured) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * 로그아웃 — Supabase 세션 + localStorage 세션 모두 정리
 */
export async function signOut() {
  if (supabaseConfigured) {
    try { await supabase.auth.signOut(); } catch {}
  }
  Storage.setSession(null);
}

/**
 * Supabase 세션 → wimalog User 변환·동기화
 * 새 OAuth 가입 시 localStorage에 user 객체 생성
 * 기존 OAuth 사용자는 같은 userId 재사용
 */
export function syncOAuthUser(session) {
  if (!session?.user) return null;
  const { id, email, user_metadata, app_metadata } = session.user;
  // wimalog 내부 ID — supabase user.id를 그대로 키로 사용
  const userId = `oauth-${id}`;
  let user = Storage.getUser(userId);
  if (!user) {
    // 신규 가입 — 부분 정보만 채우고, 키/체중 등은 onboarding 유도
    user = {
      id: userId,
      seed: false,
      nickname: user_metadata?.full_name || user_metadata?.name || email?.split('@')[0] || '나',
      email,
      avatarUrl: user_metadata?.avatar_url || user_metadata?.picture || null,
      authProvider: app_metadata?.provider || 'oauth',
      gender: 'X',
      ageGroup: '40s',
      height: null,
      startWeight: null,
      targetWeight: null,
      conditions: {},
      purpose: 'weight',
      visitPurpose: 'using',  // OAuth 신규 가입은 사용 중으로 기본 가정 — InitialSetup 우발적 재노출 방지
      concerns: [],
      consents: { privacy: true, sensitiveData: true, anonymizedShare: true },
      createdAt: new Date().toISOString(),
      profileIncomplete: true, // height/weight 미입력 표시
    };
    Storage.upsertUser(user);
  } else if (!user.visitPurpose) {
    // 기존 OAuth 사용자에 visitPurpose 없으면 default 부여 (재로그인 시 InitialSetup 우발 노출 방지)
    user = { ...user, visitPurpose: 'using' };
    Storage.upsertUser(user);
  }
  Storage.setSession(userId);
  return user;
}

/**
 * 페이지 로드 시 OAuth callback 자동 처리
 * Supabase는 URL fragment의 token을 detectSessionInUrl로 자동 처리
 * 그 직후 getSession()으로 session 얻어 syncOAuthUser 호출
 */
export async function bootstrapAuth() {
  if (!supabaseConfigured) return null;
  const session = await getSession();
  if (session) return syncOAuthUser(session);
  return null;
}

/**
 * 세션 변경 감지 (login/logout)
 */
export function onAuthChange(callback) {
  if (!supabaseConfigured) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      const user = syncOAuthUser(session);
      callback?.(user);
    } else if (event === 'SIGNED_OUT') {
      callback?.(null);
    }
  });
  return () => data.subscription.unsubscribe();
}
