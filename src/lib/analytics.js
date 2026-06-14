// 경량 애널리틱스 래퍼 — Vercel Web Analytics 위에 얇은 funnel 레이어.
// 목적: "트래픽 확보" 목표의 측정 수단. 방문 → 시뮬레이터 → 가입 전환 퍼널을 본다.
// 원칙(메모리): 가벼움 유지(스크립트 ~1KB, async), 개인정보 수집 X (Vercel은 쿠키리스).
// 모든 호출은 방어적 — 패키지/플랜 미지원이어도 절대 throw 하지 않고 no-op.
import { inject, track as vercelTrack } from '@vercel/analytics';

let initialized = false;

export function initAnalytics() {
  if (initialized) return;
  initialized = true;
  try {
    inject({ mode: import.meta.env.PROD ? 'production' : 'development' });
  } catch {}
}

// 커스텀 이벤트 — props는 평탄한 string/number/boolean만 (Vercel 제약)
export function track(event, props) {
  try {
    if (props && typeof props === 'object') {
      // undefined/null 값 제거 — Vercel이 거부
      const clean = {};
      for (const [k, v] of Object.entries(props)) {
        if (v != null) clean[k] = v;
      }
      vercelTrack(event, clean);
    } else {
      vercelTrack(event);
    }
  } catch {}
}

// 세션당 1회만 발화 — 시뮬레이터 첫 인터랙션처럼 funnel 진입 1회 측정용.
// sessionStorage 사용: 탭/세션 단위. 같은 방문에서 중복 카운트 방지.
const FIRED_PREFIX = 'wimalog_evt_';
export function trackOnce(event, props) {
  try {
    const key = FIRED_PREFIX + event;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    // sessionStorage 불가(사파리 프라이빗 등) — 그냥 매번 발화
  }
  track(event, props);
}
