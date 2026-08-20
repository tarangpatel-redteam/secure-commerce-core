import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk } from "@/lib/api/http";
import { labBizflowReset, labBizflowScenario } from "@/lib/api/lab-bizflow.server";

/** Scenario metadata + reset for the API6:2023 business-flow lab. */
export const Route = createFileRoute("/api/v1/lab/bizflow/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to load the lab scenario.");
        try {
          return jsonOk(await labBizflowScenario(caller));
        } catch (error) {
          console.error("[api/v1/lab/bizflow GET]", error);
          return jsonError("server_error", "Unable to load the lab scenario.");
        }
      },
      POST: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to reset the lab scenario.");
        try {
          await labBizflowReset();
          return jsonOk(await labBizflowScenario(caller));
        } catch (error) {
          console.error("[api/v1/lab/bizflow POST]", error);
          return jsonError("server_error", "Unable to reset the lab scenario.");
        }
      },
    },
  },
});
