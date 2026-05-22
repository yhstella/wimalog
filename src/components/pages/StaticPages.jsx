import React from 'react';
import { MedicalDisclaimer } from '../SafetyBanner.jsx';
import { ShareButtons } from '../Share.jsx';

export function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <header>
        <h1 className="text-3xl font-extrabold text-ink-900 dark:text-slate-100">위마로그 소개</h1>
        <p className="text-base text-ink-700 dark:text-slate-300 mt-3 leading-relaxed">
          위마로그는 위고비·마운자로 사용자를 위한 단순 기록 앱이 아니라,
          <b className="text-brand-700 dark:text-brand-400"> 위고비·마운자로 한국 사용자들의 실제 체중 변화와 부작용을 익명으로 비교하는 리얼데이터 플랫폼</b>입니다.
        </p>
      </header>

      {/* 운영주체 — 의료진 중심 개발 (신뢰 시그널) */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border-2 border-brand-200 dark:border-brand-800/40 p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="text-2xl">🩺</div>
          <div>
            <h2 className="text-lg font-bold text-ink-900 dark:text-slate-100">의료진이 만든 GLP-1 플랫폼</h2>
            <p className="text-sm text-ink-500 dark:text-slate-400 mt-0.5">
              한국 GLP-1 사용자의 실사용 맥락을 직접 진료해온 의료진이 설계·운영합니다.
            </p>
          </div>
        </div>
        <ul className="space-y-2 text-sm text-ink-700 dark:text-slate-300 leading-relaxed">
          <li className="flex gap-2">
            <span className="text-brand-500 flex-shrink-0 mt-0.5">●</span>
            <span><b>대학병원 진료 경력의 내과 의료진</b>이 컨텐츠·안전 가이드를 설계 — 부작용 경고 기준, red-flag 증상, 의료 상담 임계점 모두 임상 가이드라인 기반</span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand-500 flex-shrink-0 mt-0.5">●</span>
            <span><b>데이터·헬스케어 엔지니어링 팀</b>이 익명 코호트 분석·시각화·인프라 구축 — STEP-1·SURMOUNT-1 등 핵심 임상 reference를 한국 사용 맥락에 맞춰 보정</span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand-500 flex-shrink-0 mt-0.5">●</span>
            <span><b>익명·민감정보 보호 원칙</b>으로 시작 — 개인정보보호법상 민감정보 처리에 부합. 약 추천·진단·처방 기능은 의도적으로 제외</span>
          </li>
        </ul>
      </section>

      {/* 차별화 요약 — 한국 사용자가 기대하는 가치 */}
      <section className="rounded-2xl bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/20 dark:to-slate-900 border-2 border-brand-200 dark:border-brand-800/40 p-5">
        <h2 className="text-lg font-bold text-ink-900 dark:text-slate-100 mb-3">위마로그가 다른 점</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Bullet emoji="🇰🇷" title="한국어 + 국내 처방 현실">
            국내 약제명·용량·가격·병원 주기·식사 패턴을 반영. 해외 앱(Glapp, Shotsy 등)은 한국 사용자 맥락이 부족합니다.
          </Bullet>
          <Bullet emoji="📊" title="앱이 아닌 리얼데이터 플랫폼">
            개인 dose tracker가 아니라 "나와 비슷한 사람은 실제 얼마나 빠졌나"를 답하는 익명 코호트 비교가 중심.
          </Bullet>
          <Bullet emoji="🩺" title="의사 관점의 안전한 해석">
            부작용 경고, 의료진 상담 기준, 진료용 PDF 리포트, 자가보고 한계 명시 — 약 추천이 아닌 기록·비교·교육 원칙.
          </Bullet>
          <Bullet emoji="🔒" title="자유게시판 아닌 구조화된 데이터">
            후기·처방 문의·광고가 섞이는 커뮤니티 대신, 입력 → 익명 집계 그래프. 신뢰 가능한 통계가 목표.
          </Bullet>
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">🌱 미션</h2>
        <p className="mt-2 text-sm text-ink-700 dark:text-slate-300 leading-relaxed">
          GLP-1 약제 시장이 빠르게 성장 중이지만, 한국 사용자의 솔직한 경험을 모은 한국어 데이터는 부족합니다.
          국내 처방은 BMI 30 미만이거나 마른 비만·지방간·근감소 동반자도 많아, 임상시험(BMI≥30 + 매주 풀 dose) 결과만으로는
          현실을 설명하기 어렵습니다. 위마로그는 익명 리얼월드 데이터로 "나와 비슷한 사람은 어땠나"를 답합니다.
        </p>
      </section>

      <section className="card">
        <h2 className="section-title">📊 데이터 어디서 오나요?</h2>
        <ul className="mt-2 space-y-1 text-sm text-ink-700 dark:text-slate-300 list-disc list-inside">
          <li>사용자가 직접 입력한 익명 데이터: 체중·약·용량·빈도·부작용·가격·지역·운동·식단</li>
          <li>FDA / 한국 식약처 처방정보 (약별 기본 정보)</li>
        </ul>
      </section>

      <section className="card">
        <h2 className="section-title">🆚 다른 도구와 어떻게 다른가</h2>
        <p className="section-subtitle mt-1">한국 GLP-1 사용자가 흔히 쓰는 4가지 대안 비교</p>
        <div className="mt-3 overflow-x-auto -mx-2">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="text-left text-ink-500 dark:text-slate-400 border-b border-ink-200 dark:border-slate-700">
                <th className="py-2 px-2 font-medium sticky left-0 bg-white dark:bg-slate-900 z-10">측면</th>
                <th className="py-2 px-2 font-medium">네이버 카페·블로그</th>
                <th className="py-2 px-2 font-medium">MyFitnessPal·Noom</th>
                <th className="py-2 px-2 font-medium">해외 GLP-1 앱<br /><span className="text-[10px] font-normal">(Glapp·Shotsy)</span></th>
                <th className="py-2 px-2 font-medium bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400">위마로그</th>
              </tr>
            </thead>
            <tbody className="text-ink-700 dark:text-slate-300">
              <Row label="언어·문화"
                   cells={['한국어', '한국어(MFP) / 일부 한국어(Noom)', '영어', '한국어 + 국내 처방·회식 맥락']} ours={3} />
              <Row label="중심 가치"
                   cells={['개인 후기·질문', '식단·칼로리 트래커', '개인 dose 트래커', '실사용자 익명 코호트 비교 + AI 예측']} ours={3} />
              <Row label="GLP-1 특화"
                   cells={['일부 있음 (산만)', '없음 (일반 다이어트)', '있음 (영문)', '✓ 5개 약 깊이 + 한국 가격·격주 패턴']} ours={3} />
              <Row label="비슷한 사람 비교"
                   cells={['후기 일부 검색', '없음', '없음', '✓ BMI·약·빈도 매칭 익명 코호트']} ours={3} />
              <Row label="중단 후 회복 예측"
                   cells={['후기 단편', '없음', '없음', '✓ 본인 맞춤 곡선 + 운동 영향 시각화']} ours={3} />
              <Row label="진료용 PDF"
                   cells={['없음', '없음', '일부 (영문)', '✓ 12주 한국어 + 카톡용 텍스트 카피']} ours={3} />
              <Row label="약국 가격 비교"
                   cells={['댓글에 산만', '없음', '없음', '✓ 지역·약국별 4주분 디렉토리']} ours={3} />
              <Row label="의학적 안전 가이드"
                   cells={['검증 어려움', '일반 다이어트', '사용자 편의 중심', '✓ 의료진 설계 · 금기 자가 체크']} ours={3} />
              <Row label="광고·낚시·중복"
                   cells={['많음', '구독 광고 강함', '구독 광고', '없음 (현재 무료)']} ours={3} />
              <Row label="설치"
                   cells={['앱 또는 웹', '앱 필수', '앱 필수', '웹 — 검색 즉시 진입, PWA 설치 가능']} ours={3} />
            </tbody>
          </table>
        </div>

        {/* 위마로그가 못 하는 것 — 정직 */}
        <div className="mt-4 rounded-xl bg-ink-100/50 dark:bg-slate-800/50 p-3 text-xs leading-relaxed text-ink-700 dark:text-slate-300">
          <b>위마로그가 못 하는 것:</b>{' '}
          영양 정보 식품 DB 규모 (MFP가 강함), 헬스 코칭 사람 응답 (Noom), 일대일 멘토링 (카페 친목).
          위마로그는 <b className="text-brand-700 dark:text-brand-400">"GLP-1 결정·기록·진료 동반자"</b>로 좁게 가는 도구입니다.
          다이어트 식단 트래커는 MFP, 사람 응답은 카페, 의료 종합관리는 위마로그 — 함께 쓰는 게 효율적입니다.
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">🔒 개인정보</h2>
        <p className="mt-2 text-sm text-ink-700 dark:text-slate-300 leading-relaxed">
          개인을 식별할 수 있는 정보(닉네임·메모·구매 가격 등)는 본인 브라우저에만 저장됩니다.
          익명 통계는 익명화·집계 처리 후 안전한 서버에 저장되어 코호트 비교에 활용됩니다.
          본인 데이터는 언제든 프로필 페이지에서 영구 삭제할 수 있습니다.
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

      <ShareButtons title="위마로그 — 위고비·마운자로 한국 사용자 리얼데이터" text="위고비·마운자로 사용자 익명 비교 데이터" />
      <MedicalDisclaimer />
    </div>
  );
}

