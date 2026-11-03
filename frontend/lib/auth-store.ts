import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role_id: number;
  is_active: boolean;
  role?: {
    id: number;
    name: string;
    description?: string;
  };
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // Start empty so the first client render matches the server HTML; hydrate() fills these in after mount.
  token: null,
  user: null,

  hydrate: () => {
    try {
      const token = localStorage.getItem('vyaparone_token');
      const user = JSON.parse(localStorage.getItem('vyaparone_user') || 'null');
      set({ token, user });
    } catch {
      set({ token: null, user: null });
    }
  },

  setAuth: (token: string, user: User) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vyaparone_token', token);
      localStorage.setItem('vyaparone_user', JSON.stringify(user));
    }
    set({ token, user });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vyaparone_token');
      localStorage.removeItem('vyaparone_user');
      window.location.href = '/login';
    }
    set({ token: null, user: null });
  },
}));
