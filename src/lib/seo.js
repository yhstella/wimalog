// 라우트별 SEO 메타 갱신 (title + description). OG 태그도 함께 갱신.
import { DRUG_CONTENT, SIDE_EFFECT_CONTENT, GUIDE_CONTENT } from './content.js';

const SITE_URL = 'https://wimalog.kr';

// JSON-LD 구조화 데이터 주입/제거 (라우트별)
function setJsonLd(data) {
  let el = document.getElementById('json-ld');
  if (data) {
    if (!el) {
      el = document.createElement('script');
      el.id = 'json-ld';
      el.type = 'application/ld+json';
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
  } else if (el) {
    el.remove();
  }
}

// 라우트 → canonical URL (path 기반, hash 제거)
function canonicalForRoute(route) {
  if (!route || route === 'landing') return SITE_URL + '/';
  return SITE_URL + '/' + route;
}

// BreadcrumbList 자동 생성 (drug/wegovy → 홈 > 약 정보 > 위고비 같은 구조)
function buildBreadcrumb(route) {
  const items = [{ name: '홈', url: SITE_URL + '/' }];
  if (route.startsWith('drug/')) {
    const id = route.slice(5);
    const d = DRUG_CONTENT[id];
    items.push({ name: '약별 비교', url: SITE_URL + '/compare' });
    if (d) items.push({ name: d.label, url: SITE_URL + '/' + route });
  } else if (route.startsWith('effect/')) {
    const id = route.slice(7);
    const s = SIDE_EFFECT_CONTENT[id];
    items.push({ name: '부작용 정보', url: SITE_URL + '/info' });
    if (s) items.push({ name: s.label, url: SITE_URL + '/' + route });
  } else if (route.startsWith('guide/')) {
    const id = route.slice(6);
    const g = GUIDE_CONTENT[id];
    items.push({ name: '가이드', url: SITE_URL + '/' });
    if (g) items.push({ name: g.title, url: SITE_URL + '/' + route });
  } else if (route.startsWith('calc/')) {
    items.push({ name: '계산기', url: SITE_URL + '/' });
    items.push({ name: route.slice(5), url: SITE_URL + '/' + route });
  } else if (route === 'compare') {
    items.push({ name: '약별 한눈 비교', url: SITE_URL + '/compare' });
  } else if (route === 'stats') {
    items.push({ name: '통계', url: SITE_URL + '/stats' });
  } else if (route === 'info') {
    items.push({ name: '안전 정보 + FAQ', url: SITE_URL + '/info' });
  } else {
    return null;
  }
  if (items.length < 2) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': items.map((it, i) => ({
      '@type': 'ListItem',
      'position': i + 1,
      'name': it.name,
      'item': it.url,
    })),
  };
}

// FAQ 배열 → FAQPage schema 변환
function faqsToSchema(faqs) {
  if (!faqs || !faqs.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': faqs.map(f => ({
      '@type': 'Question',
      'name': f.q,
      'acceptedAnswer': { '@type': 'Answer', 'text': f.a },
    })),
  };
}

function buildJsonLd(route) {
  if (route.startsWith('drug/')) {
    const id = route.slice(5);
    const d = DRUG_CONTENT[id];
    if (!d) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'Drug',
      'name': d.label,
      'alternateName': d.en,
      'description': `${d.label}(${d.generic})은 ${d.type}로, ${d.indication}에 사용됩니다. ${d.efficacy.headlinePct}.`,
      'manufacturer': { '@type': 'Organization', 'name': d.company },
      'mechanismOfAction': d.mechanism.join(' '),
      'dosageForm': d.frequency,
      'administrationRoute': '피하주사',
    };
  }
  if (route.startsWith('effect/')) {
    const id = route.slice(7);
    const s = SIDE_EFFECT_CONTENT[id];
    if (!s) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'MedicalSymptom',
      'name': s.label,
      'description': s.summary,
      'possibleTreatment': s.selfCare.map(t => ({ '@type': 'MedicalTherapy', 'name': t })),
    };
  }
  if (route === 'compare') {
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      'name': '비만 치료제 비교',
      'itemListElement': Object.values(DRUG_CONTENT).map((d, i) => ({
        '@type': 'ListItem', 'position': i + 1,
        'item': { '@type': 'Drug', 'name': d.label, 'alternateName': d.en },
      })),
    };
  }
  if (route.startsWith('guide/')) {
    const id = route.slice(6);
    const g = GUIDE_CONTENT[id];
    if (!g) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      'headline': g.title,
      'description': g.summary,
      'about': { '@type': 'MedicalCondition', 'name': '비만 (Obesity)' },
      'publisher': { '@type': 'Organization', 'name': '위마로그' },
    };
  }
  if (route === 'info') {
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': [
        { '@type': 'Question', 'name': '위고비/마운자로가 안전한 약인가요?',
          'acceptedAnswer': { '@type': 'Answer', 'text': 'FDA·식약처 승인된 약입니다. GLP-1 호르몬 작용을 모방하는 비교적 새로운 약으로, 임상시험에서 효과와 안전성이 검증됐습니다.' } },
        { '@type': 'Question', 'name': '평생 맞아야 하나요?',
          'acceptedAnswer': { '@type': 'Answer', 'text': '중단 후 평균 6개월에 감량분의 30-50%가 회복됩니다. 일부 환자는 저용량 유지, 일부는 식이·운동으로 유지 시도.' } },
        { '@type': 'Question', 'name': 'BMI 27인데 처방받을 수 있나요?',
          'acceptedAnswer': { '@type': 'Answer', 'text': '한국 기준: BMI ≥ 30 또는 BMI ≥ 27이면서 동반질환(당뇨·고혈압·지방간·이상지질혈증 등).' } },
      ],
    };
  }
  if (route === 'landing') {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      'name': '위마로그',
      'alternateName': 'wimalog',
      'description': '위고비·마운자로 사용자 리얼데이터 플랫폼',
      'url': 'https://wimalog.kr',
    };
  }
  return null;
}

