// Vercel Edge Middleware — 봇/링크 미리보기 스크래퍼가 진입할 때
// 라우트별로 <title>, <meta description>, og:title, og:description, og:url, canonical을
// HTML에 동적으로 치환해서 응답.
// 사람 브라우저는 그대로 두고 (CSR 라우터가 클라이언트에서 갱신).
//
// SEO 효과: /drug/wegovy, /effect/nausea 등 모든 sub-route가 검색엔진과 카카오톡/슬랙
// 미리보기에서 고유 메타로 노출됨.

export const config = {
  matcher: ['/drug/:slug', '/effect/:slug', '/guide/:slug', '/calc/:slug', '/compare', '/stats', '/info', '/pharmacies', '/pharmacy/:slug'],
};

// 봇/스크래퍼 user-agent 패턴 — Googlebot, Kakaotalk, Slack, Facebook 등
const BOT_UA = /\b(googlebot|bingbot|naver|yeti|daum|kakaotalk|facebookexternalhit|twitterbot|slackbot|discordbot|telegrambot|whatsapp|linkedinbot|pinterest|applebot|duckduckbot|ahrefsbot|semrushbot|mj12bot|yandexbot|baiduspider|crawler|spider)\b/i;

// 약별 메타 (DRUG_CONTENT에서 추출. 빌드 타임에 sync 필요 — 변경 시 양쪽 업데이트)
const DRUG_META = {
  wegovy:   { label: '위고비',   en: 'Wegovy/Semaglutide',     headlineKg: '15-17%' },
  mounjaro: { label: '마운자로', en: 'Mounjaro/Tirzepatide',   headlineKg: '20-22%' },
  saxenda:  { label: '삭센다',   en: 'Saxenda/Liraglutide',    headlineKg: '6-8%' },
  ozempic:  { label: '오젬픽',   en: 'Ozempic/Semaglutide',    headlineKg: '10-12%' },
  zepbound: { label: '젭바운드', en: 'Zepbound/Tirzepatide',   headlineKg: '18-21%' },
};

const EFFECT_META = {
  nausea:       { label: '오심(메스꺼움)',   summary: 'GLP-1 사용자 30-40%가 경험하는 가장 흔한 부작용. 보통 4-8주 내 호전됩니다.' },
  vomiting:     { label: '구토',             summary: '오심에 이어 흔한 위장관 부작용. 용량 증량 후 2-3일 집중. 탈수 주의.' },
  constipation: { label: '변비',             summary: 'GLP-1이 위장 운동을 느리게 해 발생. 수분·식이섬유로 완화 가능.' },
  diarrhea:     { label: '설사',             summary: '오심·구토보다 덜 흔하지만 사용자 15-25%가 경험. 자주 발생하면 의사 상담.' },
  fatigue:      { label: '피로감',           summary: '식사량 급감과 칼로리 부족에서 오는 경우가 많음. 단백질·수분 보충 권장.' },
  headache:     { label: '두통',             summary: '저혈당·탈수와 관련된 경우가 많음. 식사 후에도 지속되면 의사 상담.' },
};

const STATIC_META = {
  '/compare':    { title: '5개 약 한눈 비교 — 위고비·마운자로·삭센다·오젬픽·젭바운드', description: '한국에서 사용 가능한 GLP-1 비만치료제 5종의 효과·부작용·가격·사용법을 한 화면에서 비교하세요.' },
  '/stats':      { title: '통계 — 한국 GLP-1 사용자 익명 비교', description: '약별·BMI별·성별·연령별 감량률, 부작용 발생률, 약값, 중단 후 회복 데이터를 비교합니다.' },
  '/info':       { title: '안전 정보 — GLP-1 즉시 의료 상담 기준', description: '췌장염·담낭질환·저혈당 의심 증상, GLP-1 신중 사용 대상자 등 안전 정보를 정리했습니다.' },
  '/pharmacies': { title: '한국 GLP-1 약국 가격 디렉토리 — 약국별 4주분 최근 가격', description: '서울 대학로·강남·종로 등 한국 GLP-1 약국별 위고비·마운자로 가격을 사용자 익명 제보로 비교. 4주분(1박스) 기준.' },
};

