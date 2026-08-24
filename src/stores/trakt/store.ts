import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import { TraktUser } from "@/utils/traktTypes";

export type TraktStatus = "idle" | "syncing";

export interface TraktAuthStore {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  user: TraktUser | null;
  status: TraktStatus;
  error: string | null;

  setTokens(accessToken: string, refreshToken: string, expiresAt: number): void;
  setUser(user: TraktUser): void;
  setStatus(status: TraktStatus): void;
  setError(error: string | null): void;
  clear(): void;
}

export const useTraktAuthStore = create(
  persist(
    immer<TraktAuthStore>((set) => ({
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      user: null,
      status: "idle",
      error: null,

      setTokens(accessToken, refreshToken, expiresAt) {
        set((s) => {
          s.accessToken = accessToken;
          s.refreshToken = refreshToken;
          s.expiresAt = expiresAt;
        });
      },
      setUser(user) {
        set((s) => {
          s.user = user;
        });
      },
      setStatus(status) {
        set((s) => {
          s.status = status;
        });
      },
      setError(error) {
        set((s) => {
          s.error = error;
        });
      },
      clear() {
        set((s) => {
          s.accessToken = null;
          s.refreshToken = null;
          s.expiresAt = null;
          s.user = null;
          s.status = "idle";
          s.error = null;
        });
      },
    })),
    {
      name: "__MW::trakt_auth",
    },
  ),
);

export function useTraktStore() {
  const user = useTraktAuthStore((s) => s.user);
  const status = useTraktAuthStore((s) => s.status);
  const error = useTraktAuthStore((s) => s.error);
  const logout = useTraktAuthStore((s) => s.clear);
  return { user, status, logout, error };
}
