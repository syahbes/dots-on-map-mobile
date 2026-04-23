import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";

import { AuthProvider } from "@/auth/AuthContext";
import { NetworkProvider } from "@/network/NetworkContext";
import { TrackingProvider } from "@/location/TrackingContext";

// Register the background location task at top-level so it's available as
// soon as the JS engine boots — including background re-launches.
import "@/location/task";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider>
        <AuthProvider>
          <NetworkProvider>
            <TrackingProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="sign-in" />
                <Stack.Screen name="(protected)" />
              </Stack>
            </TrackingProvider>
          </NetworkProvider>
        </AuthProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
