import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import { useSocketSubscriptions } from '../../hooks/useSocketSubscriptions';

export function AppLayout() {
  useSocketSubscriptions();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <Sidebar isMobileOpen={isMobileNavOpen} onMobileClose={() => setIsMobileNavOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0">
        <TopNav onMenuClick={() => setIsMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">
            {/* Keying on the route restarts the fade on every navigation —
                a brief, consistent settle-in instead of content just
                popping into place. */}
            <div key={location.pathname} className="animate-fade-in">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
