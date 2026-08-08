import { Component } from 'react';

// Error Boundary global: menangkap render error di mana pun agar tidak terjadi
// blank-screen (audit production-readiness). Harus class component — React belum
// punya padanan hooks untuk getDerivedStateFromError/componentDidCatch.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Titik kait untuk error tracking di masa depan.
    console.error('ErrorBoundary menangkap error:', error, info?.componentStack);
  }

  handleReload = () => {
    window.location.assign('/');
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-canvas-white text-on-surface px-6 text-center">
        <span className="material-symbols-outlined text-error text-[44px]" aria-hidden="true">
          sentiment_dissatisfied
        </span>
        <div className="space-y-2 max-w-md">
          <h1 className="text-xl font-bold">Ups, terjadi kesalahan</h1>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Maaf, ada yang tidak beres. Coba muat ulang halaman — datamu aman tersimpan.
          </p>
          {this.state.error?.message && (
            <div className="mt-3 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 text-left font-mono break-words shadow-sm">
              <strong className="block mb-1 text-rose-800">Detail Error:</strong>
              {this.state.error.message}
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <button
            onClick={this.handleReset}
            className="min-h-11 px-5 rounded-full text-sm font-semibold text-primary border border-primary/40 hover:bg-primary/5 active:scale-95 transition cursor-pointer"
          >
            Coba Lagi
          </button>
          <button
            onClick={this.handleReload}
            className="min-h-11 px-6 rounded-full text-sm font-semibold text-on-primary bg-primary hover:opacity-90 active:scale-95 transition cursor-pointer"
          >
            Muat ulang
          </button>
        </div>
      </div>
    );
  }
}

