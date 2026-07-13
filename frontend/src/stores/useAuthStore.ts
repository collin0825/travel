import { create } from 'zustand';
import { authApi, clearToken, getToken, setToken } from '@/api';
import type { LoginPayload, RegisterPayload, User } from '@/types';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: User | null;
  status: AuthStatus;
  /** Restores the session from a stored token on app start. */
  loadUser: () => Promise<void>;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  /** Clears in-memory auth state (used by the 401 handler). */
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',

  loadUser: async () => {
    if (!getToken()) {
      set({ user: null, status: 'unauthenticated' });
      return;
    }
    set({ status: 'loading' });
    try {
      const user = await authApi.getMe();
      set({ user, status: 'authenticated' });
    } catch (err) {
      console.error('Session expired or invalid:', err);
      clearToken();
      set({ user: null, status: 'unauthenticated' });
    }
  },

  login: async (payload) => {
    const token = await authApi.login(payload);
    setToken(token.access_token);
    const user = await authApi.getMe();
    set({ user, status: 'authenticated' });
  },

  register: async (payload) => {
    await authApi.register(payload);
    // Auto login immediately after successful registration.
    const token = await authApi.login({ ...payload });
    setToken(token.access_token);
    const user = await authApi.getMe();
    set({ user, status: 'authenticated' });
  },

  logout: () => {
    clearToken();
    set({ user: null, status: 'unauthenticated' });
  },

  reset: () => set({ user: null, status: 'unauthenticated' }),
}));
