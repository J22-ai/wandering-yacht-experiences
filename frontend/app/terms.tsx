import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function TermsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1a2a30" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={true} contentContainerStyle={{ paddingBottom: 60 }}>
        <Text style={styles.heading}>WANDERING YACHT — TERMS & CONDITIONS</Text>
        <Text style={styles.date}>Effective Date: January 1, 2025</Text>

        <Text style={styles.sectionTitle}>1. ASSUMPTION OF RISK & LIABILITY WAIVER</Text>
        <Text style={styles.bodyText}>
          By booking and participating in any experience, charter, tour, or activity ("Experience") offered by Wandering Yacht d.o.o. ("Company"), you acknowledge and accept that such activities involve inherent risks including, but not limited to, risks associated with water-based activities, boating, swimming, adverse weather conditions, physical exertion, wildlife encounters, and transportation by land or sea.{'\n\n'}
          You voluntarily assume all risks of personal injury, illness, death, or property damage arising from your participation. The Company, its owners, directors, officers, employees, agents, contractors, guides, captains, crew members, and affiliates shall not be held liable for any injury, loss, damage, or expense of any kind, whether direct or indirect, arising from or related to your participation in any Experience.{'\n\n'}
          This waiver applies to all claims, including but not limited to negligence, breach of contract, or breach of statutory duty, to the fullest extent permitted by applicable law.
        </Text>

        <Text style={styles.sectionTitle}>2. MEDICAL FITNESS & PERSONAL RESPONSIBILITY</Text>
        <Text style={styles.bodyText}>
          Participants must be in adequate physical and mental health to take part in the booked Experience. You are responsible for disclosing any medical conditions, allergies, dietary restrictions, mobility limitations, or other health concerns that may affect your participation.{'\n\n'}
          The Company reserves the right to refuse participation to any individual deemed unfit for safety reasons, without refund.{'\n\n'}
          Participants must follow all safety instructions provided by guides, captains, and crew at all times. Failure to comply may result in immediate removal from the Experience without refund.
        </Text>

        <Text style={styles.sectionTitle}>3. WEATHER & ITINERARY CHANGES</Text>
        <Text style={styles.bodyText}>
          Experiences may be modified, rerouted, or relocated due to weather conditions, sea state, mechanical issues, or other factors beyond the Company's control. The Company reserves the right to alter itineraries, change departure times, substitute vessels, or move activities to alternative indoor or outdoor locations as necessary for safety.{'\n\n'}
          No refunds will be issued for itinerary modifications made in the interest of safety. In cases of full cancellation by the Company due to extreme weather or force majeure, a full reschedule or credit will be offered.
        </Text>

        <Text style={styles.sectionTitle}>4. CANCELLATION & REFUND POLICY</Text>
        <Text style={styles.bodyText}>
          • Cancellations made 72+ hours before the Experience: Full refund minus processing fees.{'\n'}
          • Cancellations made 24–72 hours before: 50% refund.{'\n'}
          • Cancellations made less than 24 hours before or no-shows: No refund.{'\n'}
          • Deposit payments are non-refundable unless the Company cancels the Experience.{'\n\n'}
          Bad Weather Cancellation: Cancellations due to bad weather are accepted only for the day before the booking. Same-day weather cancellations are not eligible for refund.{'\n\n'}
          The Company reserves the right to cancel any Experience at its sole discretion for safety, operational, or logistical reasons, in which case a full refund or reschedule will be provided.
        </Text>

        <Text style={styles.sectionTitle}>5. PRIVACY & DATA PROTECTION</Text>
        <Text style={styles.bodyText}>
          Wandering Yacht is committed to protecting your personal information. We collect personal data (name, email, phone number, WhatsApp number, payment details) solely for the purpose of processing bookings, communicating about your Experiences, and improving our services.{'\n\n'}
          We will never sell, rent, or share your personal information with third parties for marketing purposes. Your data may only be shared with trusted service providers (payment processors, email services) strictly necessary to fulfil your booking.{'\n\n'}
          You may request access to, correction of, or deletion of your personal data at any time by contacting booking@wanderingyacht.com.
        </Text>

        <Text style={styles.sectionTitle}>6. PHOTOGRAPHY & MEDIA</Text>
        <Text style={styles.bodyText}>
          The Company may take photographs or video during Experiences for promotional purposes. By participating, you grant the Company a non-exclusive, royalty-free license to use such media. If you do not wish to be photographed, please inform your guide or captain at the start of the Experience.
        </Text>

        <Text style={styles.sectionTitle}>7. ALCOHOL & SUBSTANCE POLICY</Text>
        <Text style={styles.bodyText}>
          Where alcoholic beverages are included in an Experience (e.g., wine tastings), consumption is at your own risk. The Company is not responsible for any incidents arising from alcohol consumption. Participants must be of legal drinking age. The Company reserves the right to refuse service to intoxicated individuals.
        </Text>

        <Text style={styles.sectionTitle}>8. MINORS</Text>
        <Text style={styles.bodyText}>
          Participants under the age of 18 must be accompanied by a parent or legal guardian who accepts these Terms & Conditions on their behalf. The accompanying adult assumes full responsibility for the minor's safety and conduct.
        </Text>

        <Text style={styles.sectionTitle}>9. PERSONAL BELONGINGS</Text>
        <Text style={styles.bodyText}>
          The Company is not responsible for any loss, theft, or damage to personal belongings, including electronic devices, jewellery, or other valuables, during any Experience. Participants are advised to leave valuables in a secure location.
        </Text>

        <Text style={styles.sectionTitle}>10. FORCE MAJEURE</Text>
        <Text style={styles.bodyText}>
          The Company shall not be liable for any failure or delay in performing obligations due to events beyond its reasonable control, including but not limited to natural disasters, pandemics, government restrictions, civil unrest, strikes, or severe weather events.
        </Text>

        <Text style={styles.sectionTitle}>11. GOVERNING LAW</Text>
        <Text style={styles.bodyText}>
          These Terms & Conditions are governed by and construed in accordance with the laws of Montenegro. Any disputes arising from these terms shall be subject to the exclusive jurisdiction of the courts of Montenegro.
        </Text>

        <Text style={styles.sectionTitle}>12. CONTACT</Text>
        <Text style={styles.bodyText}>
          For questions regarding these Terms & Conditions, please contact:{'\n'}
          Wandering Yacht{'\n'}
          Email: booking@wanderingyacht.com
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f2ed',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e0ddd7',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 18,
    fontWeight: '600',
    color: '#1a2a30',
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
  },
  heading: {
    fontFamily: 'TraditionalArabic',
    fontSize: 22,
    fontWeight: '700',
    color: '#1a2a30',
    marginTop: 24,
    marginBottom: 4,
  },
  date: {
    fontFamily: 'TraditionalArabic',
    fontSize: 13,
    color: '#9ca3a3',
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 16,
    fontWeight: '700',
    color: '#1a3a4a',
    marginTop: 20,
    marginBottom: 8,
  },
  bodyText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 14,
    color: '#4a5568',
    lineHeight: 22,
  },
});
