import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <View style={styles.guestContainer}>
          <Image
            source={require('../../assets/images/wy-logo.png')}
            style={styles.guestLogo}
            resizeMode="contain"
          />
          <Text style={styles.guestTitle}>Welcome to Wandering Yacht</Text>
          <Text style={styles.guestText}>
            Sign in to manage your bookings and access exclusive features
          </Text>
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
        </View>
      </View>
    );
  }

  const menuItems = [
    {
      icon: 'ticket-outline' as const,
      title: 'My Bookings',
      subtitle: 'View all your reservations',
      onPress: () => router.push('/(tabs)/bookings'),
    },
    {
      icon: 'heart-outline' as const,
      title: 'Favorites',
      subtitle: 'Saved experiences',
      onPress: () => {},
    },
    {
      icon: 'notifications-outline' as const,
      title: 'Notifications',
      subtitle: 'Manage notification settings',
      onPress: () => {},
    },
    {
      icon: 'card-outline' as const,
      title: 'Payment Methods',
      subtitle: 'Manage your cards',
      onPress: () => {},
    },
    {
      icon: 'help-circle-outline' as const,
      title: 'Help & Support',
      subtitle: 'FAQs and contact us',
      onPress: () => {},
    },
    {
      icon: 'document-text-outline' as const,
      title: 'Terms & Privacy',
      subtitle: 'Legal information',
      onPress: () => {},
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* User Info */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user.full_name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user.full_name}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
          </View>
          <TouchableOpacity style={styles.editButton}>
            <Ionicons name="pencil" size={18} color="#1a365d" />
          </TouchableOpacity>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name={item.icon} size={22} color="#1a365d" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#5c6f7f" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#e53e3e" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  guestContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  guestLogo: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  guestTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  guestText: {
    fontFamily: 'TraditionalArabic',
    color: '#8899a6',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  signInButton: {
    backgroundColor: '#1a365d',
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 32,
    width: '100%',
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
    borderColor: '#e53e3e',
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
    width: '100%',
  },
  registerButtonText: {
    fontFamily: 'TraditionalArabic',
    color: '#e53e3e',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a2d4a',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1a365d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  userEmail: {
    fontFamily: 'TraditionalArabic',
    color: '#8899a6',
    fontSize: 14,
    marginTop: 2,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0a1628',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuSection: {
    backgroundColor: '#1a2d4a',
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a3d5a',
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(26, 54, 93, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    flex: 1,
    marginLeft: 12,
  },
  menuTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  menuSubtitle: {
    fontFamily: 'TraditionalArabic',
    color: '#8899a6',
    fontSize: 12,
    marginTop: 2,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 24,
    padding: 16,
    backgroundColor: 'rgba(229, 62, 62, 0.1)',
    borderRadius: 12,
    gap: 8,
  },
  signOutText: {
    fontFamily: 'TraditionalArabic',
    color: '#e53e3e',
    fontSize: 16,
    fontWeight: '600',
  },
});
