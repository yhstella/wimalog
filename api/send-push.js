// Vercel 서버리스 함수 — Web Push 일괄 발송.
// 호출: Vercel Cron 또는 수동 GET/POST. CRON_SECRET으로 보호.
//   GET /api/send-push?secret=XXX            (기본 리마인더 카피)
//   GET /api/send-push?secret=XXX&body=...&title=...&url=...
//   또는 헤더 Authorization: Bearer <CRON_SECRET>
//
// 필요한 Vercel 환경변수 (Project Settings → Environment Variables):
//   VAPID_PRIVATE_KEY        — 🔴 시크릿 (생성된 private 키)
//   VAPID_PUBLIC_KEY         — public 키 (클라와 동일)
//   VAPID_SUBJECT            — 'mailto:you@example.com'
//   SUPABASE_URL             — 프로젝트 URL
//   SUPABASE_SERVICE_ROLE_KEY— 🔴 시크릿 (service_role 키 — RLS 우회 읽기)
//   CRON_SECRET              — 🔴 임의 문자열 (엔드포인트 보호)
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // ── 인증 ──
  const secret = process.env.CRON_SECRET;
  const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    || (req.query && req.query.secret) || '';
  if (!secret || provided !== secret) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const { VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT,
          SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, error: 'missing env (VAPID/SUPABASE)' });
  }

  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@wimalog.kr', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // ── 구독 목록 (service_role → RLS 우회) ──
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth');
  if (error) return res.status(500).json({ ok: false, error: error.message });
  if (!subs || !subs.length) return res.status(200).json({ ok: true, sent: 0, note: '구독 없음' });

  const q = req.query || {};
  const payload = JSON.stringify({
    title: q.title || '위마로그',
    body: q.body || '오늘 체중 기록하셨나요? 30초면 추세선이 이어져요 🌱',
    url: q.url || 'https://wimalog.kr/',
    tag: q.tag || 'wimalog-reminder',
  });

  let sent = 0, removed = 0;
  const dead = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      );
      sent++;
    } catch (e) {
      // 410 Gone / 404 → 만료된 구독, 정리
      if (e?.statusCode === 410 || e?.statusCode === 404) dead.push(s.endpoint);
    }
  }));

  if (dead.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', dead);
    removed = dead.length;
  }

  return res.status(200).json({ ok: true, total: subs.length, sent, removed });
}
