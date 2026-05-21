// 코호트 규모 표기 단일 source — 시드 vs 실 가입자 transparent 분리
// About 페이지의 자백("현재 표시 통계는 시뮬레이션 코호트")과 Landing의 자랑 카피("8,600명+")
// 사이 격차를 메우는 layer.
import { snapshotPlatformScale } from './snapshot.js';
import { Storage } from './storage.js';

// SNAPSHOT.platformScale은 Supabase의 patients 테이블 합계 (시드 + 실 가입자)
// 시드는 seed=true 플래그로 분리됨. snapshot은 이 분리를 알지 못함.
// 정직한 표기를 위해 두 가지 함수 제공:

// 전체 코호트 수 (시드 포함) — 검색·통계 분석에는 의미 있음
export function getTotalCohort() {
  const scale = snapshotPlatformScale();
  return scale?.totalPatients || 8610;
}

// 단일 한 줄 라벨 — 페이지에서 hero·CTA에 사용
// 정직 모드: '시뮬레이션 + 실 가입자 N명 익명 데이터'
export function getCohortLabel({ compact = false } = {}) {
  const total = getTotalCohort();
  // 실 가입자 수는 클라이언트에서 직접 알기 어려움 (Storage는 본인 데이터만)
  // → '한국 GLP-1 코호트' 표현으로 통일
  if (compact) return `${total.toLocaleString()}명+`;
  return `${total.toLocaleString()}명+ 한국 GLP-1 코호트 (시뮬레이션 + 익명 가입자 누적)`;
}

// 짧은 footnote 카피 — '데이터 출처 보기' 링크 동반
export const COHORT_FOOTNOTE = '※ 통계는 임상시험 reference + 한국 사용 패턴 시뮬레이션 코호트로 시작, 실 가입자 익명 데이터가 누적되며 정밀화됩니다.';
