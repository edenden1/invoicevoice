import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/contexts/AuthContext';
import { setSubscriptionExpiredCallback } from '../src/services/api';

function NavigationSetup() {
  const router = useRouter();
  useEffect(() => {
    setSubscriptionExpiredCallback(() => {
      router.replace('/subscription-expired');
    });
  }, [router]);
  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <NavigationSetup />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="invoice/[id]"
            options={{
              headerShown: true,
              title: 'Invoice Details',
              headerBackTitle: 'Back',
            }}
          />
          <Stack.Screen
            name="invoice/preview"
            options={{
              headerShown: true,
              title: 'Review Invoice',
              headerBackTitle: 'Back',
            }}
          />
          <Stack.Screen
            name="invoice/edit"
            options={{
              headerShown: true,
              title: 'Edit Invoice',
              headerBackTitle: 'Back',
            }}
          />
          <Stack.Screen
            name="settings"
            options={{
              headerShown: true,
              title: 'Settings',
              headerBackTitle: 'Back',
            }}
          />
          <Stack.Screen
            name="payme-callback"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="onboarding"
            options={{ headerShown: false, gestureEnabled: false }}
          />
          <Stack.Screen
            name="subscription-expired"
            options={{ headerShown: false, gestureEnabled: false }}
          />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
