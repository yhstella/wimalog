// 라우트별 SEO 메타 갱신 (title + description). OG 태그도 함께 갱신.
import { DRUG_CONTENT, SIDE_EFFECT_CONTENT, GUIDE_CONTENT } from './content.js';

// JSON-LD 구조화 데이터 주입/제거
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
  if (route === 'landing') {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      'name': '위마로그',
      'alternateName': 'wimalog',
      'description': '위고비·마운자로 사용자 리얼데이터 플랫폼',
      'url': 'https://wimalog.vercel.app',
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

export function setSEO({ title, description, ogTitle, ogDescription, canonical, route }) {
  const fullTitle = title ? `${title} — ${SITE}` : `${SITE} · ${SUB}`;
  const desc = description || FALLBACK_DESC;
  document.title = fullTitle;
  ensureMeta('description', desc);
  ensureMeta('og:title', ogTitle || fullTitle, 'property');
  ensureMeta('og:description', ogDescription || desc, 'property');
  ensureMeta('og:type', 'website', 'property');
  ensureMeta('og:site_name', SITE, 'property');
  ensureMeta('og:image', 'https://wimalog.vercel.app/og.svg', 'property');
  ensureMeta('twitter:card', 'summary_large_image');
  ensureMeta('twitter:title', ogTitle || fullTitle);
  ensureMeta('twitter:description', ogDescription || desc);
  ensureMeta('twitter:image', 'https://wimalog.vercel.app/og.svg');
  if (canonical) {
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = canonical;
  }
  // JSON-LD
  if (route) setJsonLd(buildJsonLd(route));
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
    profile: { title: '프로필' },
    info: { title: '안전 정보 + FAQ', description: 'GLP-1 비만 치료제(위고비·마운자로·삭센다)의 안전 정보, 즉시 의료기관 문의가 필요한 증상, FAQ.' },
  };
  return STATIC[route] || null;
}
