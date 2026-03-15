import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

const { width } = Dimensions.get('window');

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
  qr_code?: string;
  confirmed_at?: string;
}

export default function TicketScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.setToken(token);
      loadBooking();
    }
  }, [id, token]);

  const loadBooking = async () => {
    try {
      const data = await api.getBooking(id as string);
      setBooking(data);
    } catch (error) {
      console.error('Error loading booking:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!booking) return;
    
    try {
      await Share.share({
        message: `My ticket for ${booking.experience_title} on ${formatDate(booking.experience_date)} at ${booking.experience_location}. Booking ID: ${booking.id}`,
        title: 'Wandering Yacht Ticket',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getTotalTickets = () => {
    if (!booking) return 0;
    return booking.tickets.reduce((sum, t) => sum + t.quantity, 0);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#00b4d8" />
      </View>
    );
  }

  if (!booking || !booking.qr_code) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Ionicons name="ticket-outline" size={64} color="#5c6f7f" />
        <Text style={styles.errorTitle}>Ticket Not Available</Text>
        <Text style={styles.errorText}>Payment may not be completed yet.</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Ticket</Text>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Ticket Card */}
        <View style={styles.ticketCard}>
          {/* Top Section */}
          <View style={styles.ticketTop}>
            <View style={styles.brandRow}>
              <Ionicons name="boat" size={24} color="#00b4d8" />
              <Text style={styles.brandText}>WANDERING YACHT</Text>
            </View>
            
            <View style={styles.confirmedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={styles.confirmedText}>CONFIRMED</Text>
            </View>
          </View>

          {/* Event Info */}
          <View style={styles.eventInfo}>
            <Text style={styles.eventTitle}>{booking.experience_title}</Text>
            
            <View style={styles.eventDetails}>
              <View style={styles.detailItem}>
                <Ionicons name="calendar" size={18} color="#00b4d8" />
                <Text style={styles.detailText}>{formatDate(booking.experience_date)}</Text>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="location" size={18} color="#00b4d8" />
                <Text style={styles.detailText}>{booking.experience_location}</Text>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="people" size={18} color="#00b4d8" />
                <Text style={styles.detailText}>{getTotalTickets()} Guest(s)</Text>
              </View>
            </View>
          </View>

          {/* Divider with cutouts */}
          <View style={styles.dividerContainer}>
            <View style={styles.cutoutLeft} />
            <View style={styles.dividerLine} />
            <View style={styles.cutoutRight} />
          </View>

          {/* QR Code Section */}
          <View style={styles.qrSection}>
            <Text style={styles.qrLabel}>Scan at entrance</Text>
            <View style={styles.qrContainer}>
              {booking.qr_code ? (
                <Image
                  source={{ uri: booking.qr_code }}
                  style={styles.qrCode}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Ionicons name="qr-code" size={100} color="#5c6f7f" />
                </View>
              )}
            </View>
            <Text style={styles.bookingId}>Booking ID: {booking.id.slice(0, 8).toUpperCase()}</Text>
          </View>

          {/* Tickets Summary */}
          <View style={styles.ticketsSummary}>
            {booking.tickets.map((ticket, idx) => (
              <View key={idx} style={styles.ticketSummaryRow}>
                <Text style={styles.ticketSummaryName}>
                  {ticket.quantity}x {ticket.ticket_name}
                </Text>
                <Text style={styles.ticketSummaryPrice}>
                  ${(ticket.quantity * ticket.price_per_ticket).toFixed(2)}
                </Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Paid</Text>
              <Text style={styles.totalValue}>${booking.total_amount.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>Instructions</Text>
          <View style={styles.instructionItem}>
            <Ionicons name="checkmark" size={16} color="#00b4d8" />
            <Text style={styles.instructionText}>
              Please arrive 15 minutes before the scheduled time
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <Ionicons name="checkmark" size={16} color="#00b4d8" />
            <Text style={styles.instructionText}>
              Show this QR code at the entrance for check-in
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <Ionicons name="checkmark" size={16} color="#00b4d8" />
            <Text style={styles.instructionText}>
              Bring a valid photo ID for verification
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  errorTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  errorText: {
    color: '#8899a6',
    fontSize: 14,
    marginTop: 8,
  },
  backButton: {
    backgroundColor: '#00b4d8',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  backButtonText: {
    color: '#fff',
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
  closeButton: {
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
  shareButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a2d4a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  ticketCard: {
    backgroundColor: '#1a2d4a',
    borderRadius: 20,
    overflow: 'hidden',
  },
  ticketTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a3d5a',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandText: {
    color: '#00b4d8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confirmedText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  eventInfo: {
    padding: 20,
  },
  eventTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  eventDetails: {
    gap: 10,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailText: {
    color: '#8899a6',
    fontSize: 14,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  cutoutLeft: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0a1628',
    marginLeft: -10,
  },
  dividerLine: {
    flex: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#2a3d5a',
    marginHorizontal: 10,
  },
  cutoutRight: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0a1628',
    marginRight: -10,
  },
  qrSection: {
    alignItems: 'center',
    padding: 20,
  },
  qrLabel: {
    color: '#8899a6',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  qrContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
  },
  qrCode: {
    width: 180,
    height: 180,
  },
  qrPlaceholder: {
    width: 180,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingId: {
    color: '#8899a6',
    fontSize: 12,
    marginTop: 16,
  },
  ticketsSummary: {
    backgroundColor: '#0d1a2e',
    padding: 20,
  },
  ticketSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  ticketSummaryName: {
    color: '#8899a6',
    fontSize: 14,
  },
  ticketSummaryPrice: {
    color: '#8899a6',
    fontSize: 14,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a3d5a',
  },
  totalLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  totalValue: {
    color: '#00b4d8',
    fontSize: 18,
    fontWeight: '700',
  },
  instructions: {
    marginTop: 24,
    backgroundColor: '#1a2d4a',
    borderRadius: 16,
    padding: 20,
  },
  instructionsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  instructionText: {
    color: '#8899a6',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
});
