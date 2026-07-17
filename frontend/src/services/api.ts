import Constants from 'expo-constants';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://wandering-yacht-experiences-production.up.railway.app';

class ApiService {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_URL}/api${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as any)['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'An error occurred' }));
      throw new Error(error.detail || 'An error occurred');
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(email: string, password: string, full_name: string, phone?: string, whatsapp_number?: string, website?: string, form_loaded_at?: string) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name, phone, whatsapp_number, website, form_loaded_at }),
    });
  }

  async getMe() {
    return this.request('/auth/me');
  }

  // Categories
  async getCategories() {
    return this.request('/categories');
  }

  // Experiences
  async getExperiences(category?: string) {
    const query = category ? `?category=${category}` : '';
    return this.request(`/experiences${query}`);
  }

  async getExperience(id: string) {
    return this.request(`/experiences/${id}`);
  }

  // Bookings
  async createBooking(data: {
    experience_id: string;
    tickets: Array<{
      ticket_type_id: string;
      ticket_name: string;
      quantity: number;
      price_per_ticket: number;
    }>;
    time_slot_id?: string;
    special_requests?: string;
    selected_date?: string;
  }) {
    return this.request('/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getBookings() {
    return this.request('/bookings');
  }

  async getBooking(id: string) {
    return this.request(`/bookings/${id}`);
  }

  // Payments
  async getPaymentConfig() {
    return this.request('/payment/config');
  }

  async createPaymentIntent(bookingId: string) {
    return this.request('/payment/create-intent', {
      method: 'POST',
      body: JSON.stringify({ booking_id: bookingId }),
    });
  }

  async confirmPayment(bookingId: string) {
    return this.request(`/payment/confirm/${bookingId}`, {
      method: 'POST',
    });
  }

  // Balance Payment Flow
  async getBalanceInfo(bookingId) {
    return this.request(`/payment/balance-info/${bookingId}`);
  }

  async createBalanceIntent(bookingId) {
    return this.request(`/payment/create-balance-intent/${bookingId}`, {
      method: 'POST',
    });
  }

  async confirmBalancePayment(bookingId) {
    return this.request(`/payment/confirm-balance/${bookingId}`, {
      method: 'POST',
    });
  }

  async requestBalancePayment(bookingId) {
    return this.request(`/payment/request-balance/${bookingId}`, {
      method: 'POST',
    });
  }

  async getDepositPendingBookings() {
    return this.request('/bookings/deposit-pending');
  }

  // Biometric
  async biometricRefresh() {
    return this.request('/auth/biometric-refresh', {
      method: 'POST',
    });
  }

  // Passkey / WebAuthn
  async getPasskeyRegisterOptions() {
    return this.request('/passkey/register/options', {
      method: 'POST',
    });
  }

  async verifyPasskeyRegister(credential: string) {
    return this.request('/passkey/register/verify', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    });
  }

  async getPasskeyAuthOptions() {
    return this.request('/passkey/auth/options', {
      method: 'POST',
    });
  }

  async verifyPasskeyAuth(credential: string) {
    return this.request('/passkey/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    });
  }
}

export const api = new ApiService();
