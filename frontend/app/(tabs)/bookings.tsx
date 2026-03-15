import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
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
    ticket_name: string;
    quantity: number;
    price_per_ticket: number;
  }>;
  total_amount: number;
  status: string;
  payment_status: string;
  qr_code?: string;
  created_at: string;
}

export default function BookingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (token) {
        api.setToken(token);
        loadBookings();
      } else {
        setLoading(false);
      }
    }, [token])
  );

  const loadBookings = async () => {
    try {
      const data = await api.getBookings();
      setBookings(data);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      case 'cancelled':
        return '#ef4444';
      default:
        return '#8899a6';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Bookings</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="ticket-outline" size={64} color="#5c6f7f" />
          <Text style={styles.emptyTitle}>Sign in to view bookings</Text>
          <Text style={styles.emptyText}>
            Create an account or sign in to see your booking history
          </Text>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Bookings</Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1a365d"
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading bookings...</Text>
          </View>
        ) : bookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="ticket-outline" size={64} color="#5c6f7f" />
            <Text style={styles.emptyTitle}>No bookings yet</Text>
            <Text style={styles.emptyText}>
              Explore our experiences and make your first booking
            </Text>
            <TouchableOpacity
              style={styles.exploreButton}
              onPress={() => router.push('/(tabs)/explore')}
            >
              <Text style={styles.exploreButtonText}>Explore Now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          bookings.map((booking) => (
            <TouchableOpacity
              key={booking.id}
              style={styles.bookingCard}
              onPress={() => {
                if (booking.status === 'confirmed' && booking.qr_code) {
                  router.push(`/ticket/${booking.id}`);
                } else if (booking.payment_status === 'unpaid') {
                  router.push(`/checkout/${booking.id}`);
                }
              }}
            >
              <View style={styles.bookingHeader}>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(booking.status) + '20' },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: getStatusColor(booking.status) },
                    ]}
                  >
                    {booking.status.toUpperCase()}
                  </Text>
                </View>
                {booking.qr_code && (
                  <Ionicons name="qr-code" size={20} color="#1a365d" />
                )}
              </View>

              <Text style={styles.bookingTitle}>{booking.experience_title}</Text>

              <View style={styles.bookingDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar" size={16} color="#8899a6" />
                  <Text style={styles.detailText}>
                    {formatDate(booking.experience_date)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="location" size={16} color="#8899a6" />
                  <Text style={styles.detailText}>{booking.experience_location}</Text>
                </View>
              </View>

              <View style={styles.ticketsSummary}>
                {booking.tickets.map((ticket, idx) => (
                  <Text key={idx} style={styles.ticketText}>
                    {ticket.quantity}x {ticket.ticket_name}
                  </Text>
                ))}
              </View>

              <View style={styles.bookingFooter}>
                <Text style={styles.totalAmount}>${booking.total_amount.toFixed(2)}</Text>
                {booking.payment_status === 'unpaid' && (
                  <View style={styles.payNowBadge}>
                    <Text style={styles.payNowText}>Pay Now</Text>
                    <Ionicons name="arrow-forward" size={14} color="#fff" />
                  </View>
                )}
                {booking.status === 'confirmed' && booking.qr_code && (
                  <View style={styles.viewTicketBadge}>
                    <Text style={styles.viewTicketText}>View Ticket</Text>
                    <Ionicons name="arrow-forward" size={14} color="#1a365d" />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    fontFamily: 'TraditionalArabic',
    color: '#8899a6',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyText: {
    fontFamily: 'TraditionalArabic',
    color: '#8899a6',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  signInButton: {
    backgroundColor: '#1a365d',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  signInButtonText: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  exploreButton: {
    backgroundColor: '#1a365d',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  exploreButtonText: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bookingCard: {
    backgroundColor: '#1a2d4a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  bookingTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  bookingDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontFamily: 'TraditionalArabic',
    color: '#8899a6',
    fontSize: 14,
  },
  ticketsSummary: {
    backgroundColor: '#0a1628',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  ticketText: {
    fontFamily: 'TraditionalArabic',
    color: '#8899a6',
    fontSize: 13,
  },
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a3d5a',
  },
  totalAmount: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  payNowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a365d',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  payNowText: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  viewTicketBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewTicketText: {
    fontFamily: 'TraditionalArabic',
    color: '#1a365d',
    fontSize: 14,
    fontWeight: '600',
  },
});
