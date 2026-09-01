import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { api } from '../../src/services/api';

export default function BalancePaymentScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const [balanceInfo, setBalanceInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBalanceInfo();
  }, [id]);

  const fetchBalanceInfo = async () => {
    try {
      setLoading(true);
      const info = await api.request(`/payment/balance-info/${id}`);
      setBalanceInfo(info);
    } catch (err) {
      setError(err.message || 'Could not load booking details');
    } finally {
      setLoading(false);
    }
  };

  const handlePayBalance = async () => {
    if (!user || !token) {
      Alert.alert(t('balance_sign_in_required'), t('balance_sign_in_message'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('sign_in'), onPress: () => router.push('/auth/login') },
      ]);
      return;
    }

    setPaying(true);
    try {
      // Create balance payment intent
      const intent = await api.request(`/payment/create-balance-intent/${id}`, {
        method: 'POST',
      });

      // For now, confirm the balance payment (in production, this would go through Stripe checkout)
      const result = await api.request(`/payment/confirm-balance/${id}`, {
        method: 'POST',
      });

      if (result.status === 'success') {
        setPaymentComplete(true);
      }
    } catch (err) {
      Alert.alert(t('balance_payment_error'), err.message || t('balance_payment_failed'));
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#1a3a4a" />
        <Text style={styles.loadingText}>{t('balance_loading')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="alert-circle-outline" size={48} color="#e74c3c" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchBalanceInfo}>
          <Text style={styles.retryButtonText}>{t('balance_retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (paymentComplete) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color="#2e7d32" />
          </View>
          <Text style={styles.successTitle}>{t('balance_payment_complete')}</Text>
          <Text style={styles.successSubtitle}>
            {t('balance_fully_confirmed')}
          </Text>

          <View style={styles.successCard}>
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>{t('balance_total_paid')}</Text>
              <Text style={styles.successValue}>€{balanceInfo?.total_amount?.toFixed(2)}</Text>
            </View>
            <View style={styles.successDivider} />
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>{t('balance_status')}</Text>
              <Text style={[styles.successValue, { color: '#2e7d32' }]}>{t('balance_fully_paid')}</Text>
            </View>
          </View>

          <View style={styles.itineraryCard}>
            <Text style={styles.itineraryTitle}>🗺 {t('balance_itinerary_title')}</Text>
            <Text style={styles.itineraryText}>
              {t('balance_itinerary_text')}
            </Text>
            <Text style={styles.itineraryItem}>• {t('balance_itinerary_departure')}</Text>
            <Text style={styles.itineraryItem}>• {t('balance_itinerary_route')}</Text>
            <Text style={styles.itineraryItem}>• {t('balance_itinerary_dietary')}</Text>
            <Text style={styles.itineraryItem}>• {t('balance_itinerary_services')}</Text>
          </View>

          <TouchableOpacity
            style={styles.homeButton}
            onPress={() => router.replace('/(tabs)')}
          >
            <Text style={styles.homeButtonText}>{t('balance_back_home')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1a3a4a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('balance_title')}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Experience Image */}
        {balanceInfo?.experience_image ? (
          <Image
            source={{ uri: balanceInfo.experience_image }}
            style={styles.experienceImage}
          />
        ) : null}

        {/* Experience Info */}
        <View style={styles.experienceCard}>
          <Text style={styles.experienceTitle}>{balanceInfo?.experience_title}</Text>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color="#7a8a8a" />
            <Text style={styles.infoText}>{balanceInfo?.experience_date}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color="#7a8a8a" />
            <Text style={styles.infoText}>{balanceInfo?.experience_location}</Text>
          </View>
        </View>

        {/* Payment Breakdown */}
        <View style={styles.breakdownCard}>
          <Text style={styles.breakdownTitle}>{t('balance_breakdown')}</Text>
          
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{t('balance_charter_total')}</Text>
            <Text style={styles.breakdownValue}>€{balanceInfo?.total_amount?.toFixed(2)}</Text>
          </View>
          
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{t('balance_deposit_paid')} ({balanceInfo?.deposit_percentage}%)</Text>
            <Text style={[styles.breakdownValue, { color: '#2e7d32' }]}>-€{balanceInfo?.deposit_amount?.toFixed(2)}</Text>
          </View>
          
          <View style={styles.breakdownDivider} />
          
          <View style={styles.balanceDueBox}>
            <Text style={styles.balanceDueLabel}>{t('balance_remaining')}</Text>
            <Text style={styles.balanceDueAmount}>€{balanceInfo?.remaining_balance?.toFixed(2)}</Text>
          </View>
        </View>

        {/* Pay Button */}
        <TouchableOpacity
          style={[styles.payButton, paying && styles.payButtonDisabled]}
          onPress={handlePayBalance}
          disabled={paying}
        >
          {paying ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="card-outline" size={20} color="#fff" />
              <Text style={styles.payButtonText}>
                {t('balance_pay')} €{balanceInfo?.remaining_balance?.toFixed(2)}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.secureText}>
          <Ionicons name="lock-closed-outline" size={12} color="#7a8a8a" /> {t('balance_secure')}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf9f7',
  },
  centered: {
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
    color: '#e74c3c',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#1a3a4a',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 20,
  },
  retryButtonText: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    color: '#1a3a4a',
    fontSize: 18,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  experienceImage: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    marginBottom: 16,
  },
  experienceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ebe8e3',
  },
  experienceTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#1a3a4a',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  infoText: {
    fontFamily: 'TraditionalArabic',
    color: '#5a6a6a',
    fontSize: 14,
  },
  breakdownCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ebe8e3',
  },
  breakdownTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#c17f59',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  breakdownLabel: {
    fontFamily: 'TraditionalArabic',
    color: '#5a6a6a',
    fontSize: 15,
  },
  breakdownValue: {
    fontFamily: 'TraditionalArabic',
    color: '#1a3a4a',
    fontSize: 15,
    fontWeight: '600',
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: '#ebe8e3',
    marginVertical: 12,
  },
  balanceDueBox: {
    backgroundColor: '#1a3a4a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceDueLabel: {
    fontFamily: 'TraditionalArabic',
    color: '#c17f59',
    fontSize: 14,
    letterSpacing: 1,
  },
  balanceDueAmount: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
  },
  payButton: {
    backgroundColor: '#c17f59',
    borderRadius: 25,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 12,
  },
  payButtonDisabled: {
    opacity: 0.7,
  },
  payButtonText: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  secureText: {
    fontFamily: 'TraditionalArabic',
    color: '#7a8a8a',
    fontSize: 12,
    textAlign: 'center',
  },
  // Success states
  successContainer: {
    padding: 30,
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: 20,
    marginTop: 40,
  },
  successTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#1a3a4a',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 10,
  },
  successSubtitle: {
    fontFamily: 'TraditionalArabic',
    color: '#5a6a6a',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  successCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    borderWidth: 2,
    borderColor: '#2e7d32',
    marginBottom: 16,
  },
  successRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  successLabel: {
    fontFamily: 'TraditionalArabic',
    color: '#5a6a6a',
    fontSize: 15,
  },
  successValue: {
    fontFamily: 'TraditionalArabic',
    color: '#1a3a4a',
    fontSize: 16,
    fontWeight: '700',
  },
  successDivider: {
    height: 1,
    backgroundColor: '#e8f5e9',
    marginVertical: 4,
  },
  itineraryCard: {
    backgroundColor: '#fff8e1',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    borderWidth: 2,
    borderColor: '#f0c14b',
    marginBottom: 24,
  },
  itineraryTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#c17f59',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  itineraryText: {
    fontFamily: 'TraditionalArabic',
    color: '#5a6a6a',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  itineraryItem: {
    fontFamily: 'TraditionalArabic',
    color: '#5a6a6a',
    fontSize: 14,
    lineHeight: 24,
    paddingLeft: 8,
  },
  homeButton: {
    backgroundColor: '#1a3a4a',
    borderRadius: 25,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  homeButtonText: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
