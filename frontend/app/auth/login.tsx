import React, { useState, useEffect } from 'react';
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
import { biometricService } from '../../src/services/biometric';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    login,
    loginWithBiometric,
    isBiometricAvailable,
    isBiometricEnabled,
    biometricLabel,
  } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [storedEmail, setStoredEmail] = useState(null);

  useEffect(() => {
    // Check for stored biometric user
    const checkStored = async () => {
      const savedEmail = await biometricService.getStoredUserEmail();
      setStoredEmail(savedEmail);
    };
    checkStored();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      router.replace('/(tabs)');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Login failed';
      Alert.alert('Error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    try {
      const success = await loginWithBiometric();
      if (success) {
        router.replace('/(tabs)');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Biometric login failed';
      Alert.alert('Error', errorMsg);
    } finally {
      setBiometricLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    if (Platform.OS === 'web') {
      // Web: use WebAuthn API
      try {
        setLoading(true);
        const { api } = require('../../src/services/api');

        // Get authentication options from server
        const options = await api.getPasskeyAuthOptions();

        // Convert challenge from base64url to ArrayBuffer
        const challenge = base64urlToBuffer(options.challenge);

        // Build allowCredentials if provided
        const allowCredentials = (options.allowCredentials || []).map((cred) => ({
          id: base64urlToBuffer(cred.id),
          type: cred.type,
          transports: cred.transports,
        }));

        // Call WebAuthn API
        const credential = await navigator.credentials.get({
          publicKey: {
            challenge,
            rpId: options.rpId,
            allowCredentials,
            userVerification: options.userVerification || 'preferred',
            timeout: options.timeout || 60000,
          },
        });

        if (!credential) {
          Alert.alert('Error', 'Passkey authentication was cancelled');
          return;
        }

        const response = credential.response;

        // Build credential JSON for server
        const credentialJSON = JSON.stringify({
          id: credential.id,
          rawId: bufferToBase64url(credential.rawId),
          type: credential.type,
          response: {
            authenticatorData: bufferToBase64url(response.authenticatorData),
            clientDataJSON: bufferToBase64url(response.clientDataJSON),
            signature: bufferToBase64url(response.signature),
            userHandle: response.userHandle ? bufferToBase64url(response.userHandle) : null,
          },
        });

        // Verify with server
        const result = await api.verifyPasskeyAuth(credentialJSON);

        if (result.access_token) {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          await AsyncStorage.setItem('auth_token', result.access_token);
          await AsyncStorage.setItem('auth_user', JSON.stringify(result.user));
          api.setToken(result.access_token);
          router.replace('/(tabs)');
        }
      } catch (err) {
        console.error('Passkey auth error:', err);
        const errObj = err instanceof Error ? err : new Error('Authentication failed');
        if (errObj.name === 'NotAllowedError') {
          Alert.alert('Cancelled', 'Passkey authentication was cancelled.');
        } else {
          Alert.alert('Passkey Error', errObj.message || 'Authentication failed. Try signing in with your password.');
        }
      } finally {
        setLoading(false);
      }
    } else {
      // Native: passkeys require production builds
      Alert.alert(
        'Passkey',
        'Passkey authentication on mobile requires a production build. Please use Face ID/Fingerprint or sign in with your password.',
      );
    }
  };

  // Helper functions for WebAuthn
  const base64urlToBuffer = (base64url) => {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const bufferToBase64url = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };

  const getBiometricIcon = () => {
    if (biometricLabel.includes('Face')) return 'scan-outline';
    if (biometricLabel.includes('Fingerprint') || biometricLabel.includes('Touch')) return 'finger-print-outline';
    return 'shield-checkmark-outline';
  };

  const showBiometricButton = Platform.OS !== 'web' && isBiometricAvailable && isBiometricEnabled;
  const showPasskeyButton = Platform.OS === 'web'; // WebAuthn available on web

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
            source={require('../../assets/images/wy-logo-solid.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>{t('auth_welcome_back')}</Text>
          <Text style={styles.subtitle}>{t('auth_sign_in_subtitle')}</Text>
        </View>

        {/* Biometric Quick Login */}
        {showBiometricButton && (
          <View style={styles.biometricSection}>
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={handleBiometricLogin}
              disabled={biometricLoading}
            >
              {biometricLoading ? (
                <ActivityIndicator color="#1a3a4a" size="small" />
              ) : (
                <>
                  <Ionicons name={getBiometricIcon()} size={32} color="#1a3a4a" />
                  <Text style={styles.biometricButtonText}>
                    Sign in with {biometricLabel}
                  </Text>
                  {storedEmail && (
                    <Text style={styles.biometricEmail}>{storedEmail}</Text>
                  )}
                </>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or use password</Text>
              <View style={styles.dividerLine} />
            </View>
          </View>
        )}

        {/* Passkey Button (Web only) */}
        {showPasskeyButton && (
          <View style={styles.biometricSection}>
            <TouchableOpacity
              style={styles.passkeyButton}
              onPress={handlePasskeyLogin}
              disabled={loading}
            >
              <Ionicons name="key-outline" size={24} color="#fff" />
              <Text style={styles.passkeyButtonText}>Sign in with Passkey</Text>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or use password</Text>
              <View style={styles.dividerLine} />
            </View>
          </View>
        )}

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#9ca3a3" />
            <TextInput
              style={styles.input}
              placeholder={t('email')}
              placeholderTextColor="#9ca3a3"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#9ca3a3" />
            <TextInput
              style={styles.input}
              placeholder={t('password')}
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

          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>{t('auth_forgot_password')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>{t('sign_in')}</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('no_account')}</Text>
          <TouchableOpacity onPress={() => router.replace('/auth/register')}>
            <Text style={styles.footerLink}>{t('create_account')}</Text>
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
    marginBottom: 30,
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
    fontWeight: '300',
    marginTop: 8,
  },
  subtitle: {
    fontFamily: 'TraditionalArabic',
    color: '#7a8a8a',
    fontSize: 16,
    marginTop: 8,
  },
  // Biometric section
  biometricSection: {
    marginBottom: 8,
  },
  biometricButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1a3a4a',
    marginBottom: 16,
    minHeight: 90,
  },
  biometricButtonText: {
    fontFamily: 'TraditionalArabic',
    color: '#1a3a4a',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  biometricEmail: {
    fontFamily: 'TraditionalArabic',
    color: '#7a8a8a',
    fontSize: 13,
    marginTop: 4,
  },
  // Passkey button
  passkeyButton: {
    backgroundColor: '#1a3a4a',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  passkeyButtonText: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e8e5e0',
  },
  dividerText: {
    fontFamily: 'TraditionalArabic',
    color: '#9ca3a3',
    fontSize: 13,
    marginHorizontal: 16,
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
    paddingVertical: 14,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    fontFamily: 'TraditionalArabic',
    color: '#1a3a4a',
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: '#1a3a4a',
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 16,
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
  },
  footerLink: {
    fontFamily: 'TraditionalArabic',
    color: '#1a3a4a',
    fontSize: 14,
    fontWeight: '600',
  },
});
