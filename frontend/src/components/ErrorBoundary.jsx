import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("SMBC SIMS crashed:", error, info);
  }

  handleReset = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
          <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg p-8 max-w-sm text-center">
            <p className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Something went wrong</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Resetting local data and returning to login usually fixes it.
            </p>
            <button onClick={this.handleReset} className="bg-slate-900 text-white rounded px-4 py-2 text-sm">
              Reset and return to Login
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
