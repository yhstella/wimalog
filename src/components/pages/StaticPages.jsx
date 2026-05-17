import React from 'react';
import { MedicalDisclaimer } from '../SafetyBanner.jsx';
import { ShareButtons } from '../Share.jsx';

export function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <header>
        <h1 className="text-3xl font-extrabold text-ink-900 dark:text-slate-100">위마로그 소개</h1>
        <p className="text-sm text-ink-500 dark:text-slate-400 mt-2">
          GLP-1 비만 치료제(위고비·마운자로·삭센다·오젬픽·젭바운드) 사용자의
          실제 체중·부작용·가격 데이터를 익명으로 기록하고 비교하는 플랫폼입니다.
        </p>
      </header>

      <section className="card">
        <h2 className="section-title">🌱 미션</h2>
        <p className="mt-2 text-sm text-ink-700 dark:text-slate-300 leading-relaxed">
          GLP-1 약제 시장이 빠르게 성장하고 있지만, 실제 사용자들의 솔직한 경험을 모은
          한국어 데이터는 부족했습니다. 위마로그는 익명으로 모은 리얼월드 데이터로
          "나와 비슷한 사용자는 어땠나"를 답하는 것이 목표입니다.
        </p>
      </section>

      <section className="card">
        <h2 className="section-title">📊 데이터 어디서 오나요?</h2>
        <ul className="mt-2 space-y-1 text-sm text-ink-700 dark:text-slate-300 list-disc list-inside">
          <li>사용자 자가보고: 체중·약·용량·부작용·가격</li>
          <li>임상시험 reference: STEP-1, SURMOUNT-5, SCALE, SUSTAIN</li>
          <li>한국 약값 정보: 닥터나우, 지니어트, 뱅크샐러드 등 공개 시장 조사</li>
          <li>FDA / 한국 식약처 처방정보</li>
        </ul>
      </section>

      <section className="card">
        <h2 className="section-title">🔒 개인정보</h2>
        <p className="mt-2 text-sm text-ink-700 dark:text-slate-300 leading-relaxed">
          현재 MVP 단계는 모든 사용자 데이터를 본인 브라우저 localStorage에만 저장합니다.
          서버로 전송하지 않으며, 익명 통계도 본인 기기 내에서만 계산됩니다.
          백엔드 추가 시 별도 동의를 받고 익명화 처리를 더 엄격하게 적용할 예정입니다.
        </p>
      </section>

      <section className="card">
        <h2 className="section-title">⚠️ 의료 면책</h2>
        <p className="mt-2 text-sm text-ink-700 dark:text-slate-300 leading-relaxed">
          위마로그는 의학적 진단·처방·치료를 제공하지 않습니다.
          모든 약제 사용 결정은 반드시 담당 의료진과 상의해야 합니다.
          본 사이트의 통계는 사용자 자가보고 기반으로 임상시험과 다를 수 있습니다.
        </p>
      </section>

      <section className="card">
        <h2 className="section-title">📬 연락처 / 피드백</h2>
        <p className="mt-2 text-sm text-ink-700 dark:text-slate-300">
          버그 제보·기능 제안·콘텐츠 오류 등은 GitHub Issue로:
          <br />
          <a href="https://github.com/yhstella/wimalog/issues" target="_blank" rel="noopener noreferrer"
             className="text-brand-700 dark:text-brand-400 underline">
            github.com/yhstella/wimalog/issues
          </a>
        </p>
      </section>

      <ShareButtons title="위마로그 소개" text="위고비·마운자로 사용자 리얼데이터 플랫폼" />
      <MedicalDisclaimer />
    </div>
  );
}

