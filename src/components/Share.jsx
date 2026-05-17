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

  const kakaoShare = () => {
    // 카카오 SDK 없이도 동작: 카카오톡 url scheme (모바일에서만 활성)
    const enc = encodeURIComponent;
    const u = `https://story.kakao.com/share?url=${enc(shareUrl)}&text=${enc(title + '\n' + text)}`;
    window.open(u, '_blank', 'noopener,width=500,height=600');
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
          <span className="text-xs font-semibold">카카오</span>
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
