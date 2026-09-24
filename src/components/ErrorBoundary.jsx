import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught render exception:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 text-center m-4">
          <p className="text-sm font-semibold text-amber-400 mb-1">Notice</p>
          <p className="text-xs text-slate-400">Something encountered a display issue, but the rest of the application is working normally.</p>
          <button 
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-3 px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs hover:bg-amber-300 transition-colors"
          >
            Dismiss
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
