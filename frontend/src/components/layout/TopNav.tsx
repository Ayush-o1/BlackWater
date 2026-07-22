import { useAuthStore } from '../../store/useAuthStore';
import { LogOut, User as UserIcon, Menu } from 'lucide-react';
import { queryClient } from '../../api/queryClient';

interface TopNavProps {
  onMenuClick?: () => void;
}

export function TopNav({ onMenuClick }: TopNavProps) {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    queryClient.clear();
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-surface/50 backdrop-blur-md px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="lg:hidden rounded-lg p-2 -ml-2 text-gray-400 hover:bg-white/5 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="flex items-center lg:hidden text-primary font-bold text-xl">
          <span>BlackWater</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
            <UserIcon className="h-4 w-4" aria-hidden="true" />
          </div>
          <span className="hidden sm:inline-block">{user?.name}</span>
        </div>
        <button
          onClick={handleLogout}
          aria-label="Log out"
          title="Log out"
          className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <LogOut className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
