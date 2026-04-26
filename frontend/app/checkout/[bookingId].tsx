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
  Modal,
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
  payment_type: string;
  deposit_percentage: number;
  deposit_amount: number;
  remaining_balance: number;
}

// Web-only Stripe Card Component using @stripe/stripe-js
function WebStripeCard({ clientSecret, publishableKey, onSuccess, onError, processing, setProcessing, payLabel }: {
  clientSecret: string;
  publishableKey: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
  processing: boolean;
  setProcessing: (v: boolean) => void;
  payLabel?: string;
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
            <Text style={styles.payButtonText}>{payLabel || 'Complete Payment'}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

// Native Payment Component (API-based for Expo Go compatibility)
function NativePaymentCard({ bookingId, onSuccess, onError, processing, setProcessing, payLabel }: {
  bookingId: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
  processing: boolean;
  setProcessing: (v: boolean) => void;
  payLabel?: string;
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
      <Text style={styles.sectionLabel}>{t('checkout_payment')}</Text>
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
            <Text style={styles.payButtonText}>{payLabel || 'Complete Payment'}</Text>
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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

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
    
    const isDeposit = booking!.payment_type === 'deposit';
    const successTitle = isDeposit ? t('checkout_deposit_received') : t('checkout_payment_success');
    const successMessage = isDeposit 
      ? t('checkout_deposit_message')
      : t('checkout_booking_confirmed');
    
    if (Platform.OS === 'web') {
      window.alert(`${successTitle}\n\n${successMessage}`);
      router.replace(`/ticket/${booking!.id}`);
    } else {
      Alert.alert(
        successTitle,
        successMessage,
        [{ text: t('checkout_view_ticket_btn'), onPress: () => router.replace(`/ticket/${booking!.id}`) }]
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

  if (booking.payment_status === 'paid' || booking.payment_status === 'deposit_paid') {
    const isDepositPaid = booking.payment_status === 'deposit_paid';
    return (
      <View style={[styles.container, styles.centerContent]}>
        <View style={styles.successCircle}>
          <Ionicons name="checkmark" size={40} color="#fff" />
        </View>
        <Text style={styles.successTitle}>
          {isDepositPaid ? t('checkout_deposit_confirmed') : (t('checkout_already_paid') || 'Already Paid')}
        </Text>
        <Text style={styles.successSubtext}>
          {isDepositPaid 
            ? t('checkout_deposit_dates_blocked')
            : (t('checkout_already_paid_text') || 'This booking is confirmed.')}
        </Text>
        {isDepositPaid && booking.remaining_balance > 0 && (
          <Text style={[styles.successSubtext, { marginTop: 4, color: '#1a3a4a', fontWeight: '600' }]}>
            {t('checkout_remaining_balance')}: €{booking.remaining_balance.toFixed(2)}
          </Text>
        )}
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

        {/* Deposit Notice - only for charter bookings */}
        {booking.payment_type === 'deposit' && booking.deposit_amount > 0 && (
          <View style={styles.depositCard}>
            <View style={styles.depositBanner}>
              <Ionicons name="boat-outline" size={22} color="#fff" />
              <Text style={styles.depositBannerText}>{booking.deposit_percentage}% {t('checkout_deposit_needed')}</Text>
            </View>
            <Text style={styles.depositSubtext}>
              {t('checkout_charter_bookings')}
            </Text>
            <Text style={[styles.depositSubtext, { marginTop: 2, fontSize: 13 }]}>
              {t('checkout_deposit_block_dates')}
            </Text>
            <View style={styles.depositBreakdown}>
              <View style={styles.depositRow}>
                <Text style={styles.depositLabel}>{t('checkout_charter_total')}</Text>
                <Text style={styles.depositValue}>€{booking.total_amount.toFixed(2)}</Text>
              </View>
              <View style={styles.depositRowHighlight}>
                <Text style={styles.depositLabelBold}>{booking.deposit_percentage}% {t('checkout_deposit_due')}</Text>
                <Text style={styles.depositValueBold}>€{booking.deposit_amount.toFixed(2)}</Text>
              </View>
              <View style={styles.depositDivider} />
              <View style={styles.depositRow}>
                <Text style={styles.depositLabelMuted}>{t('checkout_remaining_balance')}</Text>
                <Text style={styles.depositValueMuted}>€{booking.remaining_balance.toFixed(2)}</Text>
              </View>
            </View>
            <View style={styles.depositNote}>
              <Ionicons name="information-circle-outline" size={16} color="#7a8a8a" />
              <Text style={styles.depositNoteText}>
                {t('checkout_remaining_note')}
              </Text>
            </View>
          </View>
        )}

        {/* Terms & Conditions */}
        <View style={styles.termsSection}>
          <TouchableOpacity
            style={styles.termsCheckRow}
            onPress={() => setTermsAccepted(!termsAccepted)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
              {termsAccepted && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={styles.termsCheckText}>
              {t('terms_i_accept')}{' '}
              <Text
                style={styles.termsLink}
                onPress={() => setShowTermsModal(true)}
              >
                {t('terms_title')}
              </Text>
            </Text>
          </TouchableOpacity>
          {!termsAccepted && (
            <Text style={styles.termsRequired}>{t('terms_required')}</Text>
          )}
        </View>

        {/* Terms & Conditions Modal */}
        <Modal
          visible={showTermsModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowTermsModal(false)}
        >
          <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('terms_title')}</Text>
              <TouchableOpacity onPress={() => setShowTermsModal(false)}>
                <Ionicons name="close" size={28} color="#1a3a4a" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={true}>
              <Text style={styles.termsHeading}>WANDERING YACHT — TERMS & CONDITIONS</Text>
              <Text style={styles.termsDate}>Effective Date: January 1, 2025</Text>

              <Text style={styles.termsSectionTitle}>1. ASSUMPTION OF RISK & LIABILITY WAIVER</Text>
              <Text style={styles.termsBody}>
                By booking and participating in any experience, charter, tour, or activity ("Experience") offered by Wandering Yacht d.o.o. ("Company"), you acknowledge and accept that such activities involve inherent risks including, but not limited to, risks associated with water-based activities, boating, swimming, adverse weather conditions, physical exertion, wildlife encounters, and transportation by land or sea.{'\n\n'}
                You voluntarily assume all risks of personal injury, illness, death, or property damage arising from your participation. The Company, its owners, directors, officers, employees, agents, contractors, guides, captains, crew members, and affiliates shall not be held liable for any injury, loss, damage, or expense of any kind, whether direct or indirect, arising from or related to your participation in any Experience.{'\n\n'}
                This waiver applies to all claims, including but not limited to negligence, breach of contract, or breach of statutory duty, to the fullest extent permitted by applicable law.
              </Text>

              <Text style={styles.termsSectionTitle}>2. MEDICAL FITNESS & PERSONAL RESPONSIBILITY</Text>
              <Text style={styles.termsBody}>
                Participants must be in adequate physical and mental health to take part in the booked Experience. You are responsible for disclosing any medical conditions, allergies, dietary restrictions, mobility limitations, or other health concerns that may affect your participation.{'\n\n'}
                The Company reserves the right to refuse participation to any individual deemed unfit for safety reasons, without refund.{'\n\n'}
                Participants must follow all safety instructions provided by guides, captains, and crew at all times. Failure to comply may result in immediate removal from the Experience without refund.
              </Text>

              <Text style={styles.termsSectionTitle}>3. WEATHER & ITINERARY CHANGES</Text>
              <Text style={styles.termsBody}>
                Experiences may be modified, rerouted, or relocated due to weather conditions, sea state, mechanical issues, or other factors beyond the Company's control. The Company reserves the right to alter itineraries, change departure times, substitute vessels, or move activities to alternative indoor or outdoor locations as necessary for safety.{'\n\n'}
                No refunds will be issued for itinerary modifications made in the interest of safety. In cases of full cancellation by the Company due to extreme weather or force majeure, a full reschedule or credit will be offered.
              </Text>

              <Text style={styles.termsSectionTitle}>4. CANCELLATION & REFUND POLICY</Text>
              <Text style={styles.termsBody}>
                • Cancellations made 72+ hours before the Experience: Full refund minus processing fees.{'\n'}
                • Cancellations made 24–72 hours before: 50% refund.{'\n'}
                • Cancellations made less than 24 hours before or no-shows: No refund.{'\n'}
                • Deposit payments are non-refundable unless the Company cancels the Experience.{'\n\n'}
                The Company reserves the right to cancel any Experience at its sole discretion for safety, operational, or logistical reasons, in which case a full refund or reschedule will be provided.
              </Text>

              <Text style={styles.termsSectionTitle}>5. PRIVACY & DATA PROTECTION</Text>
              <Text style={styles.termsBody}>
                Wandering Yacht is committed to protecting your personal information. We collect personal data (name, email, phone number, WhatsApp number, payment details) solely for the purpose of processing bookings, communicating about your Experiences, and improving our services.{'\n\n'}
                We will never sell, rent, or share your personal information with third parties for marketing purposes. Your data may only be shared with trusted service providers (payment processors, email services) strictly necessary to fulfil your booking.{'\n\n'}
                You may request access to, correction of, or deletion of your personal data at any time by contacting booking@wanderingyacht.com.
              </Text>

              <Text style={styles.termsSectionTitle}>6. PHOTOGRAPHY & MEDIA</Text>
              <Text style={styles.termsBody}>
                The Company may take photographs or video during Experiences for promotional purposes. By participating, you grant the Company a non-exclusive, royalty-free license to use such media. If you do not wish to be photographed, please inform your guide or captain at the start of the Experience.
              </Text>

              <Text style={styles.termsSectionTitle}>7. ALCOHOL & SUBSTANCE POLICY</Text>
              <Text style={styles.termsBody}>
                Where alcoholic beverages are included in an Experience (e.g., wine tastings), consumption is at your own risk. The Company is not responsible for any incidents arising from alcohol consumption. Participants must be of legal drinking age. The Company reserves the right to refuse service to intoxicated individuals.
              </Text>

              <Text style={styles.termsSectionTitle}>8. MINORS</Text>
              <Text style={styles.termsBody}>
                Participants under the age of 18 must be accompanied by a parent or legal guardian who accepts these Terms & Conditions on their behalf. The accompanying adult assumes full responsibility for the minor's safety and conduct.
              </Text>

              <Text style={styles.termsSectionTitle}>9. PERSONAL BELONGINGS</Text>
              <Text style={styles.termsBody}>
                The Company is not responsible for any loss, theft, or damage to personal belongings, including electronic devices, jewellery, or other valuables, during any Experience. Participants are advised to leave valuables in a secure location.
              </Text>

              <Text style={styles.termsSectionTitle}>10. FORCE MAJEURE</Text>
              <Text style={styles.termsBody}>
                The Company shall not be liable for any failure or delay in performing obligations due to events beyond its reasonable control, including but not limited to natural disasters, pandemics, government restrictions, civil unrest, strikes, or severe weather events.
              </Text>

              <Text style={styles.termsSectionTitle}>11. GOVERNING LAW</Text>
              <Text style={styles.termsBody}>
                These Terms & Conditions are governed by and construed in accordance with the laws of Montenegro. Any disputes arising from these terms shall be subject to the exclusive jurisdiction of the courts of Montenegro.
              </Text>

              <Text style={styles.termsSectionTitle}>12. CONTACT</Text>
              <Text style={styles.termsBody}>
                For questions regarding these Terms & Conditions, please contact:{'\n'}
                Wandering Yacht{'\n'}
                Email: booking@wanderingyacht.com
              </Text>

              <View style={{ height: 40 }} />
            </ScrollView>
            <View style={[styles.modalFooter, { paddingBottom: insets.bottom + 16 }]}>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => {
                  setTermsAccepted(true);
                  setShowTermsModal(false);
                }}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.acceptButtonText}>{t('terms_accept')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Payment - Platform-specific */}
        {clientSecret && publishableKey && termsAccepted ? (
          <>
            {Platform.OS === 'web' && (
              <WebStripeCard
                clientSecret={clientSecret}
                publishableKey={publishableKey}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                processing={processing}
                setProcessing={setProcessing}
                payLabel={booking.payment_type === 'deposit' ? `${t('checkout_pay_deposit')} — €${booking.deposit_amount.toFixed(2)}` : t('checkout_payment')}
              />
            )}
            {Platform.OS !== 'web' && (
              <NativePaymentCard
                bookingId={booking.id}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                processing={processing}
                setProcessing={setProcessing}
                payLabel={booking.payment_type === 'deposit' ? `${t('checkout_pay_deposit')} — €${booking.deposit_amount.toFixed(2)}` : t('checkout_payment')}
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
  // Deposit styles
  depositCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#1a3a4a',
    overflow: 'hidden',
  },
  depositBanner: {
    backgroundColor: '#1a3a4a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  depositBannerText: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
  depositSubtext: {
    fontFamily: 'TraditionalArabic',
    color: '#5a6a6a',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },
  depositBreakdown: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  depositRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  depositRowHighlight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#e8f4f4',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 4,
  },
  depositLabel: {
    fontFamily: 'TraditionalArabic',
    color: '#5a6a6a',
    fontSize: 15,
  },
  depositValue: {
    fontFamily: 'TraditionalArabic',
    color: '#5a6a6a',
    fontSize: 15,
  },
  depositLabelBold: {
    fontFamily: 'TraditionalArabic',
    color: '#1a3a4a',
    fontSize: 16,
    fontWeight: '700',
  },
  depositValueBold: {
    fontFamily: 'TraditionalArabic',
    color: '#1a3a4a',
    fontSize: 20,
    fontWeight: '700',
  },
  depositDivider: {
    height: 1,
    backgroundColor: '#e8e5e0',
    marginVertical: 4,
  },
  depositLabelMuted: {
    fontFamily: 'TraditionalArabic',
    color: '#a0aab0',
    fontSize: 14,
  },
  depositValueMuted: {
    fontFamily: 'TraditionalArabic',
    color: '#a0aab0',
    fontSize: 14,
  },
  depositNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 4,
  },
  depositNoteText: {
    fontFamily: 'TraditionalArabic',
    color: '#7a8a8a',
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
  // Terms & Conditions styles
  termsSection: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
  },
  termsCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#c0c8c8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#1a3a4a',
    borderColor: '#1a3a4a',
  },
  termsCheckText: {
    fontFamily: 'TraditionalArabic',
    color: '#2d3a3a',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  termsLink: {
    color: '#0077b6',
    textDecorationLine: 'underline' as const,
    fontWeight: '600' as const,
  },
  termsRequired: {
    fontFamily: 'TraditionalArabic',
    color: '#e53e3e',
    fontSize: 12,
    marginTop: 8,
    marginLeft: 36,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f6f3',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e5e0',
  },
  modalTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 18,
    fontWeight: '700',
    color: '#1a3a4a',
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  termsHeading: {
    fontFamily: 'TraditionalArabic',
    fontSize: 18,
    fontWeight: '700',
    color: '#1a3a4a',
    textAlign: 'center',
    marginBottom: 4,
  },
  termsDate: {
    fontFamily: 'TraditionalArabic',
    fontSize: 13,
    color: '#7a8a8a',
    textAlign: 'center',
    marginBottom: 24,
  },
  termsSectionTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 15,
    fontWeight: '700',
    color: '#1a3a4a',
    marginTop: 20,
    marginBottom: 8,
  },
  termsBody: {
    fontFamily: 'TraditionalArabic',
    fontSize: 14,
    color: '#3d4a4a',
    lineHeight: 22,
  },
  modalFooter: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e8e5e0',
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1a3a4a',
    paddingVertical: 16,
    borderRadius: 28,
  },
  acceptButtonText: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
