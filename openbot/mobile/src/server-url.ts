export type ServerUrl =
  | { origin: string; host: string; problem?: undefined }
  | { problem: string };

/** Reads the build's server URL. A bad value is reported, not thrown, so the app can show it. */
export function readServerUrl(
  configured: string | undefined,
  dev: boolean,
): ServerUrl {
  if (!configured?.trim())
    return {
      problem:
        "Set EXPO_PUBLIC_SERVER_URL to your OpenBot deployment before building the native app.",
    };
  let endpoint: URL;
  try {
    endpoint = new URL(configured.trim());
  } catch {
    return {
      problem:
        "EXPO_PUBLIC_SERVER_URL is not a valid URL. Use your deployment's public URL, such as https://openbot.example.com.",
    };
  }
  if (endpoint.protocol !== "https:" && !(dev && endpoint.protocol === "http:"))
    return { problem: "OpenBot native sign-in requires HTTPS." };
  if (
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  )
    return {
      problem:
        "Use the public deployment URL without credentials or query parameters.",
    };
  return { origin: endpoint.origin, host: endpoint.host };
}
