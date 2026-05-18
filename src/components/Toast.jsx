import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ToastContext = createContext({ success: () => {}, info: () => {}, error: () => {} });

let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  const show = useCallback((msg, type = 'success', duration = 3000) => {
    const id = ++nextId;
    setToasts(t => [...t, { id, msg, type }]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (m, d) => show(m, 'success', d),
    info:    (m, d) => show(m, 'info', d),
    error:   (m, d) => show(m, 'error', d ?? 5000),
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
      <div className="fixed z-50 bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:max-w-sm flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
               onClick={() => dismiss(t.id)}
               className={`pointer-events-auto rounded-2xl shadow-cardHover px-4 py-3 text-sm font-medium animate-slideUp cursor-pointer
                           ${t.type === 'success' ? 'bg-brand-600 text-white' :
                             t.type === 'error'   ? 'bg-rose-500 text-white' :
                                                    'bg-ink-900 text-white'}`}>
            <div className="flex items-center gap-2">
              <span className="text-base">
                {t.type === 'success' ? '✓' : t.type === 'error' ? '⚠' : '💡'}
              </span>
              <span className="flex-1">{t.msg}</span>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
