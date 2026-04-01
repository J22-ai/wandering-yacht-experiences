import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Platform, ScrollView, ImageBackground } from 'react-native';
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
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=1200' }}
        style={styles.heroBackground}
        resizeMode="cover"
      >
        <View style={styles.heroOverlay}>
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../assets/images/wy-logo.png')}
                style={styles.headerLogo}
                resizeMode="contain"
              />
              <Text style={styles.headerTitle}>Wandering Yacht</Text>
            </View>
            <TouchableOpacity style={styles.menuButton}>
              <Ionicons name="menu" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Hero Content */}
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Unforgettable{"\n"}Montenegro{"\n"}Experiences</Text>
            <Text style={styles.heroSubtitle}>
              Discover curated adventures—from sunrise yoga on luxury yachts to vintage car tours through Montenegro's most scenic routes.
            </Text>
            <TouchableOpacity
              style={styles.heroButton}
              onPress={() => router.replace('/(tabs)')}
            >
              <Text style={styles.heroButtonText}>Explore Experiences</Text>
              <Ionicons name="arrow-forward" size={18} color="#2d5a5a" />
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>

      {/* Bottom Actions */}
      <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={styles.signInLink}
          onPress={() => router.push('/auth/login')}
        >
          <Text style={styles.signInText}>Already have an account? </Text>
          <Text style={styles.signInTextBold}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f6f3',
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
  heroBackground: {
    flex: 1,
    width: '100%',
  },
  heroOverlay: {
    flex: 1,
    backgroundColor: 'rgba(45, 90, 90, 0.4)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogo: {
    width: 32,
    height: 32,
  },
  headerTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 18,
    color: '#fff',
    fontWeight: '500',
  },
  menuButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  heroTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 42,
    color: '#fff',
    textAlign: 'center',
    fontWeight: '300',
    lineHeight: 52,
    letterSpacing: 1,
  },
  heroSubtitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    marginTop: 30,
    gap: 10,
  },
  heroButtonText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 16,
    color: '#2d5a5a',
    fontWeight: '600',
  },
  bottomActions: {
    backgroundColor: '#f8f6f3',
    paddingTop: 20,
    alignItems: 'center',
  },
  signInLink: {
    flexDirection: 'row',
  },
  signInText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 14,
    color: '#666',
  },
  signInTextBold: {
    fontFamily: 'TraditionalArabic',
    fontSize: 14,
    color: '#2d5a5a',
    fontWeight: '600',
  },
});
