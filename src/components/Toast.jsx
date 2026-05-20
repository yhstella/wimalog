import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ToastContext = createContext({ success: () => {}, info: () => {}, error: () => {} });

let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  const show = useCallback((msg, type = 'success', duration = 1600) => {
    const id = ++nextId;
    setToasts(t => [...t, { id, msg, type }]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (m, d) => show(m, 'success', d ?? 1600),
    info:    (m, d) => show(m, 'info', d ?? 1800),
    error:   (m, d) => show(m, 'error', d ?? 3500),
    dismiss,
  }), [show, dismiss]);

  // 컴포넌트 외부에서 toast 띄울 수 있게 (예: App.jsx의 OAuth bootstrap)
  useEffect(() => {
    const onToast = (e) => {
      const { kind = 'info', msg, duration } = e.detail || {};
      show(msg, kind, duration);
    };
    window.addEventListener('wimalog:toast', onToast);
    return () => window.removeEventListener('wimalog:toast', onToast);
  }, [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* 상단 작은 알림 — 시야 방해 최소화 */}
      <div className="fixed z-50 top-2 inset-x-0 flex flex-col items-center gap-1.5 pointer-events-none px-3">
        {toasts.map(t => (
          <div key={t.id}
               onClick={() => dismiss(t.id)}
               className={`pointer-events-auto rounded-full shadow-md px-3.5 py-1.5 text-[12px] font-medium animate-slideDown cursor-pointer backdrop-blur-sm max-w-[90vw] truncate
                           ${t.type === 'success' ? 'bg-brand-600/95 text-white' :
                             t.type === 'error'   ? 'bg-rose-500/95 text-white' :
                                                    'bg-ink-900/95 text-white'}`}>
            <span className="mr-1.5">
              {t.type === 'success' ? '✓' : t.type === 'error' ? '⚠' : '💡'}
            </span>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
