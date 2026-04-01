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
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.headerTitle}>Wandering Yacht</Text>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="menu" size={28} color="#2d5a5a" />
        </TouchableOpacity>
      </View>

      {/* Hero Section with Background Image */}
      <View style={styles.heroSection}>
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200' }}
          style={styles.heroBackground}
          resizeMode="cover"
        >
          <View style={styles.heroOverlay}>
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
      </View>

      {/* Bottom Sign In on dark background */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}>
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
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 22,
    color: '#2d5a5a',
    fontWeight: '400',
    fontStyle: 'italic',
  },
  menuButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: 'rgba(45, 90, 90, 0.5)',
    justifyContent: 'center',
  },
  heroContent: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  heroTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 38,
    color: '#fff',
    textAlign: 'center',
    fontWeight: '300',
    lineHeight: 48,
    fontStyle: 'italic',
  },
  heroSubtitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 4,
    marginTop: 28,
    gap: 10,
    width: '100%',
  },
  heroButtonText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 16,
    color: '#2d5a5a',
    fontWeight: '500',
  },
  bottomSection: {
    backgroundColor: '#2d5a5a',
    paddingTop: 16,
    alignItems: 'center',
  },
  signInLink: {
    flexDirection: 'row',
  },
  signInText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  signInTextBold: {
    fontFamily: 'TraditionalArabic',
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
});
