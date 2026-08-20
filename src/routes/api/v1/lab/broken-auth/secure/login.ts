import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk, readJsonBody } from "@/lib/api/http";
import { labAuthSecureLogin } from "@/lib/api/lab-broken-auth.server";
import { labCredentialsSchema } from "@/lib/api/validation";

/**
 * Secure comparison endpoint for the Broken Authentication lab: one generic
 * failure message for every rejection, an enforced lockout after repeated
 * failures, and a cryptographically random session token.
 */
export const Route = createFileRoute("/api/v1/lab/broken-auth/secure/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to run the lab request.");

        const parsed = labCredentialsSchema.safeParse(await readJsonBody(request));
        if (!parsed.success) {
          return jsonError("bad_request", "Send a username and password.", parsed.error.issues);
        }

        try {
          const result = await labAuthSecureLogin(parsed.data.username, parsed.data.password);
          return jsonOk({ owaspMapping: "API2:2023", ...result });
        } catch (error) {
          console.error("[api/v1/lab/broken-auth/secure/login]", error);
          return jsonError("server_error", "Unable to run the lab request.");
        }
      },
    },
  },
});
