import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isLoading } = useAuth();

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
      </View>
    );
  }

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1763467941364-3d0d6ba474a1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzZ8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB5YWNodCUyMHlvZ2ElMjBkZWNrJTIwbWVkaXRlcnJhbmVhbnxlbnwwfHx8fDE3NzM0ODQ4MTF8MA&ixlib=rb-4.1.0&q=85' }}
      style={styles.container}
      resizeMode="cover"
    >
      {/* Header with logo and menu */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Image
          source={require('../assets/images/wy-logo.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="menu" size={26} color="#2d3a3a" />
        </TouchableOpacity>
      </View>

      {/* Hero Content */}
      <View style={styles.heroContent}>
        <Text style={styles.heroTitle}>
          Our{'\n'}Immersive{'\n'}Experiences
        </Text>
        <Text style={styles.heroCountry}>MONTENEGRO</Text>
        <Text style={styles.heroSubtitle}>
          Discover curated adventures—from Sunrise Yoga on luxury yachts to wild beauty Fiat Car Tours through Montenegro's most scenic routes.
        </Text>
        <TouchableOpacity
          style={styles.exploreButton}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.exploreButtonText}>Explore Experiences</Text>
          <Ionicons name="arrow-forward" size={20} color="#1a3a4a" />
        </TouchableOpacity>
      </View>

      {/* Bottom Sign In */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={styles.signInLink}
          onPress={() => router.push('/auth/login')}
        >
          <Text style={styles.signInText}>Already have an account? </Text>
          <Text style={styles.signInBold}>Sign In</Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  headerLogo: {
    width: 36,
    height: 36,
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
    backgroundColor: 'rgba(30, 60, 70, 0.35)',
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
    color: '#1a3a4a',
    fontWeight: '600',
  },
  bottomBar: {
    paddingTop: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(30, 60, 70, 0.6)',
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
