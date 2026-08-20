import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk, readJsonBody } from "@/lib/api/http";
import { labAuthVulnerableLogin } from "@/lib/api/lab-broken-auth.server";
import { labCredentialsSchema } from "@/lib/api/validation";

/**
 * ⚠️ INTENTIONALLY VULNERABLE LAB ENDPOINT — API2:2023 (Broken Authentication).
 *
 * Missing on purpose: generic error messages, brute-force protection and
 * unpredictable session tokens. Scoped to the synthetic `lab_auth_accounts`
 * portal — the real ACME sign-in flow is untouched and still requires a valid
 * ACME session just to reach this route.
 */
export const Route = createFileRoute("/api/v1/lab/broken-auth/login")({
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
          const result = await labAuthVulnerableLogin(parsed.data.username, parsed.data.password);
          return jsonOk({ owaspMapping: "API2:2023", ...result });
        } catch (error) {
          console.error("[api/v1/lab/broken-auth/login]", error);
          return jsonError("server_error", "Unable to run the lab request.");
        }
      },
    },
  },
});
