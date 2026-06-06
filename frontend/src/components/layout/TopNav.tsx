import { useAuthStore } from '../../store/useAuthStore';
import { LogOut, User as UserIcon } from 'lucide-react';

export function TopNav() {
  const { user, logout } = useAuthStore();

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-surface/50 backdrop-blur-md px-6">
      <div className="flex items-center lg:hidden text-primary font-bold text-xl">
        <span>SignalOps</span>
      </div>
      <div className="hidden lg:flex flex-1" />
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
            <UserIcon className="h-4 w-4" />
          </div>
          <span className="hidden sm:inline-block">{user?.name}</span>
        </div>
        <button
          onClick={logout}
          className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
          title="Logout"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
