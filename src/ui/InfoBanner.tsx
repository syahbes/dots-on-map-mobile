import React from "react";
import { StyleSheet, View } from "react-native";
import { Button, Surface, Text, useTheme } from "react-native-paper";

export type InfoBannerTone = "info" | "warning" | "error" | "success";

type Props = {
  tone?: InfoBannerTone;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
};

const LIGHT_TONES: Record<
  InfoBannerTone,
  { bg: string; border: string; text: string }
> = {
  info: { bg: "#E8F0FE", border: "#4285F4", text: "#174EA6" },
  warning: { bg: "#FFF4E5", border: "#F5A623", text: "#8A4B00" },
  error: { bg: "#FDECEA", border: "#D93025", text: "#7A1F16" },
  success: { bg: "#E6F4EA", border: "#1E8E3E", text: "#0B6B2B" },
};

const DARK_TONES: Record<
  InfoBannerTone,
  { bg: string; border: string; text: string }
> = {
  info: { bg: "#0F2A4A", border: "#4285F4", text: "#D7E3FC" },
  warning: { bg: "#3A2A0A", border: "#F5A623", text: "#FCE5B8" },
  error: { bg: "#3A1512", border: "#D93025", text: "#F8C8C3" },
  success: { bg: "#0F2A18", border: "#1E8E3E", text: "#BFE5CB" },
};

export function InfoBanner({
  tone = "info",
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: Props) {
  const theme = useTheme();
  const palette = (theme.dark ? DARK_TONES : LIGHT_TONES)[tone];

  return (
    <Surface
      elevation={0}
      style={[
        styles.container,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
        },
      ]}
    >
      <Text
        variant="titleMedium"
        style={[styles.title, { color: palette.text }]}
      >
        {title}
      </Text>
      {description ? (
        <Text
          variant="bodyMedium"
          style={[styles.description, { color: palette.text }]}
        >
          {description}
        </Text>
      ) : null}
      {(actionLabel || secondaryActionLabel) && (
        <View style={styles.actions}>
          {actionLabel ? (
            <Button
              mode="contained"
              onPress={onAction}
              buttonColor={
                tone === "error" ? theme.colors.error : theme.colors.primary
              }
              textColor={
                tone === "error" ? theme.colors.onError : theme.colors.onPrimary
              }
              compact
            >
              {actionLabel}
            </Button>
          ) : null}
          {secondaryActionLabel ? (
            <Button
              mode="text"
              onPress={onSecondaryAction}
              textColor={palette.text}
              compact
            >
              {secondaryActionLabel}
            </Button>
          ) : null}
        </View>
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 14,
    gap: 6,
    marginVertical: 8,
  },
  title: {
    fontWeight: "600",
  },
  description: {
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
});
