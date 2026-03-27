import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { authApi, setLogoutCallback, type User } from '../services/api';

const TOKEN_KEY = 'auth_token';

const tokenStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try { return localStorage.getItem(key); } catch { return null; }
    }
    return SecureStore.getItemAsync(key);
  },
  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    businessName: string;
    ownerName: string;
    phone: string;
    tradeType: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const logout = useCallback(async () => {
    try {
      await tokenStorage.deleteItem(TOKEN_KEY);
    } catch {
      // ignore
    }
    setState({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
    });
  }, []);

  useEffect(() => {
    setLogoutCallback(logout);
  }, [logout]);

  useEffect(() => {
    let mounted = true;

    async function loadToken() {
      try {
        const token = await tokenStorage.getItem(TOKEN_KEY);
        if (!token) {
          if (mounted) {
            setState({ user: null, token: null, isLoading: false, isAuthenticated: false });
          }
          return;
        }

        const user = await authApi.getMe();
        if (mounted) {
          setState({ user, token, isLoading: false, isAuthenticated: true });
        }
      } catch {
        try {
          await tokenStorage.deleteItem(TOKEN_KEY);
        } catch {
          // ignore
        }
        if (mounted) {
          setState({ user: null, token: null, isLoading: false, isAuthenticated: false });
        }
      }
    }

    loadToken();

    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    setState({
      user: response.user,
      token: response.token,
      isLoading: false,
      isAuthenticated: true,
    });
  }, []);

  const register = useCallback(
    async (data: {
      email: string;
      password: string;
      businessName: string;
      ownerName: string;
      phone: string;
      tradeType: string;
    }) => {
      const response = await authApi.register(data);
      setState({
        user: response.user,
        token: response.token,
        isLoading: false,
        isAuthenticated: true,
      });
    },
    [],
  );

  const refreshUser = useCallback(async () => {
    try {
      const user = await authApi.getMe();
      setState((prev) => ({ ...prev, user }));
    } catch {
      // silently fail — interceptor handles 401
    }
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      login,
      register,
      logout,
      refreshUser,
    }),
    [state, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
