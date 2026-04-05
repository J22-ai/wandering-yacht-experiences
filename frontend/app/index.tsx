import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, ImageBackground, Modal, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { useLanguage } from '../src/context/LanguageContext';
import { LANGUAGES } from '../src/i18n/translations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isLoading } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [showLangPicker, setShowLangPicker] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.replace('/(tabs)');
      }
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Image
          source={require('../assets/images/wy-logo-solid.png')}
          style={styles.loadingLogo}
          resizeMode="contain"
        />
        <Text style={styles.loadingBrandName}>WANDERING YACHT</Text>
      </View>
    );
  }

  return (
    <ImageBackground
      source={{ uri: 'https://images.pexels.com/photos/29071814/pexels-photo-29071814.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1200&w=800' }}
      style={styles.container}
      resizeMode="cover"
    >
      {/* Header with centered logo, brand name, and language globe */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Image
          source={require('../assets/images/wy-logo-solid.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <Text style={styles.brandName}>WANDERING YACHT</Text>
        <TouchableOpacity
          style={styles.langGlobe}
          onPress={() => setShowLangPicker(true)}
        >
          <Ionicons name="globe-outline" size={22} color="#1a3a4a" />
          <Text style={styles.langGlobeText}>
            {LANGUAGES.find(l => l.code === language)?.flag}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Hero Content */}
      <View style={styles.heroContent}>
        <Text style={styles.heroTitle}>
          {t('welcome_title')}
        </Text>
        <Text style={styles.heroCountry}>MONTENEGRO</Text>
        <Text style={styles.heroSubtitle}>
          {t('welcome_subtitle')}
        </Text>
        <TouchableOpacity
          style={styles.exploreButton}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.exploreButtonText}>{t('welcome_cta')}</Text>
          <Ionicons name="arrow-forward" size={20} color="#1a3a4a" />
        </TouchableOpacity>
      </View>

      {/* Bottom Sign In */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={styles.signInLink}
          onPress={() => router.push('/auth/login')}
        >
          <Text style={styles.signInText}>{t('have_account')} </Text>
          <Text style={styles.signInBold}>{t('sign_in')}</Text>
        </TouchableOpacity>
      </View>

      {/* Language Picker Modal */}
      <Modal
        visible={showLangPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLangPicker(false)}
      >
        <TouchableOpacity
          style={styles.langModalOverlay}
          activeOpacity={1}
          onPress={() => setShowLangPicker(false)}
        >
          <View style={styles.langModalContent}>
            <Text style={styles.langModalTitle}>{t('profile_language')}</Text>
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langOption, language === lang.code && styles.langOptionActive]}
                  onPress={() => { setLanguage(lang.code); setShowLangPicker(false); }}
                >
                  <Text style={styles.langFlag}>{lang.flag}</Text>
                  <Text style={[styles.langName, language === lang.code && styles.langNameActive]}>{lang.name}</Text>
                  {language === lang.code && <Ionicons name="checkmark" size={20} color="#1a3a4a" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f5f5f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLogo: {
    width: 120,
    height: 120,
  },
  loadingBrandName: {
    fontFamily: 'TraditionalArabic',
    fontSize: 28,
    color: '#000000',
    fontWeight: '700',
    letterSpacing: 6,
    marginTop: 16,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 14,
    backgroundColor: '#fff',
  },
  headerLogo: {
    width: 70,
    height: 70,
  },
  brandName: {
    fontFamily: 'TraditionalArabic',
    fontSize: 26,
    color: '#000000',
    fontWeight: '700',
    letterSpacing: 6,
    marginTop: 6,
  },
  langGlobe: {
    position: 'absolute',
    right: 18,
    top: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  langGlobeText: {
    fontSize: 16,
  },
  langModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  langModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  langModalTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 20,
    color: '#1a2a30',
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 12,
  },
  langOptionActive: {
    backgroundColor: '#e8f4f4',
  },
  langFlag: {
    fontSize: 24,
  },
  langName: {
    fontFamily: 'TraditionalArabic',
    fontSize: 16,
    color: '#1a2a30',
    flex: 1,
  },
  langNameActive: {
    fontWeight: '600',
    color: '#1a3a4a',
  },
  menuButton: {
    padding: 4,
  },
  heroContent: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 80,
    backgroundColor: 'rgba(0, 40, 60, 0.35)',
  },
  heroTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 44,
    color: '#fff',
    textAlign: 'center',
    fontWeight: '300',
    lineHeight: 54,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroCountry: {
    fontFamily: 'TraditionalArabic',
    fontSize: 32,
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 8,
    marginTop: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroSubtitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.92)',
    textAlign: 'center',
    marginTop: 40,
    lineHeight: 24,
    paddingHorizontal: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 30,
    marginTop: 32,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  exploreButtonText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 17,
    color: '#1a3a4a',
    fontWeight: '600',
  },
  bottomBar: {
    paddingTop: 16,
    alignItems: 'center',
  },
  signInLink: {
    flexDirection: 'row',
  },
  signInText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  signInBold: {
    fontFamily: 'TraditionalArabic',
    fontSize: 15,
    color: '#fff',
    fontWeight: '700',
  },
});
