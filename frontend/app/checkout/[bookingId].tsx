import React, { useEffect, useState } from 'react';
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
import { useStripe } from '@stripe/stripe-react-native';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

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

export default function CheckoutScreen() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);

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
        await initializePayment(data.id);
      }
    } catch (error) {
      console.error('Error loading booking:', error);
      Alert.alert('Error', 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  };

  const initializePayment = async (bookingId: string) => {
    try {
      const paymentIntent = await api.createPaymentIntent(bookingId);
      
      const { error } = await initPaymentSheet({
        merchantDisplayName: 'Wandering Yacht',
        paymentIntentClientSecret: paymentIntent.client_secret,
        defaultBillingDetails: {
          name: '',
        },
        style: 'alwaysDark',
      });

      if (error) {
        console.error('Payment sheet init error:', error);
        Alert.alert('Error', 'Failed to initialize payment');
      } else {
        setPaymentReady(true);
      }
    } catch (error: any) {
      console.error('Payment initialization error:', error);
      Alert.alert('Error', error.message || 'Failed to initialize payment');
    }
  };

  const handlePayment = async () => {
    if (!paymentReady) return;

    setProcessing(true);
    try {
      const { error } = await presentPaymentSheet();

      if (error) {
        if (error.code !== 'Canceled') {
          Alert.alert('Payment Failed', error.message);
        }
      } else {
        // Payment successful - confirm with backend
        await api.confirmPayment(booking!.id);
        Alert.alert(
          'Payment Successful',
          'Your booking has been confirmed! Check your tickets in the Bookings tab.',
          [
            {
              text: 'View Ticket',
              onPress: () => router.replace(`/ticket/${booking!.id}`),
            },
          ]
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#00b4d8" />
        <Text style={styles.loadingText}>Loading checkout...</Text>
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.errorText}>Booking not found</Text>
        <TouchableOpacity
          style={styles.backToHomeButton}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.backToHomeText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (booking.payment_status === 'paid') {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Ionicons name="checkmark-circle" size={64} color="#10b981" />
        <Text style={styles.paidTitle}>Already Paid</Text>
        <Text style={styles.paidText}>This booking has already been paid.</Text>
        <TouchableOpacity
          style={styles.viewTicketButton}
          onPress={() => router.replace(`/ticket/${booking.id}`)}
        >
          <Text style={styles.viewTicketText}>View Ticket</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Booking Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>Booking Summary</Text>
          <Text style={styles.experienceTitle}>{booking.experience_title}</Text>
          
          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={16} color="#8899a6" />
            <Text style={styles.detailText}>{formatDate(booking.experience_date)}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Ionicons name="location" size={16} color="#8899a6" />
            <Text style={styles.detailText}>{booking.experience_location}</Text>
          </View>
        </View>

        {/* Tickets */}
        <View style={styles.ticketsCard}>
          <Text style={styles.cardTitle}>Tickets</Text>
          {booking.tickets.map((ticket, idx) => (
            <View key={idx} style={styles.ticketRow}>
              <View>
                <Text style={styles.ticketName}>{ticket.ticket_name}</Text>
                <Text style={styles.ticketQty}>{ticket.quantity}x @ ${ticket.price_per_ticket}</Text>
              </View>
              <Text style={styles.ticketTotal}>
                ${(ticket.quantity * ticket.price_per_ticket).toFixed(2)}
              </Text>
            </View>
          ))}
          
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>${booking.total_amount.toFixed(2)}</Text>
          </View>
        </View>

        {/* Payment Info */}
        <View style={styles.paymentInfo}>
          <Ionicons name="shield-checkmark" size={20} color="#10b981" />
          <Text style={styles.paymentInfoText}>
            Secure payment powered by Stripe
          </Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>Total</Text>
          <Text style={styles.priceValue}>${booking.total_amount.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.payButton,
            (!paymentReady || processing) && styles.payButtonDisabled,
          ]}
          onPress={handlePayment}
          disabled={!paymentReady || processing}
        >
          {processing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="lock-closed" size={18} color="#fff" />
              <Text style={styles.payButtonText}>
                {paymentReady ? 'Pay Now' : 'Loading...'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#8899a6',
    fontSize: 16,
    marginTop: 16,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
  },
  paidTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
    marginTop: 16,
  },
  paidText: {
    color: '#8899a6',
    fontSize: 14,
    marginTop: 8,
  },
  viewTicketButton: {
    backgroundColor: '#00b4d8',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  viewTicketText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backToHomeButton: {
    marginTop: 20,
    padding: 12,
  },
  backToHomeText: {
    color: '#00b4d8',
    fontSize: 16,
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
    backgroundColor: '#1a2d4a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  summaryCard: {
    backgroundColor: '#1a2d4a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    color: '#8899a6',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  experienceTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  detailText: {
    color: '#8899a6',
    fontSize: 14,
  },
  ticketsCard: {
    backgroundColor: '#1a2d4a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  ticketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a3d5a',
  },
  ticketName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  ticketQty: {
    color: '#8899a6',
    fontSize: 13,
    marginTop: 2,
  },
  ticketTotal: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginTop: 4,
  },
  totalLabel: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  totalAmount: {
    color: '#00b4d8',
    fontSize: 24,
    fontWeight: '700',
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  paymentInfoText: {
    color: '#8899a6',
    fontSize: 13,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a2d4a',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a3d5a',
  },
  priceContainer: {},
  priceLabel: {
    color: '#8899a6',
    fontSize: 12,
  },
  priceValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#00b4d8',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  payButtonDisabled: {
    opacity: 0.5,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
