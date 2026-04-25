import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import { api } from '../services/api';
import { biometricService } from '../services/biometric';

interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  whatsapp_number?: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isBiometricAvailable: boolean;
  isBiometricEnabled: boolean;
  biometricLabel: string;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, phone?: string, whatsappNumber?: string, website?: string, formLoadedAt?: string) => Promise<void>;
  logout: () => Promise<void>;
  loginWithBiometric: () => Promise<boolean>;
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => Promise<void>;
  checkBiometricStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometrics');

  useEffect(() => {
    const timer = setTimeout(() => {
      loadStoredAuth();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedUser = await AsyncStorage.getItem('auth_user');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        api.setToken(storedToken);
      }

      // Check biometric availability
      await checkBiometricStatus();
    } catch (error) {
      console.error('Error loading stored auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkBiometricStatus = async () => {
    try {
      const available = await biometricService.isAvailable();
      setIsBiometricAvailable(available);
      
      if (available) {
        const label = await biometricService.getBiometricLabel();
        setBiometricLabel(label);
        
        const enabled = await biometricService.isEnabled();
        setIsBiometricEnabled(enabled);
      }
    } catch (err) {
      console.error('Biometric status check failed:', err);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await api.login(email, password);
    
    await AsyncStorage.setItem('auth_token', response.access_token);
    await AsyncStorage.setItem('auth_user', JSON.stringify(response.user));
    api.setToken(response.access_token);
    
    setToken(response.access_token);
    setUser(response.user);

    // After successful login, offer biometric enrollment if available
    if (Platform.OS !== 'web') {
      const available = await biometricService.isAvailable();
      const enabled = await biometricService.isEnabled();
      
      if (available && !enabled) {
        const label = await biometricService.getBiometricLabel();
        // Show prompt after a short delay so login completes first
        setTimeout(() => {
          Alert.alert(
            `Enable ${label}?`,
            `Would you like to use ${label} for faster sign-in next time?`,
            [
              { text: 'Not Now', style: 'cancel' },
              {
                text: 'Enable',
                onPress: async () => {
                  await biometricService.enable(response.access_token, response.user);
                  setIsBiometricEnabled(true);
                },
              },
            ]
          );
        }, 500);
      } else if (available && enabled) {
        // Update stored credentials with fresh token
        await biometricService.enable(response.access_token, response.user);
      }
    }
  };

  const register = async (email: string, password: string, fullName: string, phone?: string, whatsappNumber?: string, website?: string, formLoadedAt?: string) => {
    const response = await api.register(email, password, fullName, phone, whatsappNumber, website, formLoadedAt);
    
    await AsyncStorage.setItem('auth_token', response.access_token);
    await AsyncStorage.setItem('auth_user', JSON.stringify(response.user));
    api.setToken(response.access_token);
    
    setToken(response.access_token);
    setUser(response.user);

    // Offer biometric enrollment for new users too
    if (Platform.OS !== 'web') {
      const available = await biometricService.isAvailable();
      if (available) {
        const label = await biometricService.getBiometricLabel();
        setTimeout(() => {
          Alert.alert(
            `Enable ${label}?`,
            `Would you like to use ${label} for faster sign-in next time?`,
            [
              { text: 'Not Now', style: 'cancel' },
              {
                text: 'Enable',
                onPress: async () => {
                  await biometricService.enable(response.access_token, response.user);
                  setIsBiometricEnabled(true);
                },
              },
            ]
          );
        }, 500);
      }
    }
  };

  const loginWithBiometric = async (): Promise<boolean> => {
    try {
      const result = await biometricService.authenticate();
      
      if (result.success && result.token && result.user) {
        // Set the stored token and try to refresh it
        api.setToken(result.token);
        
        try {
          // Try to refresh the token via the backend
          const refreshed = await api.biometricRefresh();
          const freshToken = refreshed.access_token;
          const freshUser = refreshed.user;
          
          await AsyncStorage.setItem('auth_token', freshToken);
          await AsyncStorage.setItem('auth_user', JSON.stringify(freshUser));
          api.setToken(freshToken);
          
          setToken(freshToken);
          setUser(freshUser);
          
          // Update stored biometric credentials with fresh token
          await biometricService.enable(freshToken, freshUser);
          
          return true;
        } catch (refreshErr) {
          // Token expired, use stored data but warn user
          console.warn('Token refresh failed, stored credentials may be expired');
          
          // Clear biometric and force regular login
          await biometricService.disable();
          setIsBiometricEnabled(false);
          
          Alert.alert(
            'Session Expired',
            'Your session has expired. Please sign in with your password.',
          );
          return false;
        }
      } else {
        if (result.error && result.error !== 'Cancelled') {
          Alert.alert('Authentication Failed', result.error);
        }
        return false;
      }
    } catch (err) {
      console.error('Biometric login error:', err);
      return false;
    }
  };

  const enableBiometric = async (): Promise<boolean> => {
    if (!token || !user) return false;
    const success = await biometricService.enable(token, user);
    if (success) {
      setIsBiometricEnabled(true);
    }
    return success;
  };

  const disableBiometric = async () => {
    await biometricService.disable();
    setIsBiometricEnabled(false);
  };

  const logout = async () => {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('auth_user');
    api.setToken(null);
    setToken(null);
    setUser(null);
    // Don't disable biometric on logout — allow quick re-login
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      isBiometricAvailable,
      isBiometricEnabled,
      biometricLabel,
      login,
      register,
      logout,
      loginWithBiometric,
      enableBiometric,
      disableBiometric,
      checkBiometricStatus,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
