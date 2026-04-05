import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useLanguage } from '../../src/context/LanguageContext';

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const { t } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await register(email, password, fullName, phone || undefined, whatsapp || undefined);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={24} color="#1a2a30" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/wy-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>{t('create_account')}</Text>
          <Text style={styles.subtitle}>{t('auth_join_subtitle')}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#9ca3a3" />
            <TextInput
              style={styles.input}
              placeholder={`${t('full_name')} *`}
              placeholderTextColor="#9ca3a3"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#9ca3a3" />
            <TextInput
              style={styles.input}
              placeholder={`${t('email')} *`}
              placeholderTextColor="#9ca3a3"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="call-outline" size={20} color="#9ca3a3" />
            <TextInput
              style={styles.input}
              placeholder={t('auth_phone')}
              placeholderTextColor="#9ca3a3"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="logo-whatsapp" size={20} color="#9ca3a3" />
            <TextInput
              style={styles.input}
              placeholder={t('whatsapp_number')}
              placeholderTextColor="#9ca3a3"
              value={whatsapp}
              onChangeText={setWhatsapp}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#9ca3a3" />
            <TextInput
              style={styles.input}
              placeholder={`${t('password')} *`}
              placeholderTextColor="#9ca3a3"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#9ca3a3"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#9ca3a3" />
            <TextInput
              style={styles.input}
              placeholder={t('auth_confirm_password')}
              placeholderTextColor="#9ca3a3"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.registerButton, loading && styles.registerButtonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.registerButtonText}>{t('create_account')}</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('have_account')}</Text>
          <TouchableOpacity onPress={() => router.replace('/auth/login')}>
            <Text style={styles.footerLink}>{t('sign_in')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf9f7',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingTop: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  title: {
    fontFamily: 'TraditionalArabic',
    color: '#1a2a30',
    fontSize: 28,
    fontFamily: 'TraditionalArabic',
    fontWeight: '300',
    marginTop: 8,
  },
  subtitle: {
    fontFamily: 'TraditionalArabic',
    color: '#7a8a8a',
    fontSize: 16,
    fontFamily: 'TraditionalArabic',
    marginTop: 8,
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e8e5e0',
  },
  input: {
    flex: 1,
    fontFamily: 'TraditionalArabic',
    color: '#1a2a30',
    fontSize: 16,
    fontFamily: 'TraditionalArabic',
    paddingVertical: 14,
  },
  registerButton: {
    backgroundColor: '#1a3a4a',
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  registerButtonDisabled: {
    opacity: 0.7,
  },
  registerButtonText: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 16,
    fontFamily: 'TraditionalArabic',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
    gap: 8,
  },
  footerText: {
    fontFamily: 'TraditionalArabic',
    color: '#7a8a8a',
    fontSize: 14,
    fontFamily: 'TraditionalArabic',
  },
  footerLink: {
    fontFamily: 'TraditionalArabic',
    color: '#1a3a4a',
    fontSize: 14,
    fontFamily: 'TraditionalArabic',
    fontWeight: '600',
  },
});
