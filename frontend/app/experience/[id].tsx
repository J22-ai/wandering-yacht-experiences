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
  Linking,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { useFavorites } from '../../src/context/FavoritesContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { getTranslatedExperience } from '../../src/i18n/experienceTranslations';
import { translateContent } from '../../src/i18n/contentTranslations';

const { width } = Dimensions.get('window');

const openMapLink = (location: string) => {
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  if (Platform.OS === 'web') {
    try {
      (window.top || window.parent || window).open(mapUrl, '_blank');
    } catch {
      window.open(mapUrl, '_blank');
    }
  } else {
    // Try native maps app first, fall back to browser
    const nativeUrl = Platform.OS === 'ios'
      ? `maps:?q=${encodeURIComponent(location)}`
      : `geo:0,0?q=${encodeURIComponent(location)}`;
    Linking.canOpenURL(nativeUrl).then((supported) => {
      if (supported) {
        Linking.openURL(nativeUrl);
      } else {
        Linking.openURL(mapUrl);
      }
    });
  }
};

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
  requires_deposit?: boolean;
  deposit_percentage?: number;
}

export default function ExperienceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const { toggleFavorite, isFavorite } = useFavorites();
  const { t, language } = useLanguage();
  const [experience, setExperience] = useState<Experience | null>(null);
  const [loading, setLoading] = useState(true);
  const [ticketCounts, setTicketCounts] = useState<{ [key: string]: number }>({});
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
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
        t('detail_sign_in_required'),
        t('auth_sign_in_subtitle'),
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('sign_in'), onPress: () => router.push('/auth/login') },
        ]
      );
      return;
    }

    if (getTotalTickets() === 0) {
      Alert.alert(t('error'), t('detail_select_tickets'));
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

  const getCategoryLabel = (category: string) => {
    const catKeyMap: { [key: string]: string } = {
      'water_adventures': 'cat_water_adventures',
      'yacht_experiences': 'cat_wellness_on_deck',
      'culinary_tours': 'cat_culinary_excursions',
      'nature_escapes': 'cat_nature_escapes',
      'concierge_services': 'cat_concierge_services',
      'weddings_events': 'cat_weddings_events',
      'experiences': 'cat_experiences',
    };
    if (catKeyMap[category]) return t(catKeyMap[category]);
    return category.replace(/[_-]/g, ' ');
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#1a3a4a" />
      </View>
    );
  }

  if (!experience) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.errorText}>{t('detail_not_found')}</Text>
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
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              activeOpacity={0.6}
            >
              <Ionicons name="arrow-back" size={24} color="#1a2a30" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareButton} onPress={() => experience && toggleFavorite(experience.id)}>
              <Ionicons
                name={experience && isFavorite(experience.id) ? 'heart' : 'heart-outline'}
                size={24}
                color={experience && isFavorite(experience.id) ? '#e74c3c' : '#1a2a30'}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          {/* Category Badge */}
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>
              {getCategoryLabel(experience.category).toUpperCase()}
            </Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{getTranslatedExperience(language, experience.title)?.title || experience.title}</Text>
          
          {/* Location - Clickable to open maps */}
          <TouchableOpacity
            style={styles.locationRow}
            onPress={() => openMapLink(experience.location)}
            activeOpacity={0.7}
          >
            <Ionicons name="location-outline" size={18} color="#c17f59" />
            <Text style={styles.location}>{experience.location}</Text>
            <Ionicons name="open-outline" size={14} color="#c17f59" />
          </TouchableOpacity>

          {/* Quick Info Cards */}
          <View style={styles.quickInfo}>
            {experience.duration_hours > 0 && (
              <View style={styles.infoCard}>
                <Ionicons name="time-outline" size={22} color="#1a3a4a" />
                <Text style={styles.infoLabel}>{t('detail_duration')}</Text>
                <Text style={styles.infoValue}>
                  {experience.duration_hours >= 1 ? `${experience.duration_hours} ${experience.duration_hours > 1 ? t('detail_hours') : t('detail_hour')}` : `${Math.round(experience.duration_hours * 60)} ${t('detail_minutes')}`}
                </Text>
              </View>
            )}
            <View style={styles.infoCard}>
              <Ionicons name="people-outline" size={22} color="#1a3a4a" />
              <Text style={styles.infoLabel}>{t('detail_available_spots')}</Text>
              <Text style={styles.infoValue}>{experience.available_spots} {t('detail_spots')}</Text>
            </View>
          </View>

          {/* Select Date - Calendar */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('detail_select_date')}</Text>
            <View style={styles.calendarContainer}>
              <Calendar
                minDate={new Date().toISOString().split('T')[0]}
                onDayPress={(day: any) => setSelectedDate(day.dateString)}
                markedDates={{
                  [selectedDate]: {
                    selected: true,
                    selectedColor: '#1a3a4a',
                    selectedTextColor: '#fff',
                  },
                }}
                theme={{
                  backgroundColor: '#fff',
                  calendarBackground: '#fff',
                  textSectionTitleColor: '#7a8a8a',
                  selectedDayBackgroundColor: '#1a3a4a',
                  selectedDayTextColor: '#fff',
                  todayTextColor: '#1a3a4a',
                  dayTextColor: '#1a2a30',
                  textDisabledColor: '#d0d0d0',
                  arrowColor: '#1a3a4a',
                  monthTextColor: '#1a2a30',
                  textMonthFontWeight: '600',
                  textDayFontSize: 14,
                  textMonthFontSize: 16,
                  textDayHeaderFontSize: 13,
                  textDayFontFamily: 'TraditionalArabic',
                  textMonthFontFamily: 'TraditionalArabic',
                  textDayHeaderFontFamily: 'TraditionalArabic',
                }}
              />
            </View>
            {selectedDate ? (
              <Text style={styles.selectedDateText}>
                Selected: {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </Text>
            ) : (
              <Text style={styles.selectDateHint}>{t('detail_tap_date')}</Text>
            )}
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('detail_about')}</Text>
            <Text style={styles.description}>{getTranslatedExperience(language, experience.title)?.description || experience.description}</Text>
          </View>

          {/* What's Included */}
          {experience.included && experience.included.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('detail_whats_included')}</Text>
              <View style={styles.includedList}>
                {experience.included.map((item, idx) => (
                  <View key={idx} style={styles.includedItem}>
                    <View style={styles.checkCircle}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                    <Text style={styles.includedText}>{translateContent(language, item)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Amenities */}
          {experience.amenities && experience.amenities.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('detail_amenities')}</Text>
              <View style={styles.amenitiesGrid}>
                {experience.amenities.map((amenity, idx) => (
                  <View key={idx} style={styles.amenityChip}>
                    <Text style={styles.amenityText}>{translateContent(language, amenity)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Time Slots */}
          {experience.time_slots && experience.time_slots.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('detail_select_time')}</Text>
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
            <Text style={styles.sectionTitle}>{t('detail_select_tickets')}</Text>
            {experience.ticket_types.map((ticket) => (
              <View key={ticket.id} style={styles.ticketCard}>
                <View style={styles.ticketInfo}>
                  <Text style={styles.ticketName}>{translateContent(language, ticket.name)}</Text>
                  <Text style={styles.ticketDescription}>{translateContent(language, ticket.description)}</Text>
                  <Text style={styles.ticketPrice}>€{ticket.price}</Text>
                </View>
                <View style={styles.ticketCounter}>
                  <TouchableOpacity
                    style={[
                      styles.counterButton,
                      ticketCounts[ticket.id] === 0 && styles.counterButtonDisabled,
                    ]}
                    onPress={() => updateTicketCount(ticket.id, -1)}
                    disabled={ticketCounts[ticket.id] === 0}
                  >
                    <Ionicons name="remove" size={18} color={ticketCounts[ticket.id] === 0 ? '#c4c9c9' : '#1a3a4a'} />
                  </TouchableOpacity>
                  <Text style={styles.counterValue}>{ticketCounts[ticket.id] || 0}</Text>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => updateTicketCount(ticket.id, 1)}
                  >
                    <Ionicons name="add" size={18} color="#1a3a4a" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          {/* Deposit Notice for charter experiences */}
          {experience.requires_deposit && (
            <View style={styles.depositNotice}>
              <View style={styles.depositNoticeHeader}>
                <Ionicons name="boat-outline" size={18} color="#1a3a4a" />
                <Text style={styles.depositNoticeTitle}>DEPOSIT OF {experience.deposit_percentage || 30}% NEEDED TODAY</Text>
              </View>
              <Text style={styles.depositNoticeText}>
                A {experience.deposit_percentage || 30}% deposit is required to proceed with your booking and block your dates immediately. The remaining balance will be invoiced separately.
              </Text>
            </View>
          )}

          <View style={{ height: 140 }} />
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>{t('detail_total')}</Text>
          <Text style={styles.priceValue}>€{getTotalPrice().toFixed(2)}</Text>
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
            <>
              <Text style={styles.bookButtonText}>
                {getTotalTickets() === 0 ? t('detail_select_tickets') : t('detail_book_now')}
              </Text>
              {getTotalTickets() > 0 && (
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              )}
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
    backgroundColor: '#faf9f7',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontFamily: 'TraditionalArabic',
    color: '#1a2a30',
    fontSize: 16,
    fontFamily: 'TraditionalArabic',
  },
  heroContainer: {
    height: 320,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    zIndex: 10,
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
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
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
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  content: {
    padding: 20,
    marginTop: -30,
    backgroundColor: '#faf9f7',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  categoryBadge: {
    backgroundColor: '#e8f4f4',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  categoryText: {
    fontFamily: 'TraditionalArabic',
    color: '#1a3a4a',
    fontSize: 11,
    fontFamily: 'TraditionalArabic',
    fontWeight: '600',
    letterSpacing: 1,
  },
  title: {
    fontFamily: 'TraditionalArabic',
    color: '#1a2a30',
    fontSize: 28,
    fontFamily: 'TraditionalArabic',
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 34,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
  },
  location: {
    fontFamily: 'TraditionalArabic',
    color: '#7a8a8a',
    fontSize: 15,
    fontFamily: 'TraditionalArabic',
  },
  quickInfo: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8e5e0',
  },
  infoLabel: {
    fontFamily: 'TraditionalArabic',
    color: '#7a8a8a',
    fontSize: 12,
    fontFamily: 'TraditionalArabic',
    marginTop: 8,
  },
  infoValue: {
    fontFamily: 'TraditionalArabic',
    color: '#1a2a30',
    fontSize: 13,
    fontFamily: 'TraditionalArabic',
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#1a2a30',
    fontSize: 20,
    fontFamily: 'TraditionalArabic',
    fontWeight: '600',
    marginBottom: 16,
  },
  calendarContainer: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e8e5e0',
  },
  selectedDateText: {
    fontFamily: 'TraditionalArabic',
    color: '#1a3a4a',
    fontSize: 15,
    fontFamily: 'TraditionalArabic',
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  selectDateHint: {
    fontFamily: 'TraditionalArabic',
    color: '#9ca3a3',
    fontSize: 14,
    fontFamily: 'TraditionalArabic',
    marginTop: 10,
    textAlign: 'center',
  },
  description: {
    fontFamily: 'TraditionalArabic',
    color: '#5a6a6a',
    fontSize: 15,
    fontFamily: 'TraditionalArabic',
    lineHeight: 24,
  },
  includedList: {
    gap: 12,
  },
  includedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1a3a4a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  includedText: {
    fontFamily: 'TraditionalArabic',
    color: '#1a2a30',
    fontSize: 15,
    fontFamily: 'TraditionalArabic',
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  amenityChip: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e8e5e0',
  },
  amenityText: {
    fontFamily: 'TraditionalArabic',
    color: '#5a6a6a',
    fontSize: 14,
    fontFamily: 'TraditionalArabic',
  },
  timeSlot: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#e8e5e0',
  },
  timeSlotSelected: {
    borderColor: '#1a3a4a',
    backgroundColor: '#e8f4f4',
  },
  timeSlotText: {
    fontFamily: 'TraditionalArabic',
    color: '#7a8a8a',
    fontSize: 14,
    fontFamily: 'TraditionalArabic',
    fontWeight: '500',
  },
  timeSlotTextSelected: {
    color: '#1a3a4a',
  },
  ticketCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e8e5e0',
  },
  ticketInfo: {
    flex: 1,
    marginRight: 16,
  },
  ticketName: {
    fontFamily: 'TraditionalArabic',
    color: '#1a2a30',
    fontSize: 17,
    fontFamily: 'TraditionalArabic',
    fontWeight: '600',
  },
  ticketDescription: {
    fontFamily: 'TraditionalArabic',
    color: '#7a8a8a',
    fontSize: 13,
    fontFamily: 'TraditionalArabic',
    marginTop: 4,
  },
  ticketPrice: {
    fontFamily: 'TraditionalArabic',
    color: '#1a3a4a',
    fontSize: 20,
    fontFamily: 'TraditionalArabic',
    fontWeight: '700',
    marginTop: 8,
  },
  ticketCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  counterButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f0ebe4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterButtonDisabled: {
    opacity: 0.5,
  },
  counterValue: {
    fontFamily: 'TraditionalArabic',
    color: '#1a2a30',
    fontSize: 18,
    fontFamily: 'TraditionalArabic',
    fontWeight: '600',
    minWidth: 28,
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
    fontFamily: 'TraditionalArabic',
  },
  priceValue: {
    fontFamily: 'TraditionalArabic',
    color: '#1a2a30',
    fontSize: 26,
    fontFamily: 'TraditionalArabic',
    fontWeight: '700',
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a3a4a',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 28,
    gap: 8,
  },
  bookButtonDisabled: {
    opacity: 0.5,
  },
  bookButtonText: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Deposit notice styles
  depositNotice: {
    backgroundColor: '#f0f7f7',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#1a3a4a',
    padding: 16,
    marginTop: 8,
  },
  depositNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  depositNoticeTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#1a3a4a',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  depositNoticeText: {
    fontFamily: 'TraditionalArabic',
    color: '#5a6a6a',
    fontSize: 13,
    lineHeight: 20,
  },
});