export function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <header>
        <h1 className="text-3xl font-extrabold text-ink-900 dark:text-slate-100">개인정보 처리방침</h1>
        <p className="text-sm text-ink-500 dark:text-slate-400 mt-2">최종 갱신: 2026-05-18</p>
      </header>

      <Section title="1. 수집하는 정보">
        <ul className="list-disc list-inside space-y-1">
          <li>가입 정보: 닉네임(선택), 성별, 나이대, 키, 체중, 동반 질환</li>
          <li>건강 정보: 약 사용 이력, 용량, 투약 기록, 가격·지역, 부작용, 체중 변화, 운동·식단 기록</li>
          <li>이메일 (Premium 알림 신청 시)</li>
          <li>소셜 로그인 식별자 (Google/카카오/네이버 — 백엔드 출시 후)</li>
        </ul>
      </Section>

      <Section title="2. 이용 목적">
        <ul className="list-disc list-inside space-y-1">
          <li>개인 진척도 추적 및 본인 대시보드 제공</li>
          <li>익명화된 통계 작성 및 다른 사용자에게 노출</li>
          <li>서비스 개선 및 기능 개발</li>
          <li>Premium 출시 시 알림 발송</li>
        </ul>
      </Section>

      <Section title="3. 저장 위치">
        <p>현재 MVP 버전은 모든 데이터를 사용자의 브라우저 localStorage에만 저장합니다.
        서버에 전송되거나 백엔드 데이터베이스에 저장되지 않습니다.</p>
      </Section>

      <Section title="4. 익명화 처리">
        <p>통계 표시 시 개인을 식별할 수 있는 정보(닉네임·메모·이메일 등)는 제외하고,
        성별/나이대/약/체중 등 통계 정보만 익명 집계로 표시합니다.</p>
      </Section>

      <Section title="5. 보관 기간 및 삭제">
        <p>사용자가 직접 데이터 삭제를 요청하기 전까지 보관됩니다.
        프로필 페이지의 "계정/내 데이터 삭제" 버튼으로 즉시 영구 삭제 가능합니다.</p>
      </Section>

      <Section title="6. 제3자 제공">
        <p>현재 어떤 제3자에게도 데이터를 제공하지 않습니다.</p>
      </Section>

      <Section title="7. 권리">
        <ul className="list-disc list-inside space-y-1">
          <li>본인 데이터 조회: 프로필 페이지에서 CSV/JSON 내보내기 가능</li>
          <li>수정: 프로필 페이지에서 직접 수정</li>
          <li>삭제: 계정 삭제로 모든 데이터 영구 삭제</li>
          <li>처리 정지: 사이트 미사용으로 즉시 정지 효과</li>
        </ul>
      </Section>

      <Section title="8. 문의">
        <p>개인정보 관련 문의는 <a href="https://github.com/yhstella/wimalog/issues" target="_blank" rel="noopener noreferrer"
        className="text-brand-700 dark:text-brand-400 underline">GitHub Issues</a>로 부탁드립니다.</p>
      </Section>
    </div>
  );
}

export function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <header>
        <h1 className="text-3xl font-extrabold text-ink-900 dark:text-slate-100">이용약관</h1>
        <p className="text-sm text-ink-500 dark:text-slate-400 mt-2">최종 갱신: 2026-05-18</p>
      </header>

      <Section title="1. 서비스 개요">
        <p>위마로그는 GLP-1 비만 치료제 사용자의 자가 기록 및 익명 통계 비교를 제공하는 무료 플랫폼입니다.</p>
      </Section>

      <Section title="2. 의료 면책 (가장 중요)">
        <ul className="list-disc list-inside space-y-1">
          <li>본 서비스는 <b>의학적 진단·처방·치료를 제공하지 않습니다</b>.</li>
          <li>모든 약제 사용 결정은 반드시 담당 의료진과 상의해야 합니다.</li>
          <li>본 사이트의 통계는 사용자 자가보고 기반으로 임상시험 결과와 다를 수 있습니다.</li>
          <li>본 사이트 정보를 근거로 한 자가 처방·자가 진단으로 인한 어떠한 결과에 대해서도 책임지지 않습니다.</li>
        </ul>
      </Section>

      <Section title="3. 사용자 의무">
        <ul className="list-disc list-inside space-y-1">
          <li>정확한 정보를 입력합니다 (허위 입력은 통계 왜곡을 일으킵니다)</li>
          <li>타인의 개인정보를 입력하지 않습니다</li>
          <li>한 줄 후기·메모에 욕설·광고·허위 의료 정보를 작성하지 않습니다</li>
          <li>약물 거래·중개·광고 행위를 하지 않습니다</li>
        </ul>
      </Section>

      <Section title="4. 데이터 활용">
        <p>사용자가 입력한 데이터는 익명화된 통계의 일부로 다른 사용자에게 표시될 수 있습니다.
        본인 식별 정보(닉네임·메모·이메일)는 본인만 봅니다.</p>
      </Section>

      <Section title="5. 서비스 변경·중단">
        <p>운영자는 사전 공지 후 서비스를 변경하거나 중단할 수 있습니다.
        중단 시 데이터 내보내기를 미리 받아두실 것을 권합니다.</p>
      </Section>

      <Section title="6. 책임 한계">
        <p>본 서비스는 "있는 그대로" 제공되며, 어떠한 명시적·묵시적 보증도 하지 않습니다.
        의료 면책 (2조)을 다시 한 번 강조합니다.</p>
      </Section>

      <Section title="7. 약관 변경">
        <p>약관 변경 시 사이트에 공지하며, 계속 사용은 변경된 약관에 동의하는 것으로 간주됩니다.</p>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="card">
      <h2 className="section-title">{title}</h2>
      <div className="mt-2 text-sm text-ink-700 dark:text-slate-300 leading-relaxed space-y-2">
        {children}
      </div>
    </section>
  );
}
