import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { CustomerProvider, useCustomers } from "@/contexts/CustomerContext";
import { TiffinProvider, useTiffins } from "@/contexts/TiffinContext";
import { CateringProvider, useCatering } from "@/contexts/CateringContext";
import { SettingsProvider, useSettings } from "@/contexts/SettingsContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { trpc, trpcClient } from "@/lib/trpc";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 5 * 60 * 1000,
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: false,
      networkMode: 'offlineFirst',
    },
  },
});

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="add-customer" options={{ presentation: "modal", title: "Add Customer" }} />
      <Stack.Screen name="add-tiffin" options={{ presentation: "modal", title: "Add Tiffin Entry" }} />
      <Stack.Screen name="add-catering" options={{ presentation: "modal", title: "Add Catering Order" }} />
      <Stack.Screen name="generate-invoice" options={{ presentation: "modal", title: "Generate Invoice" }} />
      <Stack.Screen name="view-entries" options={{ title: "View Entries" }} />
      <Stack.Screen name="outstanding-report" options={{ title: "Outstanding Report" }} />
      <Stack.Screen name="monthly-entries" options={{ title: "Monthly Entries" }} />
      <Stack.Screen name="sync-diagnostics" options={{ title: "Sync Diagnostics" }} />
    </Stack>
  );
}

function AppContent() {
  const { isLoading: customersLoading } = useCustomers();
  const { isLoading: tiffinsLoading } = useTiffins();
  const { isLoading: cateringLoading } = useCatering();
  const { isLoading: settingsLoading } = useSettings();
  const { isLoading: themeLoading, isDark } = useTheme();
  const [isReady, setIsReady] = useState(false);

  const isLoading = customersLoading || tiffinsLoading || cateringLoading || settingsLoading || themeLoading;

  useEffect(() => {
    if (!isLoading && !isReady) {
      setIsReady(true);
      setTimeout(() => {
        SplashScreen.hideAsync();
      }, 100);
    }
  }, [isLoading, isReady]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }}>
        <ActivityIndicator size="large" color={isDark ? '#ffffff' : '#000000'} />
      </View>
    );
  }

  return <RootLayoutNav />;
}

export default function RootLayout() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ThemeProvider>
            <SettingsProvider>
              <CustomerProvider>
                <TiffinProvider>
                  <CateringProvider>
                    <AppContent />
                  </CateringProvider>
                </TiffinProvider>
              </CustomerProvider>
            </SettingsProvider>
          </ThemeProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
