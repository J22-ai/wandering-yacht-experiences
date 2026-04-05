import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  Platform,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [linkModal, setLinkModal] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false,
    title: '',
    message: '',
  });

  const openLink = (url: string) => {
    if (Platform.OS === 'web') {
      // Try opening from top-level window to escape iframe
      try {
        (window.top || window.parent || window).open(url, '_blank');
      } catch {
        window.open(url, '_blank');
      }
    } else {
      Linking.openURL(url);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={0.6}
        >
          <Ionicons name="arrow-back" size={22} color="#1a3a4a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About Us</Text>
        <View style={{ width: 44 }} />
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
            Born from the love of the sea, family Yacht Charters during summer holidays and intrigued by the way water connects us all to life; Wandering Yacht was born. Starting in a strategic location on the Adriatic Sea, between London and Dubai, the first location started in Porto Montenegro, Tivat, Montenegro. The worlds most luxurious port, which has everything to travel to, embark on a journey from and return to, after a sea voyage is completed.
          </Text>
          <Text style={styles.bodyText}>
            Our incredible team has curated immersive excursions for those who seek heartfelt adventures both on land and on the water. Starting with Sunrise Yoga on luxury decks to Wild Beauty afternoon Fiat drives through hidden mountain roads.
          </Text>
          <Text style={styles.bodyText}>
            We craft journeys that awaken the senses and create lasting memories, surprising those that believe they have 'seen it all'. Everything we design is sustainably connected to Luxury intertwined with Nature.
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
            onPress={() => openLink('https://www.wanderingyacht.com')}
          >
            <Ionicons name="globe-outline" size={20} color="#1a3a4a" />
            <Text style={styles.linkText}>www.wanderingyacht.com</Text>
            <Ionicons name="open-outline" size={16} color="#9ca3a3" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => {
              if (Platform.OS === 'web') {
                try {
                  (window.top || window.parent || window).open('https://www.instagram.com/wanderingyacht/', '_blank');
                } catch {
                  window.open('https://www.instagram.com/wanderingyacht/', '_blank');
                }
              } else {
                // Try Instagram app deep link first, fall back to web
                Linking.canOpenURL('instagram://user?username=wanderingyacht').then((supported) => {
                  if (supported) {
                    Linking.openURL('instagram://user?username=wanderingyacht');
                  } else {
                    Linking.openURL('https://www.instagram.com/wanderingyacht/');
                  }
                });
              }
            }}
          >
            <Ionicons name="logo-instagram" size={20} color="#1a3a4a" />
            <Text style={styles.linkText}>@wanderingyacht</Text>
            <Ionicons name="open-outline" size={16} color="#9ca3a3" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => openLink('https://www.youtube.com/@WanderingYacht')}
          >
            <Ionicons name="logo-youtube" size={20} color="#1a3a4a" />
            <Text style={styles.linkText}>@WanderingYacht</Text>
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
            onPress={() => openLink('https://wa.me/38269333693')}
          >
            <Ionicons name="logo-whatsapp" size={24} color="#fff" />
            <Text style={styles.whatsappButtonText}>WhatsApp Us</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.contactRow}
            onPress={() => openLink('tel:+38269333693')}
          >
            <Ionicons name="call-outline" size={20} color="#1a3a4a" />
            <Text style={styles.contactRowText}>+382 69 333 693</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.contactRow}
            onPress={() => openLink('mailto:info@wanderingyacht.com')}
          >
            <Ionicons name="mail-outline" size={20} color="#1a3a4a" />
            <Text style={styles.contactRowText}>info@wanderingyacht.com</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.contactRow}
            onPress={() => openLink('https://www.google.com/maps/search/?api=1&query=Porto+Montenegro+Tivat')}
          >
            <Ionicons name="location-outline" size={20} color="#1a3a4a" />
            <Text style={[styles.contactRowText, { textDecorationLine: 'underline' }]}>Porto Montenegro, Tivat{'\n'}Montenegro</Text>
          </TouchableOpacity>
        </View>

        {/* Locations */}
        <View style={styles.locationsSection}>
          <Text style={styles.sectionLabel}>OUR LOCATIONS</Text>
          <View style={styles.locationsGrid}>
            {[
              { name: 'USA', detail: 'Central Beach, Fort Lauderdale, Florida', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Central+Beach+Fort+Lauderdale+Florida' },
              { name: 'SPAIN', detail: 'Port Vell, Barcelona & Ibiza', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Port+Vell+Barcelona+Spain' },
              { name: 'MONTENEGRO', detail: 'Porto Montenegro, Tivat', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Porto+Montenegro+Tivat' },
              { name: 'UAE', detail: 'Abu Dhabi Marina & Port Rashid, Dubai', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Port+Rashid+Dubai' },
              { name: 'SINGAPORE', detail: 'Marina at Keppel Bay', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Marina+at+Keppel+Bay+Singapore' },
            ].map((loc) => (
              <TouchableOpacity
                key={loc.name}
                style={styles.locationCard}
                onPress={() => openLink(loc.mapUrl)}
                activeOpacity={0.7}
              >
                <View style={styles.locationCardHeader}>
                  <Ionicons name="location" size={16} color="#fff" />
                  <Text style={styles.locationChipText}>{loc.name}</Text>
                </View>
                <Text style={styles.locationDetail}>{loc.detail}</Text>
                <View style={styles.locationMapLink}>
                  <Text style={styles.locationMapText}>View on Map</Text>
                  <Ionicons name="open-outline" size={12} color="rgba(255,255,255,0.7)" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Link Info Modal for web preview */}
      <Modal
        visible={linkModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setLinkModal({ ...linkModal, visible: false })}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setLinkModal({ ...linkModal, visible: false })}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{linkModal.title}</Text>
            <Text style={styles.modalMessage}>{linkModal.message}</Text>
            <Text style={styles.modalNote}>Links open natively on your phone via the app</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setLinkModal({ ...linkModal, visible: false })}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  locationCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    width: '100%',
    marginBottom: 4,
  },
  locationCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  locationChipText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
    letterSpacing: 1,
  },
  locationDetail: {
    fontFamily: 'TraditionalArabic',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.75)',
    marginLeft: 24,
    marginBottom: 6,
  },
  locationMapLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 24,
  },
  locationMapText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 20,
    fontWeight: '700',
    color: '#1a3a4a',
    marginBottom: 12,
  },
  modalMessage: {
    fontFamily: 'TraditionalArabic',
    fontSize: 16,
    color: '#3a4a4a',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  modalNote: {
    fontFamily: 'TraditionalArabic',
    fontSize: 13,
    color: '#9ca3a3',
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  modalButton: {
    backgroundColor: '#1a3a4a',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 10,
  },
  modalButtonText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
