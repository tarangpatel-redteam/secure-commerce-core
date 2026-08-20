import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk } from "@/lib/api/http";
import { labMisconfigScenario } from "@/lib/api/lab-misconfig.server";

/** Scenario metadata for the API8:2023 misconfiguration lab (stateless). */
export const Route = createFileRoute("/api/v1/lab/misconfig/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to load the lab scenario.");
        return jsonOk(labMisconfigScenario(caller));
      },
      POST: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to reset the lab scenario.");
        return jsonOk({ ...labMisconfigScenario(caller), reset: true });
      },
    },
  },
});
