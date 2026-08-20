import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk, readJsonBody } from "@/lib/api/http";
import { labRcVulnerableNotify } from "@/lib/api/lab-rc.server";
import { labNotifySchema } from "@/lib/api/validation";

/**
 * ⚠️ INTENTIONALLY VULNERABLE LAB ENDPOINT — API4:2023.
 *
 * A money-spending operation (synthetic SMS) with no per-request cap, no rate
 * limit and no spend budget. Scoped to the lab namespace only.
 */
export const Route = createFileRoute("/api/v1/lab/resource-consumption/notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to run the lab request.");

        const body = await readJsonBody(request);
        const parsed = labNotifySchema.safeParse(body ?? {});
        if (!parsed.success) {
          return jsonError("bad_request", "Invalid notification request.", parsed.error.flatten());
        }

        try {
          const result = await labRcVulnerableNotify(caller.userId, parsed.data.count);
          if (!result.ok) return jsonError("server_error", "Unexpected lab state.");
          return jsonOk({
            mode: "vulnerable",
            owaspMapping: "API4:2023",
            weakness: "unmetered_costly_operation",
            rateLimitApplied: false,
            spendCapApplied: false,
            requestedCount: result.requestedCount,
            sentCount: result.sentCount,
            costCents: result.costCents,
            controlsApplied: result.controlsApplied,
            usage: result.usage,
          });
        } catch (error) {
          console.error("[api/v1/lab/resource-consumption/notify POST]", error);
          return jsonError("server_error", "Unable to run the lab request.");
        }
      },
    },
  },
});
