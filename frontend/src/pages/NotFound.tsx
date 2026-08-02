import { Link } from 'react-router-dom';
import { Activity, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../store/useAuthStore';

export function NotFound() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[110px]" />
      </div>

      <div className="relative text-center max-w-sm animate-fade-in">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/30 mx-auto mb-8">
          <Activity className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold text-primary tracking-wide">404</p>
        <h1 className="text-2xl font-semibold tracking-tight text-white mt-2">Page not found</h1>
        <p className="text-sm text-gray-400 mt-2">
          The page you're looking for doesn't exist, or may have been moved.
        </p>
        <Link to={isAuthenticated ? '/' : '/login'} className="inline-block mt-8">
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {isAuthenticated ? 'Back to Dashboard' : 'Back to Login'}
          </Button>
        </Link>
      </div>
    </div>
  );
}
