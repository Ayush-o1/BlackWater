import { NavLink } from 'react-router-dom';
import { LayoutDashboard, AlertTriangle, Server, Activity, Settings } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Sidebar() {
  const { user } = useAuthStore();

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Incidents', href: '/incidents', icon: AlertTriangle },
    { name: 'Services', href: '/services', icon: Server },
    { name: 'Status Page', href: `/status/${user?.orgId}`, icon: Activity },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];
  return (
    <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-surface">
      <div className="flex h-16 items-center px-6 border-b border-border">
        <div className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight">
          <Activity className="h-6 w-6" />
          <span>SignalOps</span>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                twMerge(
                  clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                  )
                )
              }
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
