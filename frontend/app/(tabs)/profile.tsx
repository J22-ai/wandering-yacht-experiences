import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Centered Logo */}
      <View style={styles.logoContainer}>
        <Image
          source={require('../../assets/images/wy-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.brandName}>WANDERING YACHT</Text>
      </View>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        {user ? (
          <>
            <Text style={styles.welcomeText}>Welcome, {user.full_name}</Text>
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={handleLogout}
            >
              <Text style={styles.signOutButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.signInButton}
              onPress={() => router.push('/auth/login')}
            >
              <Text style={styles.signInButtonText}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.registerButton}
              onPress={() => router.push('/auth/register')}
            >
              <Text style={styles.registerButtonText}>Create Account</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf9f7',
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 150,
    height: 150,
  },
  brandName: {
    fontFamily: 'TraditionalArabic',
    color: '#1a3a4a',
    fontSize: 18,
    fontWeight: '400',
    letterSpacing: 3,
    marginTop: 20,
  },
  bottomActions: {
    paddingHorizontal: 40,
    paddingBottom: 40,
    alignItems: 'center',
  },
  welcomeText: {
    fontFamily: 'TraditionalArabic',
    color: '#1a2a30',
    fontSize: 16,
    marginBottom: 16,
  },
  signInButton: {
    backgroundColor: '#1a3a4a',
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 8,
    width: '100%',
    marginBottom: 12,
  },
  signInButtonText: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  registerButton: {
    borderWidth: 1,
    borderColor: '#1a3a4a',
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 8,
    width: '100%',
  },
  registerButtonText: {
    fontFamily: 'TraditionalArabic',
    color: '#1a3a4a',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  signOutButton: {
    borderWidth: 1,
    borderColor: '#e74c3c',
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 8,
    width: '100%',
  },
  signOutButtonText: {
    fontFamily: 'TraditionalArabic',
    color: '#e74c3c',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
