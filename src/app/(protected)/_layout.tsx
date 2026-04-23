import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useTheme } from "react-native-paper";

import { useAuth } from "@/auth/AuthContext";

export default function ProtectedLayout() {
  const theme = useTheme();
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (status !== "signed-in") {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.onSurface,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="tracker" options={{ title: "Tracker" }} />
      <Stack.Screen name="permissions-help" options={{ title: "Enable background location" }} />
    </Stack>
  );
}
