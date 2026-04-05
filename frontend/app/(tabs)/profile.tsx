import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useFavorites } from '../../src/context/FavoritesContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { LANGUAGES } from '../../src/i18n/translations';
import { api } from '../../src/services/api';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, token, logout } = useAuth();
  const { favorites, toggleFavorite, shareToNotes } = useFavorites();
  const { language, setLanguage, t } = useLanguage();
  const [allExperiences, setAllExperiences] = useState<any[]>([]);
  const [showLangPicker, setShowLangPicker] = useState(false);

  useEffect(() => {
    if (token) {
      api.setToken(token);
    }
    loadExperiences();
  }, [token]);

  const loadExperiences = async () => {
    try {
      const data = await api.getExperiences();
      setAllExperiences(data);
    } catch (e) {
      console.error('Failed to load experiences', e);
    }
  };

  const favoriteExperiences = allExperiences.filter((exp) => favorites.includes(exp.id));

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
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        {/* Centered Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/wy-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brandName}>WANDERING YACHT</Text>
        </View>

        {/* Favorites Section */}
        {favorites.length > 0 && (
          <View style={styles.favoritesSection}>
            <View style={styles.favoritesHeaderRow}>
              <View style={styles.favoritesLine} />
              <Text style={styles.favoritesTitle}>YOUR FAVORITES</Text>
              <View style={styles.favoritesLine} />
            </View>

            {favoriteExperiences.map((exp) => (
              <TouchableOpacity
                key={exp.id}
                style={styles.favoriteCard}
                onPress={() => router.push(`/experience/${exp.id}`)}
                activeOpacity={0.8}
              >
                <Image source={{ uri: exp.image_url }} style={styles.favoriteImage} />
                <View style={styles.favoriteInfo}>
                  <Text style={styles.favoriteName} numberOfLines={1}>{exp.title}</Text>
                  <Text style={styles.favoriteLocation} numberOfLines={1}>
                    <Ionicons name="location-outline" size={12} color="#7a8a8a" /> {exp.location}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => toggleFavorite(exp.id)}
                  style={styles.favoriteHeart}
                >
                  <Ionicons name="heart" size={20} color="#e74c3c" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}

            {/* Save to Notes Button */}
            <TouchableOpacity
              style={styles.shareNotesBtn}
              onPress={() => shareToNotes(allExperiences)}
              activeOpacity={0.8}
            >
              <Ionicons name="share-outline" size={18} color="#fff" />
              <Text style={styles.shareNotesBtnText}>Save Favorites to Notes</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Language Selector */}
        <View style={styles.languageSection}>
          <TouchableOpacity
            style={styles.languageRow}
            onPress={() => setShowLangPicker(true)}
          >
            <Ionicons name="globe-outline" size={20} color="#1a3a4a" />
            <Text style={styles.languageLabel}>{t('profile_language')}</Text>
            <Text style={styles.languageCurrent}>
              {LANGUAGES.find(l => l.code === language)?.flag} {LANGUAGES.find(l => l.code === language)?.name}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#9ca3a3" />
          </TouchableOpacity>
        </View>
      </ScrollView>

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
  favoritesSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  favoritesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  favoritesLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#d5d0c8',
  },
  favoritesTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 13,
    color: '#c17f59',
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  favoriteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ede9e3',
  },
  favoriteImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#e8e5e0',
  },
  favoriteInfo: {
    flex: 1,
    marginLeft: 12,
  },
  favoriteName: {
    fontFamily: 'TraditionalArabic',
    fontSize: 15,
    color: '#1a2a30',
    fontWeight: '600',
  },
  favoriteLocation: {
    fontFamily: 'TraditionalArabic',
    fontSize: 12,
    color: '#7a8a8a',
    marginTop: 2,
  },
  favoriteHeart: {
    padding: 8,
  },
  shareNotesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a3a4a',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 12,
    gap: 8,
  },
  shareNotesBtnText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
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
