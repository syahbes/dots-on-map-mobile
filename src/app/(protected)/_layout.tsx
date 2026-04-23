import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/auth/AuthContext";

export default function ProtectedLayout() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (status !== "signed-in") {
    return <Redirect href="/" />;
  }

  return (
    <Stack>
      <Stack.Screen name="tracker" options={{ title: "Tracker" }} />
      <Stack.Screen name="permissions-help" options={{ title: "Enable background location" }} />
    </Stack>
  );
}
