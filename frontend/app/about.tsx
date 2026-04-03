import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <Ionicons name="arrow-back" size={22} color="#1a3a4a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About Us</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Logo */}
        <View style={styles.logoSection}>
          <Image
            source={require('../assets/images/wy-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* About Content */}
        <View style={styles.aboutSection}>
          <Text style={styles.sectionLabel}>ABOUT US</Text>
          <Text style={styles.sectionTitle}>Wandering Yacht</Text>
          <View style={styles.divider} />
          <Text style={styles.bodyText}>
            Born from the love of the sea, experiencing Yacht Chartering during summer holidays and intrigued by the way water connects us all to life; Wandering Yacht was born. Starting in a strategic location between London and Dubai, the first location started in Porto Montenegro, Tivat, Montenegro. The worlds most luxurious port, which has everything to travel to, embark on a journey from and return to, after a sea voyage is completed. Our incredible team has curated immersive excursions for those who seek heartfelt adventures both on land and on the water. Starting with Sunrise Yoga on luxury decks to Wild Beauty afternoon Fiat drives through hidden mountain roads. We craft journeys that awaken the senses and create lasting memories, surprising those that believe they have 'seen it all'. Everything we design is sustainably connected to Luxury intertwined with Nature.
          </Text>
          <Text style={styles.bodyText}>
            We are mainly a YACHT MANAGEMENT, YACHT CHARTER and YACHT SALES SPECIALIST. For booking a Yacht Charter, Boat Rental for a weekly experience please visit our website or contact us directly.
          </Text>
          <Text style={styles.bodyText}>
            We are stationed in 5 locations of the world: USA, SPAIN, MONTENEGRO, UAE, SINGAPORE. Covering almost every Sea, Ocean and Waterway globally. Soon our other regional experiences will be found right here, so keep checking in on us.
          </Text>
          <Text style={styles.welcomeText}>
            Welcome to the World of Wandering Yacht!
          </Text>
        </View>

        {/* Links */}
        <View style={styles.linksSection}>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => Linking.openURL('https://www.wanderingyacht.com')}
          >
            <Ionicons name="globe-outline" size={20} color="#1a3a4a" />
            <Text style={styles.linkText}>www.wanderingyacht.com</Text>
            <Ionicons name="open-outline" size={16} color="#9ca3a3" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => Linking.openURL('https://www.instagram.com/wanderingyacht')}
          >
            <Ionicons name="logo-instagram" size={20} color="#1a3a4a" />
            <Text style={styles.linkText}>@wanderingyacht</Text>
            <Ionicons name="open-outline" size={16} color="#9ca3a3" />
          </TouchableOpacity>
        </View>

        {/* Contact Section */}
        <View style={styles.contactSection}>
          <Text style={styles.sectionLabel}>GET IN TOUCH</Text>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.whatsappButton}
            onPress={() => Linking.openURL('https://wa.me/38269333693')}
          >
            <Ionicons name="logo-whatsapp" size={24} color="#fff" />
            <Text style={styles.whatsappButtonText}>WhatsApp Us</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.contactRow}
            onPress={() => Linking.openURL('tel:+38269333693')}
          >
            <Ionicons name="call-outline" size={20} color="#1a3a4a" />
            <Text style={styles.contactRowText}>+382 69 333 693</Text>
          </TouchableOpacity>
          <View style={styles.contactRow}>
            <Ionicons name="location-outline" size={20} color="#1a3a4a" />
            <Text style={styles.contactRowText}>Porto Montenegro, Tivat{'\n'}Montenegro</Text>
          </View>
        </View>

        {/* Locations */}
        <View style={styles.locationsSection}>
          <Text style={styles.sectionLabel}>OUR LOCATIONS</Text>
          <View style={styles.locationsGrid}>
            {['USA', 'SPAIN', 'MONTENEGRO', 'UAE', 'SINGAPORE'].map((loc) => (
              <View key={loc} style={styles.locationChip}>
                <Text style={styles.locationChipText}>{loc}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf9f7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0ede8',
  },
  headerTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 18,
    color: '#1a2a30',
    fontWeight: '600',
  },
  logoSection: {
    alignItems: 'center',
    paddingVertical: 36,
    backgroundColor: '#fff',
  },
  logo: {
    width: 100,
    height: 100,
  },
  aboutSection: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 28,
    backgroundColor: '#fff',
  },
  sectionLabel: {
    fontFamily: 'TraditionalArabic',
    fontSize: 12,
    color: '#c17f59',
    letterSpacing: 2,
    fontWeight: '600',
    marginBottom: 6,
  },
  sectionTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 28,
    color: '#1a2a30',
    fontWeight: '300',
    marginBottom: 16,
  },
  divider: {
    width: 40,
    height: 2,
    backgroundColor: '#1a3a4a',
    marginBottom: 20,
  },
  bodyText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 15,
    color: '#5a6a6a',
    lineHeight: 24,
    marginBottom: 16,
  },
  welcomeText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 18,
    color: '#1a2a30',
    fontWeight: '600',
    marginTop: 4,
  },
  linksSection: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0ede8',
    gap: 16,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  linkText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 15,
    color: '#1a3a4a',
    fontWeight: '500',
    flex: 1,
  },
  contactSection: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: '#faf9f7',
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 16,
    borderRadius: 10,
    gap: 10,
    marginBottom: 24,
  },
  whatsappButtonText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 17,
    color: '#fff',
    fontWeight: '600',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  contactRowText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 16,
    color: '#1a2a30',
    fontWeight: '500',
    lineHeight: 22,
  },
  locationsSection: {
    paddingHorizontal: 24,
    paddingVertical: 28,
    backgroundColor: '#1a3a4a',
  },
  locationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  locationChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  locationChipText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
    letterSpacing: 1,
  },
});
