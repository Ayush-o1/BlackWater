import { Outlet } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { useSocketSubscriptions } from '../../hooks/useSocketSubscriptions';

export function PublicStatusLayout() {
  // Binds the socket listener to the public routes as well!
  useSocketSubscriptions();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-surface/50 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight">
            <Activity className="h-6 w-6" />
            <span>SignalOps Status</span>
          </div>
          <a href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
            Admin Login
          </a>
        </div>
      </header>
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
        <Outlet />
      </main>
      <footer className="py-6 border-t border-border mt-auto">
        <div className="max-w-4xl mx-auto px-6 text-center text-sm text-gray-500">
          Powered by SignalOps
        </div>
      </footer>
    </div>
  );
}
