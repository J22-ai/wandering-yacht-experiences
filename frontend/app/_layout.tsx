import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/context/AuthContext';
import { StripeProvider } from '@stripe/stripe-react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

const STRIPE_PUBLISHABLE_KEY = 'pk_test_51KBnQnAAJ71rK5VLkxWJ0Ea0UIAUUjZSTiAi9iEOLP4uzSqzqwjafP6ZMSSUxcpnm6KzlOirplM5RP8VruZjXJzD001D6T4L8P';

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
      <StripeProvider
        publishableKey={STRIPE_PUBLISHABLE_KEY}
        merchantIdentifier="merchant.com.wanderingyacht"
        urlScheme="wanderingyacht"
      >
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
      </StripeProvider>
    </AuthProvider>
  );
}
