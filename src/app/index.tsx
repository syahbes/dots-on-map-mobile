import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useTheme } from "react-native-paper";

import { useAuth } from "@/auth/AuthContext";

/**
 * Root route.
 *
 * The PaperRound Cognito pool is invite-only, so there's no self-service
 * sign-up screen. We just route to sign-in (or the protected area if the
 * user already has a session).
 */
export default function IndexScreen() {
  const theme = useTheme();
  const { status, pending } = useAuth();

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

  if (status === "signed-in") {
    return <Redirect href="/(protected)/tracker" />;
  }

  if (pending?.kind === "new-password-required") {
    return <Redirect href="/new-password" />;
  }

  return <Redirect href="/sign-in" />;
}
