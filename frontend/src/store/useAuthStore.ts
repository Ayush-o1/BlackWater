import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  orgId: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string, remember?: boolean) => void;
  logout: () => void;
}

type PersistedAuth = Pick<AuthState, 'user' | 'token' | 'isAuthenticated'>;

const REMEMBER_KEY = 'blackwater-remember-me';

// "Remember me" only decides *where* the session lives, not how auth itself
// works: checked persists to localStorage (survives closing the browser),
// unchecked writes to sessionStorage (cleared when the tab closes). The
// choice is read fresh on every write, since it's made once at login time
// but needs to apply to every subsequent state change for that session.
const dynamicStorage: PersistStorage<PersistedAuth> = {
  getItem: (name) => {
    const raw = localStorage.getItem(name) ?? sessionStorage.getItem(name);
    return raw ? JSON.parse(raw) : null;
  },
  setItem: (name, value) => {
    const remember = localStorage.getItem(REMEMBER_KEY) !== 'false';
    const serialized = JSON.stringify(value);
    if (remember) {
      localStorage.setItem(name, serialized);
      sessionStorage.removeItem(name);
    } else {
      sessionStorage.setItem(name, serialized);
      localStorage.removeItem(name);
    }
  },
  removeItem: (name) => {
    localStorage.removeItem(name);
    sessionStorage.removeItem(name);
    localStorage.removeItem(REMEMBER_KEY);
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token, remember = true) => {
        localStorage.setItem(REMEMBER_KEY, String(remember));
        set({ user, token, isAuthenticated: true });
      },
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'blackwater-auth-storage', // name of the item in the storage (must be unique)
      storage: dynamicStorage,
    }
  )
);
