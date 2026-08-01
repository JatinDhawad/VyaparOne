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
}

export const useAuthStore = create<AuthState>((set) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem('vyaparone_token') : null,
  user: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('vyaparone_user') || 'null') : null,

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
    }
    set({ token: null, user: null });
  },
}));
