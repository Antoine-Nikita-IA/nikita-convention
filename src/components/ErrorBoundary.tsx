import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/Button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      // Auto-reload on chunk load errors (deploy updates)
      if (this.state.error?.message?.includes('ChunkLoadError') || this.state.error?.message?.includes('Failed to fetch dynamically imported module')) {
        window.location.reload();
        return null;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-nikita-gray px-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} className="text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">Une erreur est survenue</h1>
            <p className="text-sm text-gray-500 mb-4">
              L'application a rencontré un problème inattendu. Essayez de recharger la page.
            </p>
            <p className="text-xs text-gray-400 font-mono mb-6 bg-gray-100 p-2 rounded break-all">
              {this.state.error?.message}
            </p>
            <Button onClick={() => window.location.reload()} icon={<RefreshCw size={16} />}>
              Recharger la page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
