import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const BIOMETRIC_TOKEN_KEY = 'biometric_token';
const BIOMETRIC_USER_KEY = 'biometric_user';

export type BiometricType = 'face' | 'fingerprint' | 'iris' | 'none';

class BiometricService {
  /**
   * Check if device has biometric hardware
   */
  async isAvailable(): Promise<boolean> {
    // Web doesn't support local biometric auth
    if (Platform.OS === 'web') return false;

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch {
      return false;
    }
  }

  /**
   * Get the type of biometric available (Face ID, Fingerprint, etc.)
   */
  async getBiometricType(): Promise<BiometricType> {
    if (Platform.OS === 'web') return 'none';

    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        return 'face';
      }
      if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        return 'fingerprint';
      }
      if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        return 'iris';
      }
    } catch {}
    return 'none';
  }

  /**
   * Get a user-friendly label for the biometric type
   */
  async getBiometricLabel(): Promise<string> {
    const type = await this.getBiometricType();
    switch (type) {
      case 'face':
        return Platform.OS === 'ios' ? 'Face ID' : 'Face Recognition';
      case 'fingerprint':
        return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
      case 'iris':
        return 'Iris Scan';
      default:
        return 'Biometrics';
    }
  }

  /**
   * Check if biometric login is enabled by the user
   */
  async isEnabled(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    try {
      const val = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      return val === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Enable biometric login and store the current token/user
   */
  async enable(token: string, user: object): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    try {
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
      await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, token);
      await SecureStore.setItemAsync(BIOMETRIC_USER_KEY, JSON.stringify(user));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Disable biometric login and clear stored credentials
   */
  async disable(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIC_TOKEN_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIC_USER_KEY);
    } catch {}
  }

  /**
   * Update the stored token (e.g., after a refresh)
   */
  async updateToken(token: string): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      const enabled = await this.isEnabled();
      if (enabled) {
        await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, token);
      }
    } catch {}
  }

  /**
   * Prompt biometric authentication and return stored credentials
   */
  async authenticate(): Promise<{
    success: boolean;
    token?: string;
    user?: any;
    error?: string;
  }> {
    if (Platform.OS === 'web') {
      return { success: false, error: 'Not available on web' };
    }

    try {
      const enabled = await this.isEnabled();
      if (!enabled) {
        return { success: false, error: 'Biometric login not enabled' };
      }

      const label = await this.getBiometricLabel();
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Sign in with ${label}`,
        cancelLabel: 'Use Password',
        disableDeviceFallback: false,
      });

      if (result.success) {
        const token = await SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY);
        const userStr = await SecureStore.getItemAsync(BIOMETRIC_USER_KEY);
        
        if (token && userStr) {
          return {
            success: true,
            token,
            user: JSON.parse(userStr),
          };
        } else {
          // Credentials were cleared, disable biometric
          await this.disable();
          return { success: false, error: 'Stored credentials expired. Please sign in with your password.' };
        }
      } else {
        return {
          success: false,
          error: result.error === 'user_cancel' ? 'Cancelled' : 'Authentication failed',
        };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Authentication error' };
    }
  }

  /**
   * Get stored user email for display on login screen
   */
  async getStoredUserEmail(): Promise<string | null> {
    if (Platform.OS === 'web') return null;
    try {
      const userStr = await SecureStore.getItemAsync(BIOMETRIC_USER_KEY);
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.email || null;
      }
    } catch {}
    return null;
  }
}

export const biometricService = new BiometricService();
