import { applicationDefault } from "firebase-admin/app";
import { createRequire } from "node:module";
export function credential(mode = "adc") {
  if (mode === "adc") return applicationDefault();
  if (mode !== "firebase-cli") throw Error("Unknown Firebase credential mode.");
  const require = createRequire(import.meta.url),
    auth = require("firebase-tools/lib/auth");
  return {
    async getAccessToken() {
      const account = auth.getGlobalDefaultAccount();
      if (account?.user?.email !== "brainforgegames@gmail.com")
        throw Error(
          "Firebase CLI must be signed in as brainforgegames@gmail.com",
        );
      const token = await auth.getAccessToken(account.tokens.refresh_token, [
        "https://www.googleapis.com/auth/cloud-platform",
      ]);
      return {
        access_token: token.access_token,
        expires_in: Math.max(
          1,
          Math.floor((token.expires_at - Date.now()) / 1000),
        ),
      };
    },
  };
}
