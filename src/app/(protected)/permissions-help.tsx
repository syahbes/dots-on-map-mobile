import { Linking, Platform, ScrollView, StyleSheet } from "react-native";
import { Button, Divider, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

function openSystemSettings() {
  if (Platform.OS === "ios") {
    void Linking.openURL("app-settings:");
  } else {
    void Linking.openSettings();
  }
}

export default function PermissionsHelpScreen() {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text variant="headlineSmall" style={styles.title}>
          Enable background location
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Background location lets the app keep recording your route when the screen is off or
          when you switch to another app.
        </Text>

        <Divider style={styles.divider} />

        <Text variant="titleMedium" style={styles.sectionTitle}>
          iOS
        </Text>
        <Text variant="bodyMedium" style={styles.paragraph}>
          iOS only asks once. If you tapped <Text style={styles.bold}>Allow Once</Text> or
          <Text style={styles.bold}> Don&apos;t Allow</Text> in the first prompt, the system will
          silently refuse any later request from the app. You need to enable it manually.
        </Text>
        <Text variant="bodyMedium" style={styles.paragraph}>
          <Text style={styles.bold}>Steps:</Text>
          {"\n"}1. Tap <Text style={styles.bold}>Open Settings</Text> below.
          {"\n"}2. Scroll to <Text style={styles.bold}>Location</Text>.
          {"\n"}3. Choose <Text style={styles.bold}>Always</Text>.
          {"\n"}4. Make sure <Text style={styles.bold}>Precise Location</Text> is ON.
          {"\n"}5. Return to the app and toggle tracking again.
        </Text>

        <Divider style={styles.divider} />

        <Text variant="titleMedium" style={styles.sectionTitle}>
          Android
        </Text>
        <Text variant="bodyMedium" style={styles.paragraph}>
          <Text style={styles.bold}>Steps:</Text>
          {"\n"}1. Tap <Text style={styles.bold}>Open Settings</Text> below.
          {"\n"}2. Open <Text style={styles.bold}>Permissions &rarr; Location</Text>.
          {"\n"}3. Choose <Text style={styles.bold}>Allow all the time</Text>.
          {"\n"}4. Disable battery optimisation for the app if your vendor is strict
          (Samsung, Xiaomi, OnePlus, Huawei can kill background apps aggressively).
        </Text>

        <Button
          mode="contained"
          onPress={openSystemSettings}
          style={styles.button}
        >
          Open Settings
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: 20 },
  title: { fontWeight: "700", marginBottom: 6 },
  subtitle: { opacity: 0.75, marginBottom: 6 },
  divider: { marginVertical: 16 },
  sectionTitle: { fontWeight: "700", marginBottom: 8 },
  paragraph: { marginBottom: 12, lineHeight: 22 },
  bold: { fontWeight: "700" },
  button: { marginTop: 20, paddingVertical: 4 },
});
