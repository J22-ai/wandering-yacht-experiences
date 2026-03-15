import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/context/AuthContext';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Platform, View } from 'react-native';

SplashScreen.preventAutoHideAsync();

const STRIPE_PUBLISHABLE_KEY = 'pk_test_51KBnQnAAJ71rK5VLkxWJ0Ea0UIAUUjZSTiAi9iEOLP4uzSqzqwjafP6ZMSSUxcpnm6KzlOirplM5RP8VruZjXJzD001D6T4L8P';

// Conditionally import StripeProvider only for native
let StripeProvider: any = null;
if (Platform.OS !== 'web') {
  StripeProvider = require('@stripe/stripe-react-native').StripeProvider;
}

function AppContent({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web' && StripeProvider) {
    return (
      <StripeProvider
        publishableKey={STRIPE_PUBLISHABLE_KEY}
        merchantIdentifier="merchant.com.wanderingyacht"
        urlScheme="wanderingyacht"
      >
        {children}
      </StripeProvider>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    // You can add custom fonts here
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AuthProvider>
      <AppContent>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0a1628' },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth/login" options={{ presentation: 'modal' }} />
          <Stack.Screen name="auth/register" options={{ presentation: 'modal' }} />
          <Stack.Screen name="experience/[id]" />
          <Stack.Screen name="booking/[id]" />
          <Stack.Screen name="checkout/[bookingId]" />
          <Stack.Screen name="ticket/[id]" options={{ presentation: 'modal' }} />
        </Stack>
      </AppContent>
    </AuthProvider>
  );
}
