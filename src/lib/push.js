// Web Push 구독 — 클라이언트 측.
// VAPID public 키는 원래 클라이언트에 공개되는 값(시크릿 아님). env 있으면 우선, 없으면 내장 기본값.
// 발송용 PRIVATE 키는 서버(/api/send-push)에만, 절대 클라/깃에 두지 않는다.
import { supabase, supabaseConfigured } from './supabaseClient.js';

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY
  || 'BCp-fKPOHEC64PjPqhqHikfMj00GEHIudRMFolpPy8l_S7uiexGQ6cWyQkHLGySWPvNF_CkDlhi7unsAPnpHETQ';

export function pushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

// base64url VAPID 키 → Uint8Array (applicationServerKey 형식)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getRegistration() {
  // main.jsx/index.html이 등록한 SW가 ready될 때까지 대기
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.ready;
}

// 현재 구독 상태 — 'granted-subscribed' | 'granted-unsubscribed' | 'default' | 'denied' | 'unsupported'
export async function getPushState() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'default') return 'default';
  try {
    const reg = await getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub ? 'granted-subscribed' : 'granted-unsubscribed';
  } catch {
    return 'granted-unsubscribed';
  }
}

// 구독 + Supabase 저장. 성공 시 true.
export async function subscribeToPush(userId) {
  if (!pushSupported()) return { ok: false, error: 'unsupported' };
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, error: 'denied' };

    const reg = await getRegistration();
    if (!reg) return { ok: false, error: 'no-sw' };

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
    }

    // Supabase에 저장 (endpoint unique → upsert). 미설정 시 구독 자체는 되지만 발송 대상엔 안 들어감.
    if (supabaseConfigured && supabase) {
      const json = sub.toJSON();
      await supabase.from('push_subscriptions').upsert({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        user_id: userId || null,
        user_agent: navigator.userAgent?.slice(0, 200) || null,
      }, { onConflict: 'endpoint' });
    }
    return { ok: true };
  } catch (e) {
    console.warn('[push] subscribe failed', e);
    return { ok: false, error: e?.message || 'error' };
  }
}

export async function unsubscribeFromPush() {
  if (!pushSupported()) return { ok: false };
  try {
    const reg = await getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      if (supabaseConfigured && supabase) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      }
      await sub.unsubscribe();
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message };
  }
}
