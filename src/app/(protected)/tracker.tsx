import { router } from "expo-router";
import { useState } from "react";
import { Linking, Platform, ScrollView, StyleSheet, View } from "react-native";
import { Button, Divider, Switch, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/auth/AuthContext";
import { useTracking } from "@/location/TrackingContext";
import { useNetwork } from "@/network/NetworkContext";
import { InfoBanner } from "@/ui/InfoBanner";

function openSystemSettings() {
  if (Platform.OS === "ios") {
    void Linking.openURL("app-settings:");
  } else {
    void Linking.openSettings();
  }
}

export default function TrackerScreen() {
  const { user, signOut } = useAuth();
  const { isOn, permissions, setOn, requestBackgroundPermission } = useTracking();
  const { isOnline, queuedCount, flushNow } = useNetwork();
  const [busy, setBusy] = useState(false);

  const onToggle = async (next: boolean) => {
    setBusy(true);
    try {
      await setOn(next);
    } finally {
      setBusy(false);
    }
  };

  const canTrackBackground = permissions.backgroundGranted;
  const foregroundDenied = !permissions.foregroundGranted;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text variant="titleLarge" style={styles.title}>
              Hello, {user?.fullName ?? user?.email}
            </Text>
            <Text variant="bodySmall" style={styles.subtitle}>
              {user?.email}
            </Text>
          </View>
          <Button mode="text" compact onPress={() => void signOut()}>
            Sign out
          </Button>
        </View>

        <Divider style={styles.divider} />

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium">Location tracking</Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              {isOn ? "Recording your location." : "Not recording."}
            </Text>
          </View>
          <Switch value={isOn} onValueChange={onToggle} disabled={busy} />
        </View>

        {!isOn ? (
          <InfoBanner
            tone="warning"
            title="Tracking is OFF"
            description="Your location is not being recorded. Flip the switch above to start."
          />
        ) : null}

        {foregroundDenied ? (
          <InfoBanner
            tone="error"
            title="Location permission required"
            description="We can't record your location without permission. Open Settings to allow location access for this app."
            actionLabel="Open Settings"
            onAction={openSystemSettings}
          />
        ) : null}

        {!foregroundDenied && !canTrackBackground ? (
          <InfoBanner
            tone="warning"
            title="Background location disabled"
            description={
              Platform.OS === "ios"
                ? "We can only track you while the app is open. To keep recording in the background, change location access to \u201cAlways\u201d in iOS Settings."
                : "We can only track you while the app is open. Allow \u201cAll the time\u201d to keep recording in the background."
            }
            actionLabel="Enable background"
            onAction={async () => {
              const snap = await requestBackgroundPermission();
              if (!snap.backgroundGranted) {
                router.push("/(protected)/permissions-help");
              }
            }}
            secondaryActionLabel="How?"
            onSecondaryAction={() => router.push("/(protected)/permissions-help")}
          />
        ) : null}

        {isOn && canTrackBackground ? (
          <InfoBanner
            tone="success"
            title="Tracking is ON"
            description="Your location is being recorded \u2014 including when the app is in the background."
          />
        ) : null}

        <Divider style={styles.divider} />

        <View style={styles.statusRow}>
          <StatusPill label="Network" value={isOnline ? "Online" : "Offline"} ok={isOnline} />
          <StatusPill
            label="Queued"
            value={String(queuedCount)}
            ok={queuedCount === 0}
          />
        </View>

        {queuedCount > 0 && isOnline ? (
          <Button
            mode="outlined"
            onPress={() => void flushNow()}
            style={{ marginTop: 12 }}
          >
            Flush {queuedCount} queued point{queuedCount === 1 ? "" : "s"} now
          </Button>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusPill({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: ok ? "#E6F4EA" : "#FFF4E5", borderColor: ok ? "#1E8E3E" : "#F5A623" },
      ]}
    >
      <Text variant="labelSmall" style={{ opacity: 0.6 }}>
        {label}
      </Text>
      <Text variant="titleSmall" style={{ color: ok ? "#0B6B2B" : "#8A4B00" }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: 20, gap: 8 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  title: { fontWeight: "700" },
  subtitle: { opacity: 0.7 },
  divider: { marginVertical: 12 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusRow: {
    flexDirection: "row",
    gap: 10,
  },
  pill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    gap: 2,
  },
});
