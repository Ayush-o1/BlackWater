import { Outlet, Link, useNavigate } from 'react-router-dom';
import { Activity, ArrowLeft, LayoutDashboard, LogIn } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useSocketSubscriptions } from '../../hooks/useSocketSubscriptions';

export function PublicStatusLayout() {
  useSocketSubscriptions();

  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          
          {/* Brand */}
          <Link
            to={isAuthenticated ? '/' : '/login'}
            className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight hover:opacity-80 transition-opacity"
          >
            <Activity className="h-6 w-6" />
            <span>BlackWater Status</span>
          </Link>

          {/* Right-side navigation */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                {/* Authenticated: show admin navigation */}
                <span className="hidden sm:block text-xs text-gray-500 border border-border rounded-full px-3 py-1">
                  Signed in as <span className="text-gray-300 font-medium">{user?.name}</span>
                </span>
                <button
                  onClick={() => navigate('/')}
                  className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 border border-border rounded-lg px-3 py-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Dashboard</span>
                </button>
                <Link
                  to="/incidents"
                  className="hidden sm:inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 border border-border rounded-lg px-3 py-1.5"
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  <span>Admin Panel</span>
                </Link>
              </>
            ) : (
              /* Unauthenticated: show login */
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 border border-border rounded-lg px-3 py-1.5"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Admin Login</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-border mt-auto">
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-gray-500">
          <span>Powered by BlackWater</span>
          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              <Link to="/" className="hover:text-gray-300 transition-colors">Dashboard</Link>
              <Link to="/incidents" className="hover:text-gray-300 transition-colors">Incidents</Link>
              <Link to="/services" className="hover:text-gray-300 transition-colors">Services</Link>
              <Link to="/settings" className="hover:text-gray-300 transition-colors">Settings</Link>
            </div>
          ) : (
            <Link to="/login" className="hover:text-gray-300 transition-colors">Admin Login →</Link>
          )}
        </div>
      </footer>
    </div>
  );
}
