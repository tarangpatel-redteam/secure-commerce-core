import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk } from "@/lib/api/http";
import { labRcReset, labRcScenario } from "@/lib/api/lab-rc.server";

/**
 * Scenario metadata + reset control for the Unrestricted Resource Consumption
 * lab (API4:2023). Both require an authenticated session. The reset rebuilds
 * the deterministic synthetic dataset and clears all usage counters.
 */
export const Route = createFileRoute("/api/v1/lab/resource-consumption/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to load the lab scenario.");
        try {
          return jsonOk(await labRcScenario(caller));
        } catch (error) {
          console.error("[api/v1/lab/resource-consumption GET]", error);
          return jsonError("server_error", "Unable to load the lab scenario.");
        }
      },

      POST: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to reset the lab scenario.");
        try {
          await labRcReset();
          return jsonOk(await labRcScenario(caller));
        } catch (error) {
          console.error("[api/v1/lab/resource-consumption POST]", error);
          return jsonError("server_error", "Unable to reset the lab scenario.");
        }
      },
    },
  },
});
