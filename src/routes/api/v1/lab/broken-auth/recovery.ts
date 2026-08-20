import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk, readJsonBody } from "@/lib/api/http";
import { labAuthVulnerableVerifyOtp } from "@/lib/api/lab-broken-auth.server";
import { labOtpSchema } from "@/lib/api/validation";

/**
 * ⚠️ INTENTIONALLY VULNERABLE LAB ENDPOINT — API2:2023 (weak account recovery).
 *
 * A 4-digit recovery code verified with unlimited attempts, no expiry check
 * and a non-constant-time comparison. Synthetic accounts only.
 */
export const Route = createFileRoute("/api/v1/lab/broken-auth/recovery")({
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
          const result = await labAuthVulnerableVerifyOtp(parsed.data.username, parsed.data.code);
          return jsonOk({ owaspMapping: "API2:2023", ...result });
        } catch (error) {
          console.error("[api/v1/lab/broken-auth/recovery]", error);
          return jsonError("server_error", "Unable to run the lab request.");
        }
      },
    },
  },
});
