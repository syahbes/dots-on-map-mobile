# dots-on-map — Mobile App

Expo / React Native app that continuously tracks the device's GPS location and ships fixes to a backend API. Works fully offline: fixes are buffered in SQLite and flushed automatically when connectivity is restored.

## Running the app

Install dependencies first:

```bash
bun install
```

Then build and launch on a connected device or emulator:

```bash
# Android (emulator or USB device)
bunx expo run:android

# iOS (simulator or USB device)
bunx expo run:ios
```

> **Note:** `bunx expo run:*` performs a native build (requires Android Studio / Xcode). Use `bunx expo start` if you only want to run against Expo Go or an existing dev-client build.

## API configuration

The app talks to a backend. The base URL is resolved in this order:

1. `EXPO_PUBLIC_API_BASE_URL` environment variable (inlined at build time).
2. `expo.extra.apiBaseUrl` in `app.json`.
3. `http://localhost:3000` fallback (simulator only).

On Android, `localhost` / `127.0.0.1` are automatically rewritten to `10.0.2.2` (the emulator's alias for the host machine).

For **physical devices** you must set the env var to your machine's LAN IP:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.42:3000 bunx expo run:android
```

See `src/config.ts` for the full resolution logic.

## Authentication

The app authenticates users against an **AWS Cognito User Pool** (region `eu-west-2`) via [AWS Amplify v6](https://docs.amplify.aws/). There is no browser redirect or Hosted UI — sign-in happens natively using the SRP (`USER_SRP_AUTH`) flow.

### Key details

- **Invite-only** — the pool has self-service sign-up disabled. An admin must create user accounts through the backoffice.
- **First login** — Cognito returns a `NEW_PASSWORD_REQUIRED` challenge on first sign-in. The sign-in screen detects this and routes the user to a new-password screen which calls `confirmNewPassword`.
- **Identity** — after a successful sign-in, the Cognito `sub` claim (a stable UUID) is extracted from the ID token and persisted as the local `entityId`. Background tasks and API payloads use this value.
- **Session persistence** — Amplify refreshes tokens automatically; on app launch `getCurrentUser()` restores the session without requiring re-authentication.

### Amplify configuration

Cognito credentials are public constants (no client secret) and are baked in at `src/auth/amplifyConfig.ts`. No additional environment variables are required for auth.

| Constant | Value |
|---|---|
| Region | `eu-west-2` |
| User Pool ID | `eu-west-2_OaSqr3Cmr` |
| App Client ID | `274ng0a5mh96uq6l7bt95pd4s7` |

## Location tracking architecture

There are two parallel mechanisms for capturing GPS fixes. Both feed into the same `handleFix()` pipeline (`src/location/pipeline.ts`), so their output is identical.

### Background task (`src/location/task.ts`)

- Registered with `expo-task-manager` under the name `dots-background-location`.
- Started/stopped via `startLocationUpdatesAsync` / `stopLocationUpdatesAsync` in `src/location/tracking.ts`.
- Runs even when the app is **not in the foreground** (or is terminated on iOS with "Always" permission).
- On Android a persistent foreground-service notification is shown while the task is active.
- Duplicate fixes replayed by the Android JobScheduler are detected and silently dropped.

### Foreground watch (`src/location/TrackingContext.tsx`)

- A `watchPositionAsync` subscription managed inside `TrackingProvider`.
- Active only while the app is **in the foreground** and tracking is enabled.
- Exists because Android emulators tend to replay the same cached fix through the background task rather than delivering fresh ones. The watch subscription bypasses this and always returns real updates.
- Automatically starts/stops based on `AppState` changes — when the app backgrounds, the watch tears down and the background task takes over.

### Where to change the polling intervals

Both mechanisms use matching values so you only need to change them in two places:

**`src/location/tracking.ts`** — background task options:

```ts
timeInterval: 10_000,      // Android: minimum ms between updates
distanceInterval: 10,      // Android: minimum metres between updates
deferredUpdatesInterval: 30_000,  // iOS: batch delivery interval (ms)
deferredUpdatesDistance: 10,      // iOS: batch delivery distance (m)
```

**`src/location/TrackingContext.tsx`** — foreground watch options:

```ts
timeInterval: 10_000,   // minimum ms between updates
distanceInterval: 10,   // minimum metres between updates
```

Keep both files in sync. For testing on an emulator you can lower these values (e.g. `timeInterval: 2_000`, `distanceInterval: 0`).

## Offline queue

When a fix cannot be sent immediately (offline, server error, etc.) it is written to a local SQLite database (`src/db/locationDb.ts`). The flush logic in `src/network/flush.ts` drains the queue in batches of 100 whenever:

- A live fix succeeds (triggers a background drain).
- Network connectivity is restored (via `NetworkContext`).
- The user taps **"Flush queued points now"** on the Tracker screen.

Points rejected by the server for a client-side reason are permanently deleted to avoid infinite retries.

## Project structure

```
src/
  api/          HTTP client + endpoint wrappers
  app/          Expo Router screens (file-based routing)
  auth/
    amplifyConfig.ts   Amplify v6 Cognito setup (User Pool ID, Client ID)
    AuthContext.tsx    React context — signIn / signOut / confirmNewPassword
    entityStorage.ts   Secure storage for the persisted Cognito `sub`
  config.ts     API base URL resolution
  db/           SQLite offline queue
  location/
    task.ts         Background task definition
    tracking.ts     start/stop helpers + interval config
    TrackingContext.tsx  Foreground watch + React context
    pipeline.ts     Shared fix handler (live post → queue fallback)
  network/      NetInfo context + retro-batch flush
  ui/           Shared UI components
```

## Linting

```bash
bunx expo lint
```

to run on real device:
change api base url in app.json for example:

```json
"apiBaseUrl": "http://192.168.40.110:3000"
```
