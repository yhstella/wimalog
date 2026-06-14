import React, { useState } from 'react';
import { useToast } from './Toast.jsx';

// 공유 버튼들: 링크 복사 + 카카오톡 + 시스템 share
export function ShareButtons({ title, text, url }) {
  const toast = useToast();
  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('링크 복사됨');
    } catch {
      toast.error('복사 실패. 주소창에서 직접 복사하세요.');
    }
  };

  const systemShare = async () => {
    if (!navigator.share) {
      copyLink();
      return;
    }
    try {
      await navigator.share({ title, text, url: shareUrl });
    } catch (e) {
      if (e.name !== 'AbortError') toast.error('공유 실패');
    }
  };

  // 카카오 SDK 미도입 상태 — 사장된 story.kakao.com 대신 OS 공유 시트로.
  // 모바일 공유 시트는 카카오톡을 최상단에 노출하므로 '톡으로 보내기'가 실제 동작.
  const kakaoShare = () => {
    if (navigator.share) {
      navigator.share({ title, text, url: shareUrl }).catch(e => {
        if (e?.name !== 'AbortError') copyLink();
      });
    } else {
      copyLink();
      toast.success('링크 복사됨 — 카톡에 붙여넣어 보내세요');
    }
  };

  return (
    <div className="card !p-4">
      <div className="text-xs font-semibold text-ink-500 dark:text-slate-400 mb-2">이 페이지 공유</div>
      <div className="grid grid-cols-3 gap-2">
        <button onClick={copyLink}
                className="flex flex-col items-center gap-1 py-3 rounded-xl bg-white dark:bg-slate-800 border border-ink-200 dark:border-slate-700 hover:border-brand-400 transition">
          <span className="text-lg">🔗</span>
          <span className="text-xs">링크 복사</span>
        </button>
        <button onClick={kakaoShare}
                className="flex flex-col items-center gap-1 py-3 rounded-xl border border-transparent transition"
                style={{ background: '#FEE500', color: '#191600' }}>
          <span className="text-lg">💬</span>
          <span className="text-xs font-semibold">카톡으로</span>
        </button>
        <button onClick={systemShare}
                className="flex flex-col items-center gap-1 py-3 rounded-xl bg-white dark:bg-slate-800 border border-ink-200 dark:border-slate-700 hover:border-brand-400 transition">
          <span className="text-lg">📤</span>
          <span className="text-xs">기타</span>
        </button>
      </div>
    </div>
  );
}
