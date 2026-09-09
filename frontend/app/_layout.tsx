import React, { useEffect, useState, useCallback } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/context/AuthContext';
import { FavoritesProvider } from '../src/context/FavoritesContext';
import { LanguageProvider } from '../src/context/LanguageContext';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { View, Text, StyleSheet } from 'react-native';

// Prevent auto-hide but don't block app if it fails
try {
  SplashScreen.preventAutoHideAsync();
} catch (e) {
  console.warn('SplashScreen.preventAutoHideAsync failed:', e);
}

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    'TraditionalArabic': require('../assets/fonts/TraditionalArabic-Regular.ttf'),
    'TraditionalArabic-Bold': require('../assets/fonts/TraditionalArabic-Bold.ttf'),
  });

  useEffect(() => {
    // Set app ready after a short delay, regardless of font status
    const timer = setTimeout(() => {
      setAppIsReady(true);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Also set ready when fonts load (whichever comes first)
    if (fontsLoaded || fontError) {
      setAppIsReady(true);
    }
  }, [fontsLoaded, fontError]);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {
        console.warn('SplashScreen.hideAsync failed:', e);
      }
    }
  }, [appIsReady]);

  if (!appIsReady) {
    // Return a minimal view while loading
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
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
      </SafeAreaProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#1a3a4a',
  },
});
