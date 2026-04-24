import { Amplify } from "aws-amplify";

/**
 * AWS Cognito User Pool connection details for the PaperRound mobile app.
 *
 * Values provided by Mike Maynard (see PaperRound Mobile Auth — Cognito
 * Integration Guide). Public client — no secret — which is why it's safe to
 * ship these constants in the app bundle.
 */
export const COGNITO_REGION = "eu-west-2";
export const COGNITO_USER_POOL_ID = "eu-west-2_OaSqr3Cmr";
export const COGNITO_APP_CLIENT_ID = "274ng0a5mh96uq6l7bt95pd4s7";

let configured = false;

/**
 * Idempotently configure AWS Amplify v6 for Cognito user-pool auth via native
 * SRP (no Hosted UI, no browser redirect). Safe to call more than once.
 */
export function configureAmplify(): void {
  if (configured) return;
  configured = true;

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: COGNITO_USER_POOL_ID,
        userPoolClientId: COGNITO_APP_CLIENT_ID,
        loginWith: { email: true },
      },
    },
  });

  console.log("[cognito] Amplify configured", {
    region: COGNITO_REGION,
    userPoolId: COGNITO_USER_POOL_ID,
    userPoolClientId: COGNITO_APP_CLIENT_ID,
  });
}
