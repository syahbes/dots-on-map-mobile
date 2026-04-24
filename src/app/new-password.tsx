import { Redirect, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import { Button, Text, TextInput, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/auth/AuthContext";
import { InfoBanner } from "@/ui/InfoBanner";

/**
 * Client-side mirror of the Cognito password policy (see integration guide).
 * Cognito will re-enforce this server-side; we just fail early for nicer UX.
 */
function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Must be at least 8 characters.";
  if (!/[a-z]/.test(pw)) return "Must include a lowercase letter.";
  if (!/[A-Z]/.test(pw)) return "Must include an uppercase letter.";
  if (!/[0-9]/.test(pw)) return "Must include a number.";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Must include a symbol.";
  return null;
}

export default function NewPasswordScreen() {
  const theme = useTheme();
  const { status, pending, confirmNewPassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If the user lands here without an active challenge, bounce them.
  if (status === "signed-in") {
    return <Redirect href="/(protected)/tracker" />;
  }
  if (!pending || pending.kind !== "new-password-required") {
    return <Redirect href="/sign-in" />;
  }

  const onSubmit = async () => {
    setErrorMsg(null);

    const policyError = validatePassword(password);
    if (policyError) {
      setErrorMsg(policyError);
      return;
    }
    if (password !== confirm) {
      setErrorMsg("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await confirmNewPassword(password);
      router.replace("/(protected)/tracker");
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "Could not set password.";
      setErrorMsg(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
      edges={["top", "bottom"]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text variant="displaySmall" style={styles.title}>
            Set a new password
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            First-time sign in for {pending.email}. Choose a new password to finish logging in.
          </Text>

          {errorMsg ? (
            <InfoBanner tone="error" title="Couldn't set password" description={errorMsg} />
          ) : null}

          <TextInput
            label="New password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry
            autoComplete="new-password"
            style={styles.input}
          />
          <TextInput
            label="Confirm new password"
            value={confirm}
            onChangeText={setConfirm}
            mode="outlined"
            secureTextEntry
            autoComplete="new-password"
            style={styles.input}
          />

          <Text variant="bodySmall" style={styles.hint}>
            8+ chars, with an uppercase, lowercase, number and symbol.
          </Text>

          <Button
            mode="contained"
            onPress={onSubmit}
            loading={submitting}
            disabled={submitting || !password || !confirm}
            style={styles.button}
          >
            Set password & continue
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
  hint: { marginTop: 8, opacity: 0.7 },
  button: { marginTop: 20, paddingVertical: 4 },
});
