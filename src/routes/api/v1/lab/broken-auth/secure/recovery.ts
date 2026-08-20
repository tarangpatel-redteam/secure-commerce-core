import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk, readJsonBody } from "@/lib/api/http";
import { labAuthSecureVerifyOtp } from "@/lib/api/lab-broken-auth.server";
import { labOtpSchema } from "@/lib/api/validation";

/**
 * Secure comparison endpoint: capped recovery attempts, enforced expiry and a
 * timing-safe code comparison.
 */
export const Route = createFileRoute("/api/v1/lab/broken-auth/secure/recovery")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to run the lab request.");

        const parsed = labOtpSchema.safeParse(await readJsonBody(request));
        if (!parsed.success) {
          return jsonError("bad_request", "Send a username and a numeric code.", parsed.error.issues);
        }

        try {
          const result = await labAuthSecureVerifyOtp(parsed.data.username, parsed.data.code);
          return jsonOk({ owaspMapping: "API2:2023", ...result });
        } catch (error) {
          console.error("[api/v1/lab/broken-auth/secure/recovery]", error);
          return jsonError("server_error", "Unable to run the lab request.");
        }
      },
    },
  },
});
