import React, { useState } from 'react';
import { useToast } from './Toast.jsx';
import { track } from '../lib/analytics.js';

// 메일 주소 노출 없이 받는 문의 폼 (Web3Forms).
// access key는 클라이언트 공개용 — 제출은 운영자 메일로 전달됨. 개인 메일 비노출 = 신뢰 원칙 부합.
const ACCESS_KEY = 'f3fe1504-7055-4bc2-a73a-a8df6e593cd9';
const TYPES = ['일반 문의', '오류 신고', '제휴·제안', '데이터·연구 협력', '기타'];

export function ContactForm() {
  const toast = useToast();
  const [type, setType] = useState(TYPES[0]);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [botcheck, setBotcheck] = useState('');   // 허니팟 (사람은 안 채움)
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (botcheck) return;                          // 봇
    if (message.trim().length < 5) { toast.error('내용을 조금만 더 적어주세요'); return; }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast.error('이메일 형식을 확인해주세요'); return; }
    setSending(true);
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: ACCESS_KEY,
          subject: `[위마로그 문의] ${type}`,
          from_name: '위마로그 방문자',
          email: email || 'no-reply@wimalog.kr',
          replyto: email || undefined,
          message: `유형: ${type}\n회신 메일: ${email || '(미입력)'}\n\n${message.trim()}`,
          botcheck: '',
        }),
      });
      const data = await res.json();
      if (data?.success) {
        setDone(true);
        setMessage('');
        try { track('contact_submit', { type }); } catch {}
      } else {
        toast.error('전송에 실패했어요. 잠시 후 다시 시도해주세요');
      }
    } catch {
      toast.error('네트워크 오류 — 잠시 후 다시 시도해주세요');
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="card text-center py-8">
        <div className="text-4xl mb-3">✅</div>
        <h3 className="font-bold text-lg text-ink-900 dark:text-slate-100">문의가 접수됐어요</h3>
        <p className="text-sm text-ink-500 dark:text-slate-400 mt-2 leading-relaxed">
          소중한 의견 감사합니다.{email ? ' 회신이 필요한 내용이면 입력하신 메일로 답드릴게요.' : ' 회신 메일을 남기지 않으셔서 답장은 어려울 수 있어요.'}
        </p>
        <button onClick={() => setDone(false)} className="btn-secondary mt-4 text-sm">또 보내기</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      {/* 허니팟 — 화면 밖, 봇만 채움 */}
      <input type="checkbox" name="botcheck" tabIndex={-1} autoComplete="off"
             checked={!!botcheck} onChange={e => setBotcheck(e.target.checked ? '1' : '')}
             className="sr-only" aria-hidden="true" />

      <div>
        <label className="label">문의 유형</label>
        <div className="flex gap-1.5 flex-wrap">
          {TYPES.map(t => (
            <button key={t} type="button" onClick={() => setType(t)}
                    className={`px-3 min-h-[40px] rounded-xl text-sm font-medium border transition
                                ${type === t
                                  ? 'bg-brand-500 text-white border-brand-500'
                                  : 'bg-white dark:bg-slate-800 text-ink-700 dark:text-slate-300 border-ink-300 dark:border-slate-700 hover:border-brand-300'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="contact-msg" className="label">내용</label>
        <textarea id="contact-msg" className="input min-h-[120px] resize-y" maxLength={2000}
                  value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="궁금한 점·오류·제안을 자유롭게 적어주세요" required />
      </div>

      <div>
        <label htmlFor="contact-email" className="label">회신 받을 이메일 <span className="font-normal text-ink-400">(선택)</span></label>
        <input id="contact-email" type="email" inputMode="email" autoComplete="email"
               className="input" value={email} onChange={e => setEmail(e.target.value)}
               placeholder="답장이 필요하면 입력해주세요" />
        <p className="helptext">남기지 않아도 보낼 수 있어요. 답장이 필요할 때만 입력하세요.</p>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-ink-400 dark:text-slate-500 leading-relaxed">
          🔒 메일 주소 노출 없이 운영자에게 안전하게 전달됩니다.
        </p>
        <button type="submit" disabled={sending || message.trim().length < 5}
                className="btn-primary !px-6">
          {sending ? '보내는 중…' : '문의 보내기'}
        </button>
      </div>
    </form>
  );
}
