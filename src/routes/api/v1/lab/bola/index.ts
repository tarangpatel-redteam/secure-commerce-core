import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk } from "@/lib/api/http";
import { labBolaReset, labBolaScenario } from "@/lib/api/lab-bola.server";

/**
 * Read-only scenario metadata + a narrowly scoped reset control.
 * Both require an authenticated session. The reset only rebuilds the two
 * fixed lab orders; it cannot create arbitrary users or arbitrary rows.
 */
export const Route = createFileRoute("/api/v1/lab/bola/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to load the lab scenario.");
        try {
          return jsonOk(await labBolaScenario());
        } catch (error) {
          console.error("[api/v1/lab/bola GET]", error);
          return jsonError("server_error", "Unable to load the lab scenario.");
        }
      },

      POST: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to reset the lab scenario.");
        try {
          await labBolaReset();
          return jsonOk(await labBolaScenario());
        } catch (error) {
          console.error("[api/v1/lab/bola POST]", error);
          return jsonError("server_error", "Unable to reset the lab scenario.");
        }
      },
    },
  },
});
