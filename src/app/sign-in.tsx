import { Redirect, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import { Button, Text, TextInput, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/auth/AuthContext";
import { InfoBanner } from "@/ui/InfoBanner";

/**
 * Map Cognito error `name`s to friendly copy. The pool has
 * `PreventUserExistenceErrors: ENABLED` so bad emails surface as
 * `NotAuthorizedException` — we lump those in with wrong-password.
 */
function describeSignInError(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  switch (name) {
    case "NotAuthorizedException":
    case "UserNotFoundException":
      return "Incorrect email or password.";
    case "PasswordResetRequiredException":
      return "An admin has reset your password. Use \"Forgot password?\" to set a new one.";
    case "LimitExceededException":
    case "TooManyRequestsException":
      return "Too many attempts, please try again later.";
    case "UserNotConfirmedException":
      return "This account isn't confirmed yet. Contact your admin.";
    case "NetworkError":
      return "Network error. Check your connection and try again.";
    default:
      return err instanceof Error && err.message ? err.message : "Sign-in failed.";
  }
}

export default function SignInScreen() {
  const theme = useTheme();
  const { status, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (status === "signed-in") {
    return <Redirect href="/(protected)/tracker" />;
  }

  const onSubmit = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const { requiresNewPassword } = await signIn({ email: email.trim(), password });
      if (requiresNewPassword) {
        router.replace("/new-password");
        return;
      }
      router.replace("/(protected)/tracker");
    } catch (err) {
      setErrorMsg(describeSignInError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="displaySmall" style={styles.title}>
            Welcome back
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Sign in with your PaperRound email and password.
          </Text>

          {errorMsg ? (
            <InfoBanner tone="error" title="Sign-in failed" description={errorMsg} />
          ) : null}

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            style={styles.input}
          />
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry
            autoComplete="current-password"
            style={styles.input}
          />

          <Button
            mode="contained"
            onPress={onSubmit}
            loading={submitting}
            disabled={submitting || !email || !password}
            style={styles.button}
          >
            Sign in
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24, justifyContent: "center", gap: 6 },
  title: { fontWeight: "700", marginBottom: 4 },
  subtitle: { marginBottom: 16, opacity: 0.7 },
  input: { marginTop: 8 },
  button: { marginTop: 20, paddingVertical: 4 },
});
