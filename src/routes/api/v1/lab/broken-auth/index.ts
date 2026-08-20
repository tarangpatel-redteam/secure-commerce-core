import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk } from "@/lib/api/http";
import { labAuthReset, labAuthScenario } from "@/lib/api/lab-broken-auth.server";

/**
 * Scenario metadata + reset control for the Broken Authentication lab
 * (API2:2023). Both require a valid ACME session; the reset only rebuilds the
 * three fixed synthetic portal accounts.
 */
export const Route = createFileRoute("/api/v1/lab/broken-auth/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to load the lab scenario.");
        try {
          return jsonOk(await labAuthScenario({ userId: caller.userId, email: caller.email, roles: caller.roles }));
        } catch (error) {
          console.error("[api/v1/lab/broken-auth GET]", error);
          return jsonError("server_error", "Unable to load the lab scenario.");
        }
      },

      POST: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to reset the lab scenario.");
        try {
          await labAuthReset();
          return jsonOk(await labAuthScenario({ userId: caller.userId, email: caller.email, roles: caller.roles }));
        } catch (error) {
          console.error("[api/v1/lab/broken-auth POST]", error);
          return jsonError("server_error", "Unable to reset the lab scenario.");
        }
      },
    },
  },
});
