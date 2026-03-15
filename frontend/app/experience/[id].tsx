import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

const { width } = Dimensions.get('window');

interface TicketType {
  id: string;
  name: string;
  description: string;
  price: number;
  max_per_booking: number;
}

interface Experience {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  date: string;
  image_url: string;
  capacity: number;
  available_spots: number;
  ticket_types: TicketType[];
  time_slots?: Array<{
    id: string;
    start_time: string;
    end_time: string;
    available_spots: number;
  }>;
  duration_hours: number;
  amenities: string[];
  included: string[];
}

export default function ExperienceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const [experience, setExperience] = useState<Experience | null>(null);
  const [loading, setLoading] = useState(true);
  const [ticketCounts, setTicketCounts] = useState<{ [key: string]: number }>({});
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    if (token) {
      api.setToken(token);
    }
    loadExperience();
  }, [id, token]);

  const loadExperience = async () => {
    try {
      const data = await api.getExperience(id as string);
      setExperience(data);
      // Initialize ticket counts
      const counts: { [key: string]: number } = {};
      data.ticket_types.forEach((t: TicketType) => {
        counts[t.id] = 0;
      });
      setTicketCounts(counts);
      // Select first time slot if available
      if (data.time_slots && data.time_slots.length > 0) {
        setSelectedTimeSlot(data.time_slots[0].id);
      }
    } catch (error) {
      console.error('Error loading experience:', error);
      Alert.alert('Error', 'Failed to load experience');
    } finally {
      setLoading(false);
    }
  };

  const updateTicketCount = (ticketId: string, delta: number) => {
    if (!experience) return;
    const ticket = experience.ticket_types.find((t) => t.id === ticketId);
    if (!ticket) return;

    const currentCount = ticketCounts[ticketId] || 0;
    const newCount = Math.max(0, Math.min(ticket.max_per_booking, currentCount + delta));
    setTicketCounts({ ...ticketCounts, [ticketId]: newCount });
  };

  const getTotalPrice = () => {
    if (!experience) return 0;
    return experience.ticket_types.reduce((total, ticket) => {
      return total + (ticketCounts[ticket.id] || 0) * ticket.price;
    }, 0);
  };

  const getTotalTickets = () => {
    return Object.values(ticketCounts).reduce((sum, count) => sum + count, 0);
  };

  const handleBookNow = async () => {
    if (!user) {
      Alert.alert(
        'Sign In Required',
        'Please sign in to book this experience',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/auth/login') },
        ]
      );
      return;
    }

    if (getTotalTickets() === 0) {
      Alert.alert('Error', 'Please select at least one ticket');
      return;
    }

    setBooking(true);
    try {
      const tickets = experience!.ticket_types
        .filter((t) => ticketCounts[t.id] > 0)
        .map((t) => ({
          ticket_type_id: t.id,
          ticket_name: t.name,
          quantity: ticketCounts[t.id],
          price_per_ticket: t.price,
        }));

      const bookingData = {
        experience_id: experience!.id,
        tickets,
        time_slot_id: selectedTimeSlot || undefined,
      };

      const result = await api.createBooking(bookingData);
      router.push(`/checkout/${result.id}`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create booking');
    } finally {
      setBooking(false);
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

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#00b4d8" />
      </View>
    );
  }

  if (!experience) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.errorText}>Experience not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: experience.image_url || 'https://images.unsplash.com/photo-1531419746980-63af10612bf3?w=1200' }}
            style={styles.heroImage}
          />
          <View style={[styles.heroOverlay, { paddingTop: insets.top }]}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          {/* Category Badge */}
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>
              {experience.category.replace('_', ' ').toUpperCase()}
            </Text>
          </View>

          {/* Title and Location */}
          <Text style={styles.title}>{experience.title}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={16} color="#8899a6" />
            <Text style={styles.location}>{experience.location}</Text>
          </View>

          {/* Quick Info */}
          <View style={styles.quickInfo}>
            <View style={styles.infoItem}>
              <Ionicons name="calendar" size={20} color="#00b4d8" />
              <Text style={styles.infoText}>{formatDate(experience.date)}</Text>
            </View>
            {experience.duration_hours > 0 && (
              <View style={styles.infoItem}>
                <Ionicons name="time" size={20} color="#00b4d8" />
                <Text style={styles.infoText}>{experience.duration_hours} hours</Text>
              </View>
            )}
            <View style={styles.infoItem}>
              <Ionicons name="people" size={20} color="#00b4d8" />
              <Text style={styles.infoText}>{experience.available_spots} spots left</Text>
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.description}>{experience.description}</Text>
          </View>

          {/* What's Included */}
          {experience.included && experience.included.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What's Included</Text>
              {experience.included.map((item, idx) => (
                <View key={idx} style={styles.includedItem}>
                  <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                  <Text style={styles.includedText}>{item}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Amenities */}
          {experience.amenities && experience.amenities.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Amenities</Text>
              <View style={styles.amenitiesGrid}>
                {experience.amenities.map((amenity, idx) => (
                  <View key={idx} style={styles.amenityChip}>
                    <Text style={styles.amenityText}>{amenity}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Time Slots */}
          {experience.time_slots && experience.time_slots.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Time</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {experience.time_slots.map((slot) => (
                  <TouchableOpacity
                    key={slot.id}
                    style={[
                      styles.timeSlot,
                      selectedTimeSlot === slot.id && styles.timeSlotSelected,
                    ]}
                    onPress={() => setSelectedTimeSlot(slot.id)}
                  >
                    <Text
                      style={[
                        styles.timeSlotText,
                        selectedTimeSlot === slot.id && styles.timeSlotTextSelected,
                      ]}
                    >
                      {slot.start_time} - {slot.end_time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Ticket Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Tickets</Text>
            {experience.ticket_types.map((ticket) => (
              <View key={ticket.id} style={styles.ticketCard}>
                <View style={styles.ticketInfo}>
                  <Text style={styles.ticketName}>{ticket.name}</Text>
                  <Text style={styles.ticketDescription}>{ticket.description}</Text>
                  <Text style={styles.ticketPrice}>${ticket.price}</Text>
                </View>
                <View style={styles.ticketCounter}>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => updateTicketCount(ticket.id, -1)}
                  >
                    <Ionicons name="remove" size={20} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.counterValue}>{ticketCounts[ticket.id] || 0}</Text>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => updateTicketCount(ticket.id, 1)}
                  >
                    <Ionicons name="add" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>Total</Text>
          <Text style={styles.priceValue}>${getTotalPrice().toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.bookButton,
            (getTotalTickets() === 0 || booking) && styles.bookButtonDisabled,
          ]}
          onPress={handleBookNow}
          disabled={getTotalTickets() === 0 || booking}
        >
          {booking ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.bookButtonText}>
              {getTotalTickets() === 0 ? 'Select Tickets' : `Book Now (${getTotalTickets()})`}
            </Text>
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
  errorText: {
    color: '#fff',
    fontSize: 16,
  },
  heroContainer: {
    height: 300,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
  },
  categoryBadge: {
    backgroundColor: 'rgba(0, 180, 216, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  categoryText: {
    color: '#00b4d8',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  location: {
    color: '#8899a6',
    fontSize: 14,
  },
  quickInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    backgroundColor: '#1a2d4a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    color: '#fff',
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  description: {
    color: '#8899a6',
    fontSize: 15,
    lineHeight: 24,
  },
  includedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  includedText: {
    color: '#fff',
    fontSize: 14,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityChip: {
    backgroundColor: '#1a2d4a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  amenityText: {
    color: '#8899a6',
    fontSize: 13,
  },
  timeSlot: {
    backgroundColor: '#1a2d4a',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  timeSlotSelected: {
    borderColor: '#00b4d8',
  },
  timeSlotText: {
    color: '#8899a6',
    fontSize: 14,
    fontWeight: '500',
  },
  timeSlotTextSelected: {
    color: '#00b4d8',
  },
  ticketCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a2d4a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  ticketInfo: {
    flex: 1,
    marginRight: 16,
  },
  ticketName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  ticketDescription: {
    color: '#8899a6',
    fontSize: 13,
    marginTop: 4,
  },
  ticketPrice: {
    color: '#00b4d8',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  ticketCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  counterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#00b4d8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    minWidth: 24,
    textAlign: 'center',
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
  bookButton: {
    backgroundColor: '#00b4d8',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  bookButtonDisabled: {
    opacity: 0.5,
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