const PHARMACY_REGION_LABELS = {
  'seoul-daehakro': '서울 대학로', 'seoul-gangnam': '서울 강남', 'seoul-jongno': '서울 종로',
  'seoul-sinchon': '서울 신촌',   'seoul-songpa': '서울 송파',
  'gyeonggi-bundang': '경기 분당', 'gyeonggi-ilsan': '경기 일산', 'gyeonggi-suwon': '경기 수원',
  'busan': '부산', 'daegu': '대구', 'incheon': '인천', 'daejeon': '대전', 'gwangju': '광주',
};

const SITE = '위마로그';
const SITE_URL = 'https://wimalog.kr';

function metaFor(pathname) {
  if (pathname.startsWith('/drug/')) {
    const id = pathname.slice('/drug/'.length).split('/')[0];
    const d = DRUG_META[id];
    if (!d) return null;
    return {
      title: `${d.label} 효과·부작용·가격 (실제 사용자 데이터) — ${SITE}`,
      description: `${d.label}(${d.en}) 평균 ${d.headlineKg} 감량. 한국 사용자 익명 코호트의 부작용 발생률·지역별 약값·중단 후 회복 데이터를 확인하세요.`,
    };
  }
  if (pathname.startsWith('/effect/')) {
    const id = pathname.slice('/effect/'.length).split('/')[0];
    const s = EFFECT_META[id];
    if (!s) return null;
    return {
      title: `${s.label} — 발생률·시점·자가 관리 — ${SITE}`,
      description: `${s.label}: ${s.summary} 약별 발생률과 의사 상담 기준을 확인하세요.`,
    };
  }
  if (pathname.startsWith('/guide/')) {
    const id = pathname.slice('/guide/'.length).split('/')[0];
    const GUIDE_META = {
      'before-use': { title: '위고비·마운자로 시작 전 — 적응증·예산·준비', desc: 'BMI·동반질환·예산·생활 패턴을 점검하고 의사와 상의할 준비를 합니다.' },
      'first-month': { title: '위고비 첫 한 달 가이드 — 주차별 시작·적응·증량', desc: '주차별 시작·적응·증량·부작용 대처 — 한국 GLP-1 사용자 실제 패턴 반영.' },
      'after-stop': { title: '위고비 중단 후 요요 방지 전략', desc: '평균 6개월에 감량분의 30-50% 회복. 운동 지속 그룹은 회복률 절반.' },
      'usage-patterns': { title: '한국 GLP-1 실사용 패턴 — 격주·간헐·저용량', desc: '매주 풀 dose가 부담일 때 한국에서 흔히 쓰이는 격주·간헐·저용량 패턴.' },
      'fatty-liver': { title: '지방간 + GLP-1 — 간수치·내장지방 개선', desc: '지방간 동반 비만에서 GLP-1이 간수치·내장지방에 미치는 효과 가이드.' },
      'sarcopenia': { title: '마른 비만·근감소 + GLP-1 — 근손실 방지', desc: 'BMI 정상이어도 근손실 우려 시 단백질·근력운동 동반 전략.' },
      'alcohol': { title: 'GLP-1과 음주·알코올 사용장애', desc: 'GLP-1이 알코올 갈망도 줄이는 효과 (2025 임상). 비만 + 음주 동반 시 전략.' },
      'long-term-use': { title: '위고비·마운자로 장기 사용 — 1년 이후', desc: '6개월~1년 시점 결정 기준, 장기 안전성, 유지 vs 중단 선택 가이드.' },
      'when-to-stop': { title: '위고비·마운자로 언제 끊을까 — 중단 시점 결정', desc: '목표 도달, 부작용, 비용 부담 — 중단 결정의 4가지 시나리오와 단계별 전략.' },
      'maintenance-dose': { title: '위고비 유지 용량 전략 — 저용량·격주로 효과 유지', desc: '목표 도달 후 비용·부작용을 줄이며 체중 유지하는 저용량/격주 전략.' },
      'side-effect-timeline': { title: '위고비·마운자로 부작용 시점별 변화 — 언제 사라지나', desc: '주차별 부작용 발생·완화 패턴. 오심·구토·변비·설사 각각의 정점·호전 시점.' },
    };
    const meta = GUIDE_META[id];
    if (meta) return { title: `${meta.title} — ${SITE}`, description: meta.desc };
    return {
      title: `${SITE} 가이드 — 한국 GLP-1 사용자 맥락`,
      description: '한국 GLP-1(위고비·마운자로·삭센다) 사용 맥락 가이드 — 격주·지방간·근감소·중단 후 등.',
    };
  }
  if (pathname.startsWith('/calc/')) {
    const id = pathname.slice('/calc/'.length).split('/')[0];
    if (id === 'cost') return { title: `약 비용 계산기 — ${SITE}`, description: '위고비·마운자로·삭센다 평균 가격과 사용 기간으로 총 비용을 계산하세요.' };
    if (id === 'bmr')  return { title: `기초대사량(BMR) 계산기 — ${SITE}`, description: '키·체중·나이·활동량으로 BMR·TDEE·감량 목표 칼로리를 계산합니다.' };
    if (id === 'target') return { title: `목표 체중 계산기 — ${SITE}`, description: 'BMI 기준 정상 체중과 % 감량별 도달 체중을 확인하세요.' };
  }
  if (pathname.startsWith('/pharmacy/')) {
    const id = pathname.slice('/pharmacy/'.length).split('/')[0];
    const r = PHARMACY_REGION_LABELS[id];
    if (r) return {
      title: `${r} 위고비·마운자로 약국 가격 — 4주분 최근 시세 — ${SITE}`,
      description: `${r} 지역 GLP-1 비만치료제 취급 약국 목록과 약·용량별 최근 가격(4주분). 사용자 익명 제보 기반의 약국 디렉토리.`,
    };
  }
  return STATIC_META[pathname] || null;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
}

