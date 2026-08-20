import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk } from "@/lib/api/http";
import { labBoplaReset, labBoplaScenario } from "@/lib/api/lab-bopla.server";

/**
 * Read-only scenario metadata + a narrowly scoped reset control for the
 * BOPLA lab (API3:2023). Both require an authenticated session. The reset
 * only rebuilds the two fixed synthetic lab records.
 */
export const Route = createFileRoute("/api/v1/lab/bopla/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to load the lab scenario.");
        try {
          return jsonOk(await labBoplaScenario(caller));
        } catch (error) {
          console.error("[api/v1/lab/bopla GET]", error);
          return jsonError("server_error", "Unable to load the lab scenario.");
        }
      },

      POST: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to reset the lab scenario.");
        try {
          await labBoplaReset();
          return jsonOk(await labBoplaScenario(caller));
        } catch (error) {
          console.error("[api/v1/lab/bopla POST]", error);
          return jsonError("server_error", "Unable to reset the lab scenario.");
        }
      },
    },
  },
});
