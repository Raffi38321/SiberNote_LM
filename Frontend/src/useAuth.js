import { useCallback, useEffect, useState } from "react";
import {
  loginUser,
  registerUser,
  refreshAccessToken,
  logoutUser,
  getCurrentUser,
  saveRefreshToken,
  getRefreshToken,
  clearRefreshToken,
} from "./api";

/**
 * Mengelola sesi login: accessToken hanya disimpan di memori (state React),
 * refreshToken disimpan di localStorage. Saat halaman dimuat ulang, hook ini
 * otomatis mencoba menukar refreshToken yang tersimpan menjadi accessToken baru.
 */
export function useAuth() {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const loadProfile = useCallback(async (token) => {
    const data = await getCurrentUser(token);
    setUser(data?.user || null);
  }, []);

  useEffect(() => {
    const savedRefreshToken = getRefreshToken();
    if (!savedRefreshToken) {
      setInitializing(false);
      return;
    }
    (async () => {
      try {
        const data = await refreshAccessToken(savedRefreshToken);
        setAccessToken(data.accessToken);
        await loadProfile(data.accessToken);
      } catch {
        // refreshToken sudah tidak valid/expired -> anggap logged out.
        clearRefreshToken();
      } finally {
        setInitializing(false);
      }
    })();
  }, [loadProfile]);

  async function login({ email, password }) {
    const data = await loginUser({ email, password });
    saveRefreshToken(data.refreshToken);
    setAccessToken(data.accessToken);
    await loadProfile(data.accessToken);
  }

  async function register({ email, username, password }) {
    const data = await registerUser({ email, username, password });
    saveRefreshToken(data.refreshToken);
    setAccessToken(data.accessToken);
    await loadProfile(data.accessToken);
  }

  async function logout() {
    const savedRefreshToken = getRefreshToken();
    try {
      if (savedRefreshToken) await logoutUser(savedRefreshToken);
    } catch {
      // Tetap hapus sesi lokal meski request logout ke server gagal.
    }
    clearRefreshToken();
    setAccessToken(null);
    setUser(null);
  }

  return { accessToken, user, initializing, login, register, logout };
}