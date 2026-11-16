import { create } from "zustand";
import axios from "axios";
import api from "@/lib/axios";

interface User {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  role: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  connectionError: boolean;
  setAuth: (user: User | null, token?: string) => void;
  clearSession: () => void;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

function setTokenCookie(token: string) {
  const secure = window.location.protocol === "https:" ? "Secure;" : "";
  document.cookie = `accounts_token=${token}; path=/; max-age=${30 * 24 * 60 * 60}; ${secure} SameSite=Lax`;
}

function clearTokenCookie() {
  document.cookie =
    "accounts_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
}

let initializeInFlight: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isInitialized: false,
  connectionError: false,

  clearSession: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("accounts_token");
      clearTokenCookie();
    }
    set({
      user: null,
      isAuthenticated: false,
      isInitialized: true,
      connectionError: false,
    });
  },

  setAuth: (user, token) => {
    if (typeof window !== "undefined" && token) {
      localStorage.setItem("accounts_token", token);
      setTokenCookie(token);
    }
    const ok =
      !!user && (user.role === "accountant" || user.role === "admin");
    set({
      user,
      isAuthenticated: ok,
      isInitialized: true,
      connectionError: false,
    });
  },

  logout: async () => {
    try {
      await api.get("/accounts/auth/logout");
    } catch {
      /* still clear local session */
    } finally {
      get().clearSession();
    }
  },

  initialize: async () => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("accounts_token")
        : null;

    if (!token) {
      clearTokenCookie();
      set({
        user: null,
        isAuthenticated: false,
        isInitialized: true,
        connectionError: false,
      });
      return;
    }

    if (initializeInFlight) return initializeInFlight;
    initializeInFlight = (async () => {
      try {
        const response = await api.get("/accounts/auth/me", { timeout: 20000 });
        const me = response.data?.user;
        if (
          response.data?.success &&
          me &&
          (me.role === "accountant" || me.role === "admin")
        ) {
          set({
            user: me,
            isAuthenticated: true,
            isInitialized: true,
            connectionError: false,
          });
          return;
        }
        get().clearSession();
      } catch (err) {
        const status = axios.isAxiosError(err)
          ? err.response?.status
          : undefined;
        if (status === 401 || status === 403) {
          get().clearSession();
          return;
        }
        set({
          user: null,
          isAuthenticated: false,
          isInitialized: true,
          connectionError: true,
        });
      } finally {
        initializeInFlight = null;
      }
    })();
    return initializeInFlight;
  },
}));
