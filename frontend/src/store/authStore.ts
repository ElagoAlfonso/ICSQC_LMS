import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { authApi } from '../utils/api';

const normalizeUser = (user: Partial<User> | null | undefined) => {
  if (!user) return null;
  return {
    ...user,
    teacherSubject: user.teacherSubject ?? (user as any).teacherSubjects ?? [],
  } as User;
};

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      isAuthenticated: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const res = await authApi.login(email, password);
          const userData = normalizeUser(res.data);
          set({ user: userData, isAuthenticated: true, isLoading: false });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      logout: async () => {
        try {
          await authApi.logout();
        } catch {}
        set({ user: null, isAuthenticated: false });
      },

      fetchProfile: async () => {
        try {
          const res = await authApi.getProfile();
          const userData = normalizeUser(res.data.user ?? res.data);
          set({ user: userData, isAuthenticated: true });
        } catch {
          set({ user: null, isAuthenticated: false });
        }
      },

      setUser: (user) => set({ user: normalizeUser(user), isAuthenticated: !!user }),
    }),
    {
      name: 'icsqc-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
