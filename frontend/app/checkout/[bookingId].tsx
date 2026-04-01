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
        // For demo purposes, mark as ready immediately
        setPaymentReady(true);
      }
    } catch (error) {
      console.error('Error loading booking:', error);
      showAlert('Error', 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handlePayment = async () => {
    if (!paymentReady || !booking) return;

    setProcessing(true);
    try {
      // Create payment intent
      await api.createPaymentIntent(booking.id);
      
      // Confirm payment (in production, this would happen after Stripe payment completion)
      await api.confirmPayment(booking.id);
      
      if (Platform.OS === 'web') {
        alert('Payment Successful! Your booking has been confirmed.');
        router.replace(`/ticket/${booking.id}`);
      } else {
        Alert.alert(
          'Payment Successful',
          'Your booking has been confirmed! Check your tickets in the Bookings tab.',
          [
            {
              text: 'View Ticket',
              onPress: () => router.replace(`/ticket/${booking.id}`),
            },
          ]
        );
      }
    } catch (error: any) {
      showAlert('Error', error.message || 'Payment failed');
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
        <ActivityIndicator size="large" color="#1a3a4a" />
        <Text style={styles.loadingText}>Loading checkout...</Text>
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Ionicons name="alert-circle-outline" size={64} color="#c4c9c9" />
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
        <View style={styles.successIcon}>
          <Ionicons name="checkmark" size={40} color="#fff" />
        </View>
        <Text style={styles.paidTitle}>Already Paid</Text>
        <Text style={styles.paidText}>This booking has already been completed.</Text>
        <TouchableOpacity
          style={styles.viewTicketButton}
          onPress={() => router.replace(`/ticket/${booking.id}`)}
        >
          <Text style={styles.viewTicketText}>View Ticket</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
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
          <Ionicons name="arrow-back" size={24} color="#2d3a3a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Booking Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.cardLabel}>BOOKING SUMMARY</Text>
          <Text style={styles.experienceTitle}>{booking.experience_title}</Text>
          
          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="calendar-outline" size={18} color="#1a3a4a" />
              </View>
              <Text style={styles.detailText}>{formatDate(booking.experience_date)}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="location-outline" size={18} color="#1a3a4a" />
              </View>
              <Text style={styles.detailText}>{booking.experience_location}</Text>
            </View>
          </View>
        </View>

        {/* Tickets */}
        <View style={styles.ticketsCard}>
          <Text style={styles.cardLabel}>TICKETS</Text>
          {booking.tickets.map((ticket, idx) => (
            <View key={idx} style={styles.ticketRow}>
              <View>
                <Text style={styles.ticketName}>{ticket.ticket_name}</Text>
                <Text style={styles.ticketQty}>{ticket.quantity} × €{ticket.price_per_ticket}</Text>
              </View>
              <Text style={styles.ticketTotal}>
                €{(ticket.quantity * ticket.price_per_ticket).toFixed(2)}
              </Text>
            </View>
          ))}
          
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>€{booking.total_amount.toFixed(2)}</Text>
          </View>
        </View>

        {/* Security Notice */}
        <View style={styles.securityNotice}>
          <Ionicons name="shield-checkmark" size={20} color="#10b981" />
          <Text style={styles.securityText}>
            Your payment information is secure and encrypted
          </Text>
        </View>

        {/* Demo Notice */}
        <View style={styles.demoNotice}>
          <Ionicons name="information-circle-outline" size={22} color="#1a3a4a" />
          <View style={styles.demoTextContainer}>
            <Text style={styles.demoTitle}>Demo Mode</Text>
            <Text style={styles.demoText}>
              This is a demo checkout. Tap "Complete Payment" to simulate a successful transaction.
            </Text>
          </View>
        </View>

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>Total</Text>
          <Text style={styles.priceValue}>€{booking.total_amount.toFixed(2)}</Text>
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
                {paymentReady ? 'Complete Payment' : 'Loading...'}
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
    backgroundColor: '#f8f6f3',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontFamily: 'TraditionalArabic',
    color: '#7a8a8a',
    fontSize: 16,
    marginTop: 16,
  },
  errorText: {
    fontFamily: 'TraditionalArabic',
    color: '#2d3a3a',
    fontSize: 18,
    fontWeight: '500',
    marginTop: 16,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  paidTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#2d3a3a',
    fontSize: 24,
    fontWeight: '600',
    marginTop: 16,
  },
  paidText: {
    fontFamily: 'TraditionalArabic',
    color: '#7a8a8a',
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  viewTicketButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a3a4a',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 28,
    marginTop: 32,
    gap: 8,
  },
  viewTicketText: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backToHomeButton: {
    marginTop: 20,
    padding: 12,
  },
  backToHomeText: {
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  headerTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#2d3a3a',
    fontSize: 20,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e8e5e0',
  },
  cardLabel: {
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
  detailsContainer: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailIcon: {
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
  ticketsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e8e5e0',
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
  ticketTotal: {
    fontFamily: 'TraditionalArabic',
    color: '#2d3a3a',
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
  securityNotice: {
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
  demoNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#e8f4f4',
    padding: 16,
    borderRadius: 14,
    gap: 12,
  },
  demoTextContainer: {
    flex: 1,
  },
  demoTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#1a3a4a',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  demoText: {
    fontFamily: 'TraditionalArabic',
    color: '#5a6a6a',
    fontSize: 13,
    lineHeight: 20,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e8e5e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 10,
  },
  priceContainer: {},
  priceLabel: {
    fontFamily: 'TraditionalArabic',
    color: '#7a8a8a',
    fontSize: 13,
  },
  priceValue: {
    fontFamily: 'TraditionalArabic',
    color: '#2d3a3a',
    fontSize: 26,
    fontWeight: '700',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1a3a4a',
    paddingHorizontal: 28,
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
});
