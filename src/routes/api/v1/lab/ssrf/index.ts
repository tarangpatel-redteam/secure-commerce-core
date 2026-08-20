import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk } from "@/lib/api/http";
import { labSsrfScenario } from "@/lib/api/lab-ssrf.server";

/** Scenario metadata for the API7:2023 SSRF lab (stateless — reset is a no-op). */
export const Route = createFileRoute("/api/v1/lab/ssrf/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to load the lab scenario.");
        return jsonOk(labSsrfScenario(caller));
      },
      POST: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to reset the lab scenario.");
        return jsonOk({ ...labSsrfScenario(caller), reset: true });
      },
    },
  },
});
