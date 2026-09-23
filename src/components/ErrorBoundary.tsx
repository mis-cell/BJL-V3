import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#dfdfdf] flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-400 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] max-w-lg w-full">
            <div className="bg-red-800 text-white px-3 py-2 flex items-center gap-2 border-b-2 border-red-900">
              <AlertTriangle className="h-5 w-5" />
              <h1 className="text-sm font-bold uppercase tracking-wider">Fatal System Error</h1>
            </div>
            
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="bg-red-100 p-3 rounded-full flex-shrink-0">
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 mb-2">Module execution halted</h2>
                  <p className="text-sm text-slate-600 mb-4">
                    The application encountered an unexpected error and has suspended this component to prevent data corruption.
                  </p>
                  
                  <div className="bg-slate-100 p-3 border border-slate-300 rounded text-xs font-mono text-slate-800 mb-6 overflow-auto max-h-32 shadow-inner">
                    {typeof this.state.error?.message === 'string'
                      ? this.state.error.message
                      : typeof this.state.error === 'object'
                        ? JSON.stringify(this.state.error)
                        : String(this.state.error || 'Unknown error occurred')}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem("bjl_audit_logs");
                    localStorage.removeItem("bjl_alerts");
                    window.location.reload();
                  }}
                  className="flex items-center gap-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-2 font-bold text-xs uppercase transition-colors"
                >
                  Reset Local State & Reload
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 font-bold text-xs uppercase transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  Restart Terminal
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
