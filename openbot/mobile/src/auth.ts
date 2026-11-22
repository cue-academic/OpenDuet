import { expoClient } from "@better-auth/expo/client";
import { ssoClient } from "@better-auth/sso/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { readServerUrl } from "./server-url";

const server = readServerUrl(process.env.EXPO_PUBLIC_SERVER_URL, __DEV__);
/** Why this build cannot reach a server. The layout shows it in place of every screen. */
export const serverProblem = server.problem;
// The placeholder is never requested: no screen renders while `serverProblem` is set.
const endpoint =
  server.problem !== undefined
    ? { origin: "https://server-url-not-set.invalid", host: "not-set" }
    : server;
export const serverUrl = endpoint.origin;
export const authClient = createAuthClient({
  baseURL: serverUrl,
  plugins: [
    expoClient({
      scheme: "openbotmobile",
      storagePrefix: `openbot-${endpoint.host.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
      storage: SecureStore,
    }),
    ssoClient(),
  ],
});
export async function signIn(provider: "google" | "microsoft" | "okta") {
  const result = await authClient.signIn.social({
    provider: provider as "google",
    callbackURL: "openbotmobile://",
  });
  if (result.error)
    throw new Error(result.error.message ?? "Could not sign in.");
}
export async function signInEnterprise(email: string) {
  const result = await authClient.signIn.sso({
    email,
    callbackURL: "openbotmobile://",
  });
  if (result.error)
    throw new Error(
      result.error.message ?? "Could not sign in to your organization.",
    );
}
