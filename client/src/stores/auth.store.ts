import { create } from 'zustand';
import { User } from '../types/index.ts';
import { ApiService, setAccessToken } from '../services/api.ts';
import { signInWithGoogleFirebase, signOutFirebase } from '../services/firebase.ts';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signInWithFirebase: () => Promise<void>;
  loginWithToken: (idToken: string) => Promise<void>;
  checkSession: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  signInWithFirebase: async () => {
    try {
      set({ isLoading: true });
      const idToken = await signInWithGoogleFirebase();
      const res = await ApiService.firebaseAuth(idToken);
      setAccessToken(res.data.accessToken);
      set({
        user: res.data.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  loginWithToken: async (idToken: string) => {
    try {
      set({ isLoading: true });
      const res = await ApiService.firebaseAuth(idToken);
      setAccessToken(res.data.accessToken);
      set({
        user: res.data.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  checkSession: async () => {
    try {
      set({ isLoading: true });
      const res = await ApiService.refreshToken();
      setAccessToken(res.data.accessToken);
      set({
        user: res.data.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      setAccessToken(null);
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  logout: async () => {
    try {
      await signOutFirebase().catch(() => {});
      await ApiService.logout();
    } finally {
      setAccessToken(null);
      set({
        user: null,
        isAuthenticated: false,
      });
    }
  },
}));
