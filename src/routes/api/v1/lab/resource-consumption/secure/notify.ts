import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk, readJsonBody } from "@/lib/api/http";
import { labRcSecureNotify } from "@/lib/api/lab-rc.server";
import { labNotifySchema } from "@/lib/api/validation";

/**
 * Secure comparison endpoint: the same costly notification workflow with a
 * per-request cap, a per-window cap and a hard spend ceiling.
 */
export const Route = createFileRoute("/api/v1/lab/resource-consumption/secure/notify")({
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
          const result = await labRcSecureNotify(caller.userId, parsed.data.count);
          if (!result.ok) {
            const response = jsonError(
              "rate_limited",
              result.reason === "rate_limited"
                ? "Notification quota for this window is exhausted."
                : "Spend budget for this window is exhausted.",
              { reason: result.reason, usage: result.usage },
            );
            response.headers.set("retry-after", String(result.retryAfterSeconds));
            return response;
          }
          return jsonOk({
            mode: "secure",
            owaspMapping: "API4:2023",
            weakness: null,
            rateLimitApplied: true,
            spendCapApplied: true,
            requestedCount: result.requestedCount,
            sentCount: result.sentCount,
            costCents: result.costCents,
            controlsApplied: result.controlsApplied,
            usage: result.usage,
          });
        } catch (error) {
          console.error("[api/v1/lab/resource-consumption/secure/notify POST]", error);
          return jsonError("server_error", "Unable to run the lab request.");
        }
      },
    },
  },
});
