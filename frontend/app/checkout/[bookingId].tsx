import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { useLanguage } from '../../src/context/LanguageContext';

interface Booking {
  id: string;
  experience_id: string;
  experience_title: string;
  experience_date: string;
  experience_location: string;
  tickets: Array<{
    ticket_type_id: string;
    ticket_name: string;
    quantity: number;
    price_per_ticket: number;
  }>;
  total_amount: number;
  status: string;
  payment_status: string;
}

// Web-only Stripe Card Component using @stripe/stripe-js
function WebStripeCard({ clientSecret, publishableKey, onSuccess, onError, processing, setProcessing }: {
  clientSecret: string;
  publishableKey: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
  processing: boolean;
  setProcessing: (v: boolean) => void;
}) {
  const stripeRef = useRef<any>(null);
  const cardElementRef = useRef<any>(null);
  const [cardReady, setCardReady] = useState(false);
  const [cardError, setCardError] = useState('');
  const mountedRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || mountedRef.current) return;
    mountedRef.current = true;

    const initStripe = async () => {
      try {
        const stripeJs = await import('@stripe/stripe-js');
        const stripe = await stripeJs.loadStripe(publishableKey);
        if (!stripe) {
          onError('Failed to load Stripe');
          return;
        }
        stripeRef.current = stripe;

        const elements = stripe.elements({ clientSecret });
        const cardElement = elements.create('card', {
          style: {
            base: {
              fontSize: '16px',
              color: '#2d3a3a',
              fontFamily: 'Arial, sans-serif',
              '::placeholder': { color: '#a0aab0' },
            },
            invalid: { color: '#e53e3e' },
          },
        });

        // Wait for DOM element to be available
        setTimeout(() => {
          const mountEl = document.getElementById('stripe-card-element');
          if (mountEl) {
            cardElement.mount(mountEl);
            cardElementRef.current = cardElement;
            cardElement.on('ready', () => setCardReady(true));
            cardElement.on('change', (event: any) => {
              setCardError(event.error ? event.error.message : '');
            });
          } else {
            onError('Card element container not found');
          }
        }, 100);
      } catch (err: any) {
        console.error('Stripe init error:', err);
        onError(err.message || 'Failed to initialize payment');
      }
    };

    initStripe();

    return () => {
      if (cardElementRef.current) {
        try { cardElementRef.current.destroy(); } catch (e) { /* noop */ }
      }
    };
  }, [clientSecret, publishableKey]);

  const handlePay = useCallback(async () => {
    if (!stripeRef.current || !cardElementRef.current || processing) return;
    setProcessing(true);
    setCardError('');

    try {
      const { error, paymentIntent } = await stripeRef.current.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElementRef.current },
      });

      if (error) {
        setCardError(error.message || 'Payment failed');
        onError(error.message || 'Payment failed');
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess();
      } else {
        setCardError('Payment was not completed');
        onError('Payment was not completed. Please try again.');
      }
    } catch (err: any) {
      setCardError(err.message || 'Payment failed');
      onError(err.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  }, [clientSecret, processing]);

  if (Platform.OS !== 'web') return null;

  return (
    <View style={styles.cardSection}>
      <Text style={styles.sectionLabel}>CARD DETAILS</Text>
      <View style={styles.cardInputWrapper}>
        {/* @ts-ignore - web-only DOM element */}
        <div
          id="stripe-card-element"
          style={{
            padding: '14px 12px',
            backgroundColor: '#fff',
            borderRadius: 12,
            border: '1.5px solid #d5d0c8',
            minHeight: 48,
          }}
        />
      </View>
      {cardError ? <Text style={styles.cardErrorText}>{cardError}</Text> : null}

      <View style={styles.testCardHint}>
        <Ionicons name="information-circle-outline" size={16} color="#7a8a8a" />
        <Text style={styles.testCardText}>Test card: 4242 4242 4242 4242 | Any future date | Any CVC</Text>
      </View>

      <TouchableOpacity
        style={[styles.payButton, (!cardReady || processing) && styles.payButtonDisabled]}
        onPress={handlePay}
        disabled={!cardReady || processing}
      >
        {processing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="lock-closed" size={18} color="#fff" />
            <Text style={styles.payButtonText}>Complete Payment</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

// Native Payment Component (API-based for Expo Go compatibility)
function NativePaymentCard({ bookingId, onSuccess, onError, processing, setProcessing }: {
  bookingId: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
  processing: boolean;
  setProcessing: (v: boolean) => void;
}) {
  const handlePay = useCallback(async () => {
    if (processing) return;
    setProcessing(true);
    try {
      await api.confirmPayment(bookingId);
      onSuccess();
    } catch (err: any) {
      onError(err.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  }, [bookingId, processing]);

  if (Platform.OS === 'web') return null;

  return (
    <View style={styles.cardSection}>
      <Text style={styles.sectionLabel}>PAYMENT</Text>
      <View style={styles.nativePayInfo}>
        <Ionicons name="card-outline" size={32} color="#1a3a4a" />
        <Text style={styles.nativePayText}>Secure payment via Stripe</Text>
      </View>

      <View style={styles.testCardHint}>
        <Ionicons name="information-circle-outline" size={16} color="#1a3a4a" />
        <Text style={styles.testCardText}>Test mode: Payment will be simulated</Text>
      </View>

      <TouchableOpacity
        style={[styles.payButton, processing && styles.payButtonDisabled]}
        onPress={handlePay}
        disabled={processing}
      >
        {processing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="lock-closed" size={18} color="#fff" />
            <Text style={styles.payButtonText}>Complete Payment</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t } = useLanguage();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState('');
  const [publishableKey, setPublishableKey] = useState('');

  useEffect(() => {
    if (token) {
      api.setToken(token);
      loadBooking();
    }
  }, [bookingId, token]);

  const loadBooking = async () => {
    try {
      const data = await api.getBooking(bookingId as string);
      setBooking(data);

      if (data.payment_status === 'unpaid') {
        const paymentData = await api.createPaymentIntent(data.id);
        setClientSecret(paymentData.client_secret);
        setPublishableKey(paymentData.publishable_key);
      }
    } catch (error: any) {
      console.error('Error loading booking:', error);
      showAlert('Error', error.message || 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handlePaymentSuccess = async () => {
    try {
      await api.confirmPayment(booking!.id);
    } catch (e) {
      // Payment already succeeded on Stripe, proceed anyway
    }
    if (Platform.OS === 'web') {
      window.alert('Payment Successful! Your booking has been confirmed.');
      router.replace(`/ticket/${booking!.id}`);
    } else {
      Alert.alert(
        'Payment Successful',
        'Your booking has been confirmed!',
        [{ text: 'View Ticket', onPress: () => router.replace(`/ticket/${booking!.id}`) }]
      );
    }
  };

  const handlePaymentError = (message: string) => {
    showAlert('Payment Error', message);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#1a3a4a" />
        <Text style={styles.loadingText}>{t('checkout_loading') || 'Loading checkout...'}</Text>
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Ionicons name="alert-circle-outline" size={64} color="#c4c9c9" />
        <Text style={styles.errorText}>{t('checkout_not_found') || 'Booking not found'}</Text>
        <TouchableOpacity style={styles.linkButton} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.linkButtonText}>{t('checkout_go_home') || 'Go Home'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (booking.payment_status === 'paid') {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <View style={styles.successCircle}>
          <Ionicons name="checkmark" size={40} color="#fff" />
        </View>
        <Text style={styles.successTitle}>{t('checkout_already_paid') || 'Already Paid'}</Text>
        <Text style={styles.successSubtext}>{t('checkout_already_paid_text') || 'This booking is confirmed.'}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace(`/ticket/${booking.id}`)}>
          <Text style={styles.primaryButtonText}>{t('checkout_view_ticket') || 'View Ticket'}</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#2d3a3a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('checkout_title') || 'Checkout'}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Booking Summary */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('checkout_summary') || 'BOOKING SUMMARY'}</Text>
          <Text style={styles.experienceTitle}>{booking.experience_title}</Text>
          <View style={styles.detailsGroup}>
            <View style={styles.detailRow}>
              <View style={styles.detailIconBox}>
                <Ionicons name="calendar-outline" size={18} color="#1a3a4a" />
              </View>
              <Text style={styles.detailText}>{formatDate(booking.experience_date)}</Text>
            </View>
            <View style={styles.detailRow}>
              <View style={styles.detailIconBox}>
                <Ionicons name="location-outline" size={18} color="#1a3a4a" />
              </View>
              <Text style={styles.detailText}>{booking.experience_location}</Text>
            </View>
          </View>
        </View>

        {/* Tickets */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('checkout_tickets') || 'TICKETS'}</Text>
          {booking.tickets.map((ticket, idx) => (
            <View key={idx} style={styles.ticketRow}>
              <View>
                <Text style={styles.ticketName}>{ticket.ticket_name}</Text>
                <Text style={styles.ticketQty}>{ticket.quantity} x €{ticket.price_per_ticket}</Text>
              </View>
              <Text style={styles.ticketPrice}>€{(ticket.quantity * ticket.price_per_ticket).toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.totalDivider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('checkout_total') || 'Total'}</Text>
            <Text style={styles.totalAmount}>€{booking.total_amount.toFixed(2)}</Text>
          </View>
        </View>

        {/* Payment - Platform-specific */}
        {clientSecret && publishableKey ? (
          <>
            {Platform.OS === 'web' && (
              <WebStripeCard
                clientSecret={clientSecret}
                publishableKey={publishableKey}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                processing={processing}
                setProcessing={setProcessing}
              />
            )}
            {Platform.OS !== 'web' && (
              <NativePaymentCard
                bookingId={booking.id}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                processing={processing}
                setProcessing={setProcessing}
              />
            )}
          </>
        ) : (
          <View style={[styles.card, styles.centerContent]}>
            <ActivityIndicator size="small" color="#1a3a4a" />
            <Text style={styles.loadingText}>Preparing payment...</Text>
          </View>
        )}

        {/* Security */}
        <View style={styles.securityRow}>
          <Ionicons name="shield-checkmark" size={20} color="#10b981" />
          <Text style={styles.securityText}>{t('checkout_secure') || 'Your payment is secured with SSL encryption'}</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f6f3',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontFamily: 'TraditionalArabic',
    color: '#7a8a8a',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: 'TraditionalArabic',
    color: '#2d3a3a',
    fontSize: 18,
    fontWeight: '500',
    marginTop: 16,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  successTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#2d3a3a',
    fontSize: 24,
    fontWeight: '600',
    marginTop: 16,
  },
  successSubtext: {
    fontFamily: 'TraditionalArabic',
    color: '#7a8a8a',
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a3a4a',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 28,
    marginTop: 32,
    gap: 8,
  },
  primaryButtonText: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 20,
    padding: 12,
  },
  linkButtonText: {
    fontFamily: 'TraditionalArabic',
    color: '#1a3a4a',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#2d3a3a',
    fontSize: 20,
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e8e5e0',
  },
  sectionLabel: {
    fontFamily: 'TraditionalArabic',
    color: '#7a8a8a',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
  },
  experienceTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#2d3a3a',
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 16,
  },
  detailsGroup: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#e8f4f4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailText: {
    fontFamily: 'TraditionalArabic',
    color: '#5a6a6a',
    fontSize: 15,
  },
  ticketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0ebe4',
  },
  ticketName: {
    fontFamily: 'TraditionalArabic',
    color: '#2d3a3a',
    fontSize: 16,
    fontWeight: '500',
  },
  ticketQty: {
    fontFamily: 'TraditionalArabic',
    color: '#7a8a8a',
    fontSize: 13,
    marginTop: 2,
  },
  ticketPrice: {
    fontFamily: 'TraditionalArabic',
    color: '#2d3a3a',
    fontSize: 16,
    fontWeight: '600',
  },
  totalDivider: {
    height: 1,
    backgroundColor: '#e8e5e0',
    marginTop: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
  },
  totalLabel: {
    fontFamily: 'TraditionalArabic',
    color: '#2d3a3a',
    fontSize: 18,
    fontWeight: '600',
  },
  totalAmount: {
    fontFamily: 'TraditionalArabic',
    color: '#1a3a4a',
    fontSize: 26,
    fontWeight: '700',
  },
  cardSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e8e5e0',
  },
  cardInputWrapper: {
    width: '100%',
    marginBottom: 4,
  },
  cardErrorText: {
    fontFamily: 'TraditionalArabic',
    color: '#e53e3e',
    fontSize: 13,
    marginTop: 8,
  },
  testCardHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f7f7',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 14,
    marginBottom: 20,
  },
  testCardText: {
    fontFamily: 'TraditionalArabic',
    color: '#7a8a8a',
    fontSize: 12,
    flex: 1,
  },
  nativePayInfo: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  nativePayText: {
    fontFamily: 'TraditionalArabic',
    color: '#5a6a6a',
    fontSize: 15,
    textAlign: 'center',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1a3a4a',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 28,
  },
  payButtonDisabled: {
    opacity: 0.5,
  },
  payButtonText: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  securityText: {
    fontFamily: 'TraditionalArabic',
    color: '#7a8a8a',
    fontSize: 13,
  },
});
