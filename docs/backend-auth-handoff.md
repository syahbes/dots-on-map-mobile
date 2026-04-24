# Mobile → Backend Auth Handoff

> **Audience:** backend developer on the geo-tracking API (`*.ppruk.net`)
> **From:** mobile (`dots-on-map-mobile`)
> **Goal:** tell you exactly what the mobile app now sends on every authenticated request and what you need to do with it.

---

## TL;DR

The mobile app now authenticates users against the PaperRound Cognito User Pool using native SRP (no Hosted UI, no browser redirect). Every request to the backend carries:

1. `x-api-key: <shared key>` — unchanged, same value as before.
2. `Authorization: Bearer <cognito-access-token>` — **new**. A JWT issued by our Cognito User Pool.

Please validate the JWT on every request and trust `claims.sub` as the caller's identity. Once you're confident in JWT verification, the mobile app will drop the `x-api-key` header.

---

## 1. Cognito pool details

```
AWS Region:    eu-west-2
User Pool ID:  eu-west-2_OaSqr3Cmr
App Client ID: 274ng0a5mh96uq6l7bt95pd4s7   ← mobile client (public, no secret)
Issuer (iss):  https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_OaSqr3Cmr
JWKS URL:      https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_OaSqr3Cmr/.well-known/jwks.json
```

This pool is **invite-only** — there's no self-service sign-up. Users are created by admins in the backoffice; Cognito emails them a temp password and on first login they set their own.

---

## 2. What the mobile app sends

Headers on every authenticated request:

```
Accept: application/json
Content-Type: application/json          # only on requests with a body
x-api-key: <shared key>
Authorization: Bearer <access-token>    # Cognito-issued JWT
```

The Bearer token is a **Cognito access token** (not the ID token). Amplify auto-refreshes it from the refresh token, so it's always fresh when it hits you.

Unauthenticated calls: if the mobile user is not signed in, the app sends the request **without** the `Authorization` header (rather than silently dropping it). Please respond with `401` in that case so the client can surface it.

---

## 3. What the JWT looks like

Decoded payload of a typical access token from this pool:

```json
{
  "sub": "b3d9a3e2-7b5c-4a0a-9e2a-6f12ab34cd56",
  "iss": "https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_OaSqr3Cmr",
  "client_id": "274ng0a5mh96uq6l7bt95pd4s7",
  "token_use": "access",
  "scope": "aws.cognito.signin.user.admin",
  "auth_time": 1714000000,
  "exp":       1714003600,
  "iat":       1714000000,
  "jti":       "…",
  "username":  "b3d9a3e2-7b5c-4a0a-9e2a-6f12ab34cd56"
}
```

Notes:

- `sub` is the **stable UUID** Cognito assigns at user creation. It never changes — not on email change, not on password reset. **Use this as the user's foreign key everywhere.**
- Cognito access tokens do **not** include `email`, `name`, or the `custom:Roles` / `custom:Permissions` attributes. Those only live on the **ID token**. If you need them server-side you have two options:
  - (a) call `AdminGetUser` / `GetUser` on Cognito when you need them, or
  - (b) ask the mobile app to also forward the ID token in a separate header (we haven't done this — shout if you need it).
- Access tokens expire after 60 minutes by default. Refresh is handled transparently on the client.

---

## 4. What the backend must do

On every protected route:

1. **Verify the JWT signature** against the pool's JWKS (URL above). Cache the JWKS, rotate on `kid` miss.
2. **Verify the claims**:
   - `iss === "https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_OaSqr3Cmr"`
   - `token_use === "access"`
   - `client_id === "274ng0a5mh96uq6l7bt95pd4s7"` (mobile client). If/when a web client gets added, extend this to a whitelist.
   - `exp` is in the future.
3. **Trust `claims.sub`** as the user's identity. Do NOT trust any user identifier coming from the request body or query string.
4. On failure, respond `401` with a short JSON error (`{ "error": "invalid_token" }` or similar).

### Recommended libraries

- Node / TypeScript: [`aws-jwt-verify`](https://github.com/awslabs/aws-jwt-verify) — AWS-maintained, handles JWKS caching and all the claim checks in ~5 lines:
  ```ts
  import { CognitoJwtVerifier } from "aws-jwt-verify";

  const verifier = CognitoJwtVerifier.create({
    userPoolId: "eu-west-2_OaSqr3Cmr",
    tokenUse: "access",
    clientId: "274ng0a5mh96uq6l7bt95pd4s7",
  });

  const claims = await verifier.verify(bearerToken); // throws on any failure
  const userId = claims.sub;
  ```
- Python: [`python-jose`](https://github.com/mpdavis/python-jose) + manual JWKS fetch, or AWS Lambda Powertools if you're on Lambda.
- Go: [`github.com/lestrrat-go/jwx/v2/jwt`](https://github.com/lestrrat-go/jwx).

---

## 5. Current payload shapes (transition note)

The mobile app currently still sends `entityId` inside every request body (legacy field used before Cognito existed). During the migration, please:

- **Prefer `claims.sub`** as the source of truth for who the caller is.
- Treat body-level `entityId` as advisory / legacy. If it disagrees with `claims.sub`, use `claims.sub`.
- Once you've switched over and nothing else depends on the old value, ping us — we'll drop `entityId` from the payloads on the mobile side.

Current body shapes (unchanged, for reference):

`POST /v1/location`
```json
{
  "tenantId":   "paperround",
  "entityType": "trunkingAgent",
  "entityId":   "<string — currently the Cognito sub, will eventually be removed>",
  "lat":        51.5,
  "lng":        -0.1,
  "heading":    null,
  "speed":      null,
  "accuracy":   null,
  "ts":         1714000000000
}
```

`POST /v1/locations`
```json
{
  "tenantId":   "paperround",
  "entityType": "trunkingAgent",
  "entityId":   "<string>",
  "pings":      [ /* same shape as /v1/location, minus tenant/entity fields */ ]
}
```

`POST /v1/status`
```json
{
  "tenantId":   "paperround",
  "entityType": "trunkingAgent",
  "entityId":   "<string>",
  "status":     "online" | "offline",
  "ts":         1714000000000
}
```

---

## 6. Test user

A test user already exists in the pool:

- Email: `mike.maynard@paperround.tech`
- Ping **Mike Maynard** (`mike.maynard@paperround.tech`) for a password reset trigger or additional test users.

---

## 7. Things to NOT do

- ❌ Don't accept a user ID from the request body / query string for authorization decisions — always take it from the verified JWT.
- ❌ Don't disable signature verification "for dev". If you need to test without Cognito, spin up a local issuer with the same JWKS contract.
- ❌ Don't rely on `email` or `custom:Roles` being in the access token — they aren't. Use the ID token or call Cognito if you need them.

---

## 8. Questions

Auth plumbing on the mobile side → me.
Cognito pool configuration / creating users / resetting passwords → Mike Maynard.