const SITE = '위마로그';
const SUB = '위고비·마운자로 리얼데이터';
const FALLBACK_DESC = '위고비·마운자로·삭센다 사용자의 실제 체중 감량, 부작용, 가격 데이터를 익명으로 비교·기록하는 플랫폼';

function ensureMeta(name, content, attr = 'name') {
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href) {
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = href;
}

// 라우트별 FAQ schema 자동 (drug/effect 페이지)
function buildFaqSchema(route) {
  if (route.startsWith('drug/')) {
    const d = DRUG_CONTENT[route.slice(5)];
    return d?.faqs ? faqsToSchema(d.faqs) : null;
  }
  if (route.startsWith('effect/')) {
    const s = SIDE_EFFECT_CONTENT[route.slice(7)];
    return s?.faqs ? faqsToSchema(s.faqs) : null;
  }
  return null;
}

// 라우트별 JSON-LD + BreadcrumbList + FAQPage 결합
function setRouteJsonLd(route) {
  const items = [buildJsonLd(route), buildBreadcrumb(route), buildFaqSchema(route)]
    .filter(Boolean);
  if (!items.length) { setJsonLd(null); return; }
  if (items.length === 1) { setJsonLd(items[0]); return; }
  setJsonLd({ '@context': 'https://schema.org', '@graph': items });
}

export function setSEO({ title, description, ogTitle, ogDescription, canonical, route }) {
  const fullTitle = title ? `${title} — ${SITE}` : `${SITE} · ${SUB}`;
  const desc = description || FALLBACK_DESC;
  const url = canonical || canonicalForRoute(route);
  document.title = fullTitle;
  ensureMeta('description', desc);
  ensureMeta('og:title', ogTitle || fullTitle, 'property');
  ensureMeta('og:description', ogDescription || desc, 'property');
  ensureMeta('og:type', 'website', 'property');
  ensureMeta('og:site_name', SITE, 'property');
  ensureMeta('og:url', url, 'property');
  ensureMeta('og:image', SITE_URL + '/og.svg', 'property');
  ensureMeta('og:locale', 'ko_KR', 'property');
  ensureMeta('twitter:card', 'summary_large_image');
  ensureMeta('twitter:title', ogTitle || fullTitle);
  ensureMeta('twitter:description', ogDescription || desc);
  ensureMeta('twitter:image', SITE_URL + '/og.svg');
  setCanonical(url);
  if (route) setRouteJsonLd(route);
}

export function seoFor(route) {
  // route 형태: 'landing', 'dashboard', 'drug/wegovy', 'effect/nausea', 'guide/before-use', 'calc/cost', etc.
  if (route.startsWith('drug/')) {
    const id = route.slice(5);
    const d = DRUG_CONTENT[id];
    if (!d) return null;
    return {
      title: `${d.label} 효과·부작용·가격 (실제 사용자 데이터)`,
      description: `${d.label}(${d.en}) 평균 ${d.efficacy.headlineKg} 감량. 부작용 발생률, 한국 약값, 실제 사용자 데이터를 비교하세요.`,
    };
  }
  if (route.startsWith('effect/')) {
    const id = route.slice(7);
    const s = SIDE_EFFECT_CONTENT[id];
    if (!s) return null;
    return {
      title: `${s.label} — 발생률·시점·자가 관리`,
      description: `${s.label}: ${s.summary} 약별 발생률과 의사 상담 기준을 확인하세요.`,
    };
  }
  if (route.startsWith('guide/')) {
    const id = route.slice(6);
    const g = GUIDE_CONTENT[id];
    if (!g) return null;
    return { title: g.title, description: g.summary };
  }
  if (route.startsWith('calc/')) {
    const id = route.slice(5);
    if (id === 'cost') return { title: '약 비용 계산기', description: '위고비·마운자로·삭센다 평균 가격과 사용 기간으로 총 비용을 계산하세요.' };
    if (id === 'bmr') return { title: '기초대사량(BMR) 계산기', description: '키·체중·나이·활동량으로 BMR·TDEE·감량 목표 칼로리를 계산합니다.' };
    if (id === 'target') return { title: '목표 체중 계산기', description: 'BMI 기준 정상 체중과 % 감량별 도달 체중을 확인하세요.' };
  }
  const STATIC = {
    landing: { title: null, description: FALLBACK_DESC },
    onboarding: { title: '1분 가입' },
    dashboard: { title: '대시보드' },
    records: { title: '기록' },
    meds: { title: '약 관리' },
    stats: { title: '통계', description: '위고비·마운자로·삭센다 사용자 1000명의 평균 감량률, 부작용, 가격, 중단 후 회복률.' },
    compare: { title: '약별 한눈 비교', description: '위고비 vs 마운자로 vs 삭센다 vs 오젬픽 vs 젭바운드 효과·부작용·가격 한 화면 비교.' },
    about:   { title: '소개' },
    privacy: { title: '개인정보 처리방침' },
    terms:   { title: '이용약관' },
    profile: { title: '프로필' },
    info: { title: '안전 정보 + FAQ', description: 'GLP-1 비만 치료제(위고비·마운자로·삭센다)의 안전 정보, 즉시 의료기관 문의가 필요한 증상, FAQ.' },
  };
  return STATIC[route] || null;
}