export default async function middleware(request) {
  const ua = request.headers.get('user-agent') || '';
  // 본인 호출 시 무한 루프 방지
  if (ua === 'wimalog-middleware') return;
  // 사람 브라우저는 패스 — 기존 CSR 라우터가 JS로 메타 갱신
  if (!BOT_UA.test(ua)) return;

  const url = new URL(request.url);
  const meta = metaFor(url.pathname);
  if (!meta) return;

  // 원본 index.html 가져오기 (자기 자신 우회 — wimalog-middleware UA 헤더로 미들웨어 건너뛰기)
  const origin = url.origin;
  const resp = await fetch(origin + '/', {
    headers: { 'user-agent': 'wimalog-middleware' },
  });
  if (!resp.ok) return;
  let html = await resp.text();

  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const canonical = SITE_URL + url.pathname;

  html = html
    .replace(/<title>[^<]*<\/title>/i, `<title>${t}</title>`)
    .replace(/<meta name="description" content="[^"]*"/i, `<meta name="description" content="${d}"`)
    .replace(/<meta property="og:title" content="[^"]*"/i, `<meta property="og:title" content="${t}"`)
    .replace(/<meta property="og:description" content="[^"]*"/i, `<meta property="og:description" content="${d}"`)
    .replace(/<meta property="og:url" content="[^"]*"/i, `<meta property="og:url" content="${canonical}"`)
    .replace(/<meta name="twitter:title" content="[^"]*"/i, `<meta name="twitter:title" content="${t}"`)
    .replace(/<meta name="twitter:description" content="[^"]*"/i, `<meta name="twitter:description" content="${d}"`)
    .replace(/<link rel="canonical" href="[^"]*"/i, `<link rel="canonical" href="${canonical}"`);

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=3600',
      'x-middleware': 'wimalog-seo',
    },
  });
}
