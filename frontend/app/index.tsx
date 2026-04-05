import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { useLanguage } from '../src/context/LanguageContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isLoading } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/(tabs)');
    }
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Image
          source={require('../assets/images/wy-logo.png')}
          style={styles.loadingLogo}
          resizeMode="contain"
        />
        <Text style={styles.loadingBrandName}>WANDERING YACHT</Text>
      </View>
    );
  }

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1763467941364-3d0d6ba474a1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzZ8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB5YWNodCUyMHlvZ2ElMjBkZWNrJTIwbWVkaXRlcnJhbmVhbnxlbnwwfHx8fDE3NzM0ODQ4MTF8MA&ixlib=rb-4.1.0&q=85' }}
      style={styles.container}
      resizeMode="cover"
    >
      {/* Header with centered logo and brand name */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Image
          source={require('../assets/images/wy-logo.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <Text style={styles.brandName}>WANDERING YACHT</Text>
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
    color: '#1a3a4a',
    fontWeight: '600',
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
    color: '#1a3a4a',
    fontWeight: '600',
    letterSpacing: 6,
    marginTop: 6,
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
  },
  heroTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 44,
    fontFamily: 'TraditionalArabic',
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
    fontFamily: 'TraditionalArabic',
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
    fontFamily: 'TraditionalArabic',
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
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 8,
    marginTop: 24,
    width: width - 48,
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
    fontFamily: 'TraditionalArabic',
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
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontWeight: '700',
  },
});
