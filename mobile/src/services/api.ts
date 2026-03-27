import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Web-safe wrapper around SecureStore
const tokenStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try { return localStorage.getItem(key); } catch { return null; }
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { localStorage.setItem(key, value); } catch { /* ignore */ }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

const API_BASE_URL = __DEV__
  ? Platform.OS === 'android'
    ? 'http://10.0.2.2:3000/api/v1'
    : 'http://localhost:3000/api/v1'
  : 'https://api.invoicevoice.app/api/v1';

const TOKEN_KEY = 'auth_token';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await tokenStorage.getItem(TOKEN_KEY);
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Storage may fail in some environments; proceed without token
    }
    return config;
  },
  (error) => Promise.reject(error),
);

let logoutCallback: (() => void) | null = null;
let subscriptionExpiredCallback: (() => void) | null = null;

export function setLogoutCallback(callback: () => void): void {
  logoutCallback = callback;
}

export function setSubscriptionExpiredCallback(callback: () => void): void {
  subscriptionExpiredCallback = callback;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      try {
        await tokenStorage.deleteItem(TOKEN_KEY);
      } catch {
        // ignore
      }
      if (logoutCallback) {
        logoutCallback();
      }
    }
    if (error.response?.status === 402) {
      const data = error.response.data as { code?: string } | undefined;
      if (data?.code === 'SUBSCRIPTION_REQUIRED' && subscriptionExpiredCallback) {
        subscriptionExpiredCallback();
      }
    }
    return Promise.reject(error);
  },
);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  profile: {
    businessName: string;
    ownerName: string;
    phone: string;
    tradeType: string;
    licenseNumber?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    zip?: string;
    stripeOnboarded: boolean;
    stripeAccountId?: string;
    subscriptionStatus: string;
    trialEndsAt?: string;
    currentPeriodEnd?: string;
  };
}

export interface LineItem {
  id?: string;
  type: 'LABOR' | 'MATERIAL' | 'FLAT_RATE' | 'OTHER';
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'VIEWED' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  serviceAddress?: string;
  lineItems: LineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  description?: string;
  voiceTranscript?: string;
  sentAt?: string;
  paidAt?: string;
  paymentMethod?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalRevenue: number;
  unpaidAmount: number;
  invoiceCount: number;
  paidCount: number;
  monthlyRevenue: Array<{ month: string; revenue: number }>;
}

export interface RegisterData {
  email: string;
  password: string;
  businessName: string;
  ownerName: string;
  phone: string;
  tradeType: string;
}

export interface CreateInvoiceData {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  serviceAddress?: string;
  lineItems: Omit<LineItem, 'id'>[];
  taxRate: number;
  description?: string;
}

export interface UpdateInvoiceData extends Partial<CreateInvoiceData> {
  status?: InvoiceStatus;
}

export interface ProfileUpdateData {
  businessName?: string;
  ownerName?: string;
  phone?: string;
  tradeType?: string;
  licenseNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface InvoiceFilters {
  status?: InvoiceStatus;
  page?: number;
  limit?: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

// ─── Auth API ────────────────────────────────────────────────────────────────

export const authApi = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
    await tokenStorage.setItem(TOKEN_KEY, data.token);
    return data;
  },

  async register(registerData: RegisterData): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/register', registerData);
    await tokenStorage.setItem(TOKEN_KEY, data.token);
    return data;
  },

  async getMe(): Promise<User> {
    const { data } = await api.get<{ user: User }>('/auth/me');
    return data.user;
  },

  async logout(): Promise<void> {
    await tokenStorage.deleteItem(TOKEN_KEY);
  },
};

// ─── Invoice API ─────────────────────────────────────────────────────────────

export const invoiceApi = {
  async createFromVoice(audioUri: string): Promise<Invoice> {
    const formData = new FormData();
    formData.append('audio', {
      uri: audioUri,
      type: 'audio/m4a',
      name: 'recording.m4a',
    } as unknown as Blob);

    const { data } = await api.post<{ invoice: Invoice }>('/invoices/voice', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
    return data.invoice;
  },

  async create(invoiceData: CreateInvoiceData): Promise<Invoice> {
    const { data } = await api.post<{ invoice: Invoice }>('/invoices', invoiceData);
    return data.invoice;
  },

  async getAll(filters?: InvoiceFilters): Promise<Invoice[]> {
    const { data } = await api.get<{ invoices: Invoice[]; pagination: unknown }>('/invoices', { params: filters });
    return data.invoices;
  },

  async getById(id: string): Promise<Invoice> {
    const { data } = await api.get<{ invoice: Invoice }>(`/invoices/${id}`);
    return data.invoice;
  },

  async update(id: string, updateData: UpdateInvoiceData): Promise<Invoice> {
    const { data } = await api.put<{ invoice: Invoice }>(`/invoices/${id}`, updateData);
    return data.invoice;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/invoices/${id}`);
  },

  async send(id: string): Promise<Invoice> {
    const { data } = await api.post<{ invoice: Invoice }>(`/invoices/${id}/send`);
    return data.invoice;
  },

  async markAsPaid(id: string, paymentMethod: string): Promise<Invoice> {
    const { data } = await api.post<{ invoice: Invoice }>(`/invoices/${id}/mark-paid`, { paymentMethod });
    return data.invoice;
  },
};

// ─── Profile API ─────────────────────────────────────────────────────────────

export const profileApi = {
  async getProfile(): Promise<User['profile']> {
    const { data } = await api.get<{ profile: User['profile'] }>('/profile');
    return data.profile;
  },

  async updateProfile(profileData: ProfileUpdateData): Promise<User['profile']> {
    const { data } = await api.put<{ profile: User['profile'] }>('/profile', profileData);
    return data.profile;
  },

  async setupStripe(): Promise<{ url: string }> {
    const { data } = await api.post<{ url: string }>('/profile/stripe/setup');
    return data;
  },

  async confirmStripeOnboarding(): Promise<User['profile']> {
    const { data } = await api.get<{ profile: User['profile'] }>('/profile/stripe/callback');
    return data.profile;
  },
};

// ─── Subscription API ─────────────────────────────────────────────────────────

export interface SubscriptionInfo {
  subscriptionId: string | null;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
}

export const subscriptionApi = {
  async getSubscription(): Promise<SubscriptionInfo> {
    const { data } = await api.get<{ subscription: SubscriptionInfo }>('/profile/subscription');
    return data.subscription;
  },

  async getPortalUrl(): Promise<string> {
    const { data } = await api.post<{ url: string }>('/profile/subscription/portal');
    return data.url;
  },
};

// ─── Dashboard API ───────────────────────────────────────────────────────────

export const dashboardApi = {
  async getStats(): Promise<DashboardStats> {
    const { data } = await api.get<{ stats: DashboardStats }>('/invoices/stats');
    return data.stats;
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string; message?: string } | undefined;
    if (data?.error) {
      return data.error;
    }
    if (data?.message) {
      return data.message;
    }
    if (error.message === 'Network Error') {
      return 'Unable to connect to the server. Please check your internet connection.';
    }
    return 'Something went wrong. Please try again.';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred.';
}

export default api;
