// 다크모드 관리. 'light' | 'dark' | 'system'
const KEY = 'gl_theme';

export function getTheme() {
  return localStorage.getItem(KEY) || 'system';
}

export function setTheme(t) {
  if (t === 'system') localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, t);
  applyTheme();
}

export function applyTheme() {
  const stored = localStorage.getItem(KEY);
  const wantsDark = stored === 'dark'
    || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', wantsDark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content', wantsDark ? '#0B1220' : '#2E9A58'
  );
}

export function watchSystemTheme() {
  if (!window.matchMedia) return;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (!localStorage.getItem(KEY)) applyTheme();
  };
  mq.addEventListener?.('change', onChange);
  return () => mq.removeEventListener?.('change', onChange);
}
