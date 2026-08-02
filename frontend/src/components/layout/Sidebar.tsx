import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, AlertTriangle, Server, Activity, Settings, X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, end: true },
  { name: 'Incidents', href: '/incidents', icon: AlertTriangle, end: false },
  { name: 'Services', href: '/services', icon: Server, end: false },
  { name: 'Status Page', href: '/admin/status', icon: Activity, end: false },
  { name: 'Settings', href: '/settings', icon: Settings, end: false },
];

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-1 p-4">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              twMerge(
                clsx(
                  'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                )
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    className="absolute -left-1 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                )}
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {item.name}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight">
      <Activity className="h-6 w-6" aria-hidden="true" />
      <span>BlackWater</span>
    </div>
  );
}

export function Sidebar({ isMobileOpen = false, onMobileClose }: SidebarProps) {
  const location = useLocation();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    onMobileClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Close on Escape while the mobile drawer is open.
  useEffect(() => {
    if (!isMobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onMobileClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, onMobileClose]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-surface shrink-0">
        <div className="flex h-16 items-center px-6 border-b border-border">
          <Brand />
        </div>
        <NavList />
      </aside>

      {/* Mobile drawer */}
      <div
        className={twMerge(
          'fixed inset-0 z-50 lg:hidden transition-opacity duration-200',
          isMobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        )}
        aria-hidden={!isMobileOpen}
      >
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onMobileClose} />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className={twMerge(
            'fixed inset-y-0 left-0 flex w-72 flex-col border-r border-border bg-surface transition-transform duration-200 ease-out',
            isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex h-16 items-center justify-between px-6 border-b border-border">
            <Brand />
            <button
              onClick={onMobileClose}
              aria-label="Close navigation"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <NavList onNavigate={onMobileClose} />
        </aside>
      </div>
    </>
  );
}
