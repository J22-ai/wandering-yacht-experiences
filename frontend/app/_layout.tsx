import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/context/AuthContext';
import { FavoritesProvider } from '../src/context/FavoritesContext';
import { LanguageProvider } from '../src/context/LanguageContext';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'TraditionalArabic': require('../assets/fonts/TraditionalArabic-Regular.ttf'),
    'TraditionalArabic-Bold': require('../assets/fonts/TraditionalArabic-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.splashBrandName}>WANDERING YACHT</Text>
        <ActivityIndicator size="large" color="#1a3a4a" style={{ marginTop: 20 }} />
      </View>
    );
  }

  return (
    <LanguageProvider>
    <AuthProvider>
      <FavoritesProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#faf9f7' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/login" options={{ presentation: 'modal' }} />
        <Stack.Screen name="auth/register" options={{ presentation: 'modal' }} />
        <Stack.Screen name="experience/[id]" />
        <Stack.Screen name="checkout/[bookingId]" />
        <Stack.Screen name="about" />
        <Stack.Screen name="ticket/[id]" options={{ presentation: 'modal' }} />
      </Stack>
      </FavoritesProvider>
    </AuthProvider>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#faf9f7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashBrandName: {
    fontSize: 28,
    color: '#000000',
    fontWeight: '700',
    letterSpacing: 6,
  },
});
