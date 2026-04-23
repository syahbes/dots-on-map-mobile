import { Link, Redirect, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { InfoBanner } from "@/ui/InfoBanner";

const ERROR_COPY: Record<string, string> = {
  invalid_email: "That doesn't look like a valid email address.",
  invalid_full_name: "Please enter your full name.",
  password_too_short: "Password must be at least 6 characters.",
  email_not_whitelisted: "This email isn't allowed to sign up yet. Ask an admin to whitelist it.",
  email_already_registered: "An account with that email already exists. Try signing in instead.",
};

export default function SignUpScreen() {
  const { status, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
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
      await signUp({ email: email.trim(), fullName: fullName.trim(), password });
      router.replace("/(protected)/tracker");
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(ERROR_COPY[err.code ?? ""] ?? err.message ?? "Sign-up failed.");
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
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="displaySmall" style={styles.title}>
            Create account
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Sign up to start tracking your route.
          </Text>

          {errorMsg ? (
            <InfoBanner tone="error" title="Sign-up failed" description={errorMsg} />
          ) : null}

          <TextInput
            label="Full name"
            value={fullName}
            onChangeText={setFullName}
            mode="outlined"
            autoCapitalize="words"
            autoComplete="name"
            style={styles.input}
          />
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
            autoComplete="new-password"
            style={styles.input}
          />

          <Button
            mode="contained"
            onPress={onSubmit}
            loading={submitting}
            disabled={submitting || !email || !fullName || !password}
            style={styles.button}
          >
            Sign up
          </Button>

          <View style={styles.footer}>
            <Text variant="bodyMedium">Already have an account?</Text>
            <Link href="/sign-in" replace>
              <Text variant="bodyMedium" style={styles.link}>
                Sign in
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
