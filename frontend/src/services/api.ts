import Constants from 'expo-constants';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

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

  async register(email: string, password: string, full_name: string, phone?: string, whatsapp_number?: string) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name, phone, whatsapp_number }),
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
}

export const api = new ApiService();
