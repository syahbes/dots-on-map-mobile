// Crypto polyfill required by Amplify's SRP auth. Must be imported before
// anything that transitively imports `aws-amplify`.
import "react-native-get-random-values";

import { Stack } from "expo-router";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from "react-native-paper";

import { configureAmplify } from "@/auth/amplifyConfig";
import { AuthProvider } from "@/auth/AuthContext";
import { NetworkProvider } from "@/network/NetworkContext";
import { TrackingProvider } from "@/location/TrackingContext";

// Register the background location task at top-level so it's available as
// soon as the JS engine boots — including background re-launches.
import "@/location/task";

// Configure Amplify once, at module load, before any Auth hook runs.
configureAmplify();

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? MD3DarkTheme : MD3LightTheme;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <NetworkProvider>
            <TrackingProvider>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="sign-in" />
                <Stack.Screen name="new-password" />
                <Stack.Screen name="(protected)" />
              </Stack>
            </TrackingProvider>
          </NetworkProvider>
        </AuthProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
