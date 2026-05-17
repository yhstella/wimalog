import React from 'react';

// 한 컴포넌트의 throw가 전체 페이지를 죽이지 않도록 격리.
// 사용자에게 친절한 fallback + 새로고침 액션 제공.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    // 개발 중에는 콘솔에 stack 출력
    if (typeof console !== 'undefined') {
      console.error('[ErrorBoundary]', error, info?.componentStack);
    }
  }
  handleReload = () => {
    window.location.reload();
  };
  handleReset = () => {
    if (confirm('로컬 저장 데이터(체중·약·운동 기록)를 초기화합니다. 계속하시겠어요?')) {
      try { localStorage.clear(); } catch {}
      window.location.href = window.location.origin + '/';
    }
  };
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="card my-6 border-2 border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-900/15">
        <div className="flex items-start gap-3">
          <div className="text-3xl">⚠️</div>
          <div className="flex-1">
            <h2 className="font-bold text-ink-900 dark:text-slate-100">화면을 그리는 중 오류가 발생했어요</h2>
            <p className="text-sm text-ink-700 dark:text-slate-300 mt-1">
              잠시 후 새로고침을 시도해 주세요. 문제가 계속되면 로컬 데이터 초기화 후 다시 진입하시면 해결됩니다.
            </p>
            <div className="text-xs text-ink-500 dark:text-slate-500 mt-2 font-mono break-all">
              {this.state.error?.message?.slice(0, 200) || '알 수 없는 오류'}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={this.handleReload}
                      className="btn-primary !py-2 !px-3 text-sm">
                새로고침
              </button>
              <button onClick={this.handleReset}
                      className="btn-secondary !py-2 !px-3 text-sm">
                로컬 데이터 초기화
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
