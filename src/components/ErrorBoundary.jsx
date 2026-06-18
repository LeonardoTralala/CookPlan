import { Component } from 'react';

// Error Boundary global: menangkap render error di mana pun agar tidak terjadi
// blank-screen (audit production-readiness). Harus class component — React belum
// punya padanan hooks untuk getDerivedStateFromError/componentDidCatch.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Titik kait untuk error tracking (mis. Sentry) di masa depan.
    console.error('ErrorBoundary menangkap error:', error, info?.componentStack);
  }

  handleReload = () => {
    window.location.assign('/');
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-canvas-white text-on-surface px-6 text-center">
        <span className="material-symbols-outlined text-error text-[44px]" aria-hidden="true">
          sentiment_dissatisfied
        </span>
        <div className="space-y-1">
          <h1 className="text-xl font-bold">Ups, terjadi kesalahan</h1>
          <p className="text-sm text-on-surface-variant max-w-xs">
            Maaf, ada yang tidak beres. Coba muat ulang halaman — datamu aman tersimpan.
          </p>
        </div>
        <button
          onClick={this.handleReload}
          className="min-h-11 px-6 rounded-full text-sm font-semibold text-on-primary bg-primary hover:opacity-90 transition-opacity cursor-pointer"
        >
          Muat ulang
        </button>
      </div>
    );
  }
}
