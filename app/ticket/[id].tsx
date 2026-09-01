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
        <ActivityIndicator size="large" color="#1a3a4a" />
      </View>
    );
  }

  if (!booking || !booking.qr_code) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Ionicons name="ticket-outline" size={64} color="#c4c9c9" />
        <Text style={styles.errorTitle}>Ticket Not Available</Text>
        <Text style={styles.errorText}>Payment may not be completed yet.</Text>
        <TouchableOpacity
          style={styles.backButtonLarge}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonLargeText}>Go Back</Text>
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
          <Ionicons name="close" size={24} color="#2d3a3a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Ticket</Text>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color="#1a3a4a" />
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
              <Image
                source={require('../../assets/images/wy-logo-solid.png')}
                style={styles.brandLogo}
                resizeMode="contain"
              />
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
                <View style={styles.detailIcon}>
                  <Ionicons name="calendar-outline" size={18} color="#1a3a4a" />
                </View>
                <Text style={styles.detailText}>{formatDate(booking.experience_date)}</Text>
              </View>
              <View style={styles.detailItem}>
                <View style={styles.detailIcon}>
                  <Ionicons name="location-outline" size={18} color="#1a3a4a" />
                </View>
                <Text style={styles.detailText}>{booking.experience_location}</Text>
              </View>
              <View style={styles.detailItem}>
                <View style={styles.detailIcon}>
                  <Ionicons name="people-outline" size={18} color="#1a3a4a" />
                </View>
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
            <Text style={styles.qrLabel}>SCAN AT ENTRANCE</Text>
            <View style={styles.qrContainer}>
              {booking.qr_code ? (
                <Image
                  source={{ uri: booking.qr_code }}
                  style={styles.qrCode}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Ionicons name="qr-code" size={100} color="#c4c9c9" />
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
                  {ticket.quantity}× {ticket.ticket_name}
                </Text>
                <Text style={styles.ticketSummaryPrice}>
                  €{(ticket.quantity * ticket.price_per_ticket).toFixed(2)}
                </Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Paid</Text>
              <Text style={styles.totalValue}>€{booking.total_amount.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>Instructions</Text>
          <View style={styles.instructionItem}>
            <View style={styles.instructionIcon}>
              <Ionicons name="checkmark" size={14} color="#fff" />
            </View>
            <Text style={styles.instructionText}>
              Please arrive 15 minutes before the scheduled time
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <View style={styles.instructionIcon}>
              <Ionicons name="checkmark" size={14} color="#fff" />
            </View>
            <Text style={styles.instructionText}>
              Show this QR code at the entrance for check-in
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <View style={styles.instructionIcon}>
              <Ionicons name="checkmark" size={14} color="#fff" />
            </View>
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
    backgroundColor: '#f8f6f3',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#2d3a3a',
    fontSize: 20,
    fontFamily: 'TraditionalArabic',
    fontWeight: '600',
    marginTop: 16,
  },
  errorText: {
    fontFamily: 'TraditionalArabic',
    color: '#7a8a8a',
    fontSize: 14,
    fontFamily: 'TraditionalArabic',
    marginTop: 8,
    textAlign: 'center',
  },
  backButtonLarge: {
    backgroundColor: '#1a3a4a',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 24,
  },
  backButtonLargeText: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 16,
    fontFamily: 'TraditionalArabic',
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
    fontFamily: 'TraditionalArabic',
    fontWeight: '600',
  },
  shareButton: {
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  ticketCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  ticketTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0ebe4',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogo: {
    width: 28,
    height: 28,
  },
  brandText: {
    fontFamily: 'TraditionalArabic',
    color: '#1a3a4a',
    fontSize: 11,
    fontFamily: 'TraditionalArabic',
    fontWeight: '700',
    letterSpacing: 2,
  },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e8f9f0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  confirmedText: {
    fontFamily: 'TraditionalArabic',
    color: '#10b981',
    fontSize: 10,
    fontFamily: 'TraditionalArabic',
    fontWeight: '700',
    letterSpacing: 1,
  },
  eventInfo: {
    padding: 20,
  },
  eventTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#2d3a3a',
    fontSize: 24,
    fontFamily: 'TraditionalArabic',
    fontWeight: '600',
    marginBottom: 20,
    lineHeight: 30,
  },
  eventDetails: {
    gap: 14,
  },
  detailItem: {
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
    fontFamily: 'TraditionalArabic',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  cutoutLeft: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f8f6f3',
    marginLeft: -12,
  },
  dividerLine: {
    flex: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#e8e5e0',
    marginHorizontal: 12,
  },
  cutoutRight: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f8f6f3',
    marginRight: -12,
  },
  qrSection: {
    alignItems: 'center',
    padding: 24,
  },
  qrLabel: {
    fontFamily: 'TraditionalArabic',
    color: '#7a8a8a',
    fontSize: 11,
    fontFamily: 'TraditionalArabic',
    letterSpacing: 2,
    marginBottom: 20,
  },
  qrContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8e5e0',
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
    fontFamily: 'TraditionalArabic',
    color: '#7a8a8a',
    fontSize: 13,
    fontFamily: 'TraditionalArabic',
    marginTop: 20,
  },
  ticketsSummary: {
    backgroundColor: '#f8f6f3',
    padding: 20,
  },
  ticketSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  ticketSummaryName: {
    fontFamily: 'TraditionalArabic',
    color: '#5a6a6a',
    fontSize: 14,
    fontFamily: 'TraditionalArabic',
  },
  ticketSummaryPrice: {
    fontFamily: 'TraditionalArabic',
    color: '#5a6a6a',
    fontSize: 14,
    fontFamily: 'TraditionalArabic',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#e8e5e0',
  },
  totalLabel: {
    fontFamily: 'TraditionalArabic',
    color: '#2d3a3a',
    fontSize: 16,
    fontWeight: '600',
  },
  totalValue: {
    fontFamily: 'TraditionalArabic',
    color: '#1a3a4a',
    fontSize: 20,
    fontFamily: 'TraditionalArabic',
    fontWeight: '700',
  },
  instructions: {
    marginTop: 24,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e8e5e0',
  },
  instructionsTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#2d3a3a',
    fontSize: 18,
    fontFamily: 'TraditionalArabic',
    fontWeight: '600',
    marginBottom: 18,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  instructionIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1a3a4a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionText: {
    fontFamily: 'TraditionalArabic',
    color: '#5a6a6a',
    fontSize: 14,
    fontFamily: 'TraditionalArabic',
    flex: 1,
    lineHeight: 22,
  },
});
