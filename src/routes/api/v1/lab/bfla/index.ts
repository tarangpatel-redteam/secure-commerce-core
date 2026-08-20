import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk } from "@/lib/api/http";
import { labBflaReset, labBflaScenario } from "@/lib/api/lab-bfla.server";

/**
 * Read-only scenario metadata + a narrowly scoped reset control for the
 * BFLA lab. Both require an authenticated session. The reset only rebuilds
 * the single fixed lab order; it cannot create arbitrary users or rows.
 */
export const Route = createFileRoute("/api/v1/lab/bfla/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to load the lab scenario.");
        try {
          return jsonOk(await labBflaScenario(caller));
        } catch (error) {
          console.error("[api/v1/lab/bfla GET]", error);
          return jsonError("server_error", "Unable to load the lab scenario.");
        }
      },

      POST: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to reset the lab scenario.");
        try {
          await labBflaReset();
          return jsonOk(await labBflaScenario(caller));
        } catch (error) {
          console.error("[api/v1/lab/bfla POST]", error);
          return jsonError("server_error", "Unable to reset the lab scenario.");
        }
      },
    },
  },
});