// 비교 표 행 — 우리(ours) 컬럼 강조
function Row({ label, cells, ours }) {
  return (
    <tr className="border-b border-ink-100 dark:border-slate-800">
      <td className="py-2 px-2 font-semibold sticky left-0 bg-white dark:bg-slate-900 z-10">{label}</td>
      {cells.map((c, i) => (
        <td key={i} className={`py-2 px-2 align-top text-xs leading-snug
                                ${i === ours
                                  ? 'bg-brand-50/60 dark:bg-brand-900/15 text-brand-700 dark:text-brand-400 font-semibold'
                                  : ''}`}>
          {c}
        </td>
      ))}
    </tr>
  );
}

function Bullet({ emoji, title, children }) {
  return (
    <div className="flex gap-3">
      <div className="text-2xl flex-shrink-0">{emoji}</div>
      <div>
        <div className="font-bold text-sm text-ink-900 dark:text-slate-100">{title}</div>
        <div className="text-xs text-ink-700 dark:text-slate-300 mt-1 leading-snug">{children}</div>
      </div>
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
        <p>개인 식별 정보(닉네임·메모·구매 가격 등)는 본인 브라우저에 저장됩니다.
        익명 통계 데이터(성별·나이대·약·체중 변화 등)는 익명화·집계 처리 후 안전한 서버(Supabase)에 저장되어 코호트 비교에 사용됩니다.</p>
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
