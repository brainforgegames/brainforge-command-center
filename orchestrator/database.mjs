import { createRequire } from "node:module";
import { credential } from "./credential.mjs";
const require = createRequire(import.meta.url),
  { Firestore } = require("@google-cloud/firestore");
// Use the auth library belonging to Firestore's transport (v9 headers differ from v10).
const transportRequire = createRequire(require.resolve("google-gax")),
  { OAuth2Client } = transportRequire("google-auth-library");
export function database(projectId, mode = "adc") {
  if (mode === "adc") return new Firestore({ projectId });
  const source = credential(mode),
    authClient = new OAuth2Client();
  authClient.refreshHandler = async () => {
    const t = await source.getAccessToken();
    return {
      access_token: t.access_token,
      expiry_date: Date.now() + t.expires_in * 1000,
    };
  };
  return new Firestore({ projectId, authClient, preferRest: true });
}
