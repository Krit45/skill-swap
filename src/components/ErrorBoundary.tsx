import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong. Please try again later.";
      let firestoreError = null;

      try {
        // Try to parse Firestore error JSON
        if (this.state.error?.message) {
          firestoreError = JSON.parse(this.state.error.message);
          if (firestoreError.error) {
            errorMessage = firestoreError.error;
          }
        }
      } catch (e) {
        // Not a JSON error, use raw message
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl p-10 text-center space-y-8 border-2 border-neutral-100">
            <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto">
              <AlertCircle className="text-red-500" size={40} />
            </div>
            
            <div className="space-y-4">
              <h1 className="text-3xl font-black italic uppercase tracking-tighter text-neutral-900">
                Oops! Something Broke
              </h1>
              <div className="bg-neutral-50 rounded-2xl p-6 text-left">
                <p className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-2">Error Details</p>
                <p className="text-sm font-bold text-neutral-600 font-mono break-words">
                  {errorMessage}
                </p>
                {firestoreError && (
                  <div className="mt-4 pt-4 border-t border-neutral-200">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Operation</p>
                    <p className="text-xs font-bold text-neutral-900 uppercase tracking-tight">
                      {firestoreError.operationType} on {firestoreError.path}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-neutral-900 text-white py-5 rounded-3xl font-black text-sm tracking-widest uppercase hover:bg-neutral-800 transition-all flex items-center justify-center space-x-3 shadow-xl shadow-neutral-900/20"
              >
                <RefreshCcw size={20} />
                <span>Reload App</span>
              </button>
              
              <button
                onClick={this.handleReset}
                className="w-full bg-neutral-100 text-neutral-900 py-5 rounded-3xl font-black text-sm tracking-widest uppercase hover:bg-neutral-200 transition-all flex items-center justify-center space-x-3"
              >
                <Home size={20} />
                <span>Go to Home</span>
              </button>
            </div>

            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em]">
              SkillSwap Support • Error ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
