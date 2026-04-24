import * as SecureStore from "expo-secure-store";

/**
 * The signed-in user's `entityId` (e.g. "1876") persisted in SecureStore so a
 * background task re-launched by the OS can still attach an owner to the fixes
 * it sends. There's no real auth right now — the "email" field on sign-in is
 * treated as the entityId.
 */
const KEY = "dots_entity_id";

export async function getEntityId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function setEntityId(entityId: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, entityId);
}

export async function clearEntityId(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    /* ignore */
  }
}
