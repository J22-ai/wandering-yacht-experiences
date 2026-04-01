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
      {/* White Header - exactly like Experience Pass */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Wandering Yacht</Text>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="menu" size={26} color="#5d8a8a" />
        </TouchableOpacity>
      </View>

      {/* Hero Section - Marina/Water Background like Experience Pass */}
      <View style={styles.heroSection}>
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=1200' }}
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
              <Ionicons name="arrow-forward" size={18} color="#5d8a8a" />
            </TouchableOpacity>
          </View>
        </ImageBackground>
      </View>

      {/* Bottom Sign In Bar - teal like Experience Pass */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
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
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 22,
    color: '#5d8a8a',
    fontStyle: 'italic',
    fontWeight: '400',
  },
  menuButton: {
    padding: 4,
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
    backgroundColor: 'rgba(93, 138, 138, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  heroTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 40,
    color: '#fff',
    textAlign: 'center',
    fontStyle: 'italic',
    fontWeight: '300',
    lineHeight: 50,
  },
  heroSubtitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 2,
    marginTop: 28,
    marginHorizontal: 16,
    width: '100%',
    gap: 10,
  },
  exploreButtonText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 16,
    color: '#5d8a8a',
    fontWeight: '500',
  },
  bottomBar: {
    backgroundColor: '#5d8a8a',
    paddingTop: 16,
    alignItems: 'center',
  },
  signInLink: {
    flexDirection: 'row',
  },
  signInText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  signInBold: {
    fontFamily: 'TraditionalArabic',
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
});
