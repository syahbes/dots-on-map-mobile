import { Link, Redirect, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { InfoBanner } from "@/ui/InfoBanner";

const ERROR_COPY: Record<string, string> = {
  invalid_credentials: "Email or password is incorrect.",
  invalid_credentials_shape: "Please enter a valid email and password.",
};

export default function SignInScreen() {
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
      await signIn({ email: email.trim(), password });
      router.replace("/(protected)/tracker");
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(ERROR_COPY[err.code ?? ""] ?? err.message ?? "Sign-in failed.");
      } else {
        setErrorMsg("Network error. Is the backend running?");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="displaySmall" style={styles.title}>
            Welcome back
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Sign in to continue tracking.
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

          <View style={styles.footer}>
            <Text variant="bodyMedium">Don&apos;t have an account?</Text>
            <Link href="/" replace>
              <Text variant="bodyMedium" style={styles.link}>
                Sign up
              </Text>
            </Link>
          </View>
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
  footer: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  link: { fontWeight: "600", textDecorationLine: "underline" },
});
