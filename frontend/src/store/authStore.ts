'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserProfile } from '@/lib/api';

interface AuthState {
  user:         UserProfile | null;
  deviceId:     string;
  setAuth:      (user: UserProfile, accessToken: string, refreshToken: string) => void;
  updateUser:   (patch: Partial<UserProfile>) => void;
  logout:       () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:     null,
      deviceId: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),

      setAuth: (user, accessToken, refreshToken) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken',  accessToken);
          localStorage.setItem('refreshToken', refreshToken);
        }
        set({ user });
      },

      updateUser: (patch) =>
        set((s) => ({ user: s.user ? { ...s.user, ...patch } : null })),

      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
        set({ user: null });
      },
    }),
    {
      name:        'cloudbox-auth',
      partialize:  (s) => ({ user: s.user, deviceId: s.deviceId }),
    }
  )
);
