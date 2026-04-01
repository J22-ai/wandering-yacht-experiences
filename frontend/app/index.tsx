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
    <View style={styles.container}>
      {/* White Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Wandering Yacht</Text>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="menu" size={28} color="#4a7c7c" />
        </TouchableOpacity>
      </View>

      {/* Hero Section - Marina Background */}
      <View style={styles.heroSection}>
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=1200' }}
          style={styles.heroBackground}
          resizeMode="cover"
        >
          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>
              Unforgettable{'\n'}Montenegro{'\n'}Experiences
            </Text>
            <Text style={styles.heroSubtitle}>
              Discover curated adventures—from sunrise yoga on luxury yachts to vintage car tours through Montenegro's most scenic routes.
            </Text>
            <TouchableOpacity
              style={styles.exploreButton}
              onPress={() => router.replace('/(tabs)')}
            >
              <Text style={styles.exploreButtonText}>Explore Experiences</Text>
              <Ionicons name="arrow-forward" size={18} color="#4a7c7c" />
            </TouchableOpacity>
          </View>
        </ImageBackground>
      </View>

      {/* Bottom Sign In Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.signInLink}
          onPress={() => router.push('/auth/login')}
        >
          <Text style={styles.signInText}>Already have an account? </Text>
          <Text style={styles.signInBold}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f8f6f3',
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 24,
    color: '#4a7c7c',
    fontStyle: 'italic',
    fontWeight: '400',
  },
  menuButton: {
    padding: 8,
  },
  heroSection: {
    flex: 1,
  },
  heroBackground: {
    flex: 1,
    width: '100%',
  },
  heroOverlay: {
    flex: 1,
    backgroundColor: 'rgba(74, 124, 124, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  heroTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 42,
    color: '#fff',
    textAlign: 'center',
    fontStyle: 'italic',
    fontWeight: '300',
    lineHeight: 52,
  },
  heroSubtitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 26,
    paddingHorizontal: 10,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 4,
    marginTop: 32,
    marginHorizontal: 16,
    width: '100%',
    gap: 12,
  },
  exploreButtonText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 17,
    color: '#4a7c7c',
    fontWeight: '500',
  },
  bottomBar: {
    backgroundColor: '#4a7c7c',
    paddingTop: 14,
    alignItems: 'center',
  },
  signInLink: {
    flexDirection: 'row',
  },
  signInText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  signInBold: {
    fontFamily: 'TraditionalArabic',
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
});
