import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk, readJsonBody } from "@/lib/api/http";
import { CONTROLS, labRcSecureExport } from "@/lib/api/lab-rc.server";
import { labExportSchema } from "@/lib/api/validation";

/**
 * Secure comparison endpoint for API4:2023. Same workflow, same input shape,
 * but with a page-size ceiling, a work-factor ceiling, a per-caller sliding
 * window rate limit and a compute budget. Exhausted callers get HTTP 429 with
 * a Retry-After header.
 */
export const Route = createFileRoute("/api/v1/lab/resource-consumption/secure/export")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to run the lab request.");

        const body = await readJsonBody(request);
        const parsed = labExportSchema.safeParse(body ?? {});
        if (!parsed.success) {
          return jsonError("bad_request", "Invalid export request.", parsed.error.flatten());
        }

        try {
          const result = await labRcSecureExport(caller.userId, parsed.data);
          if (!result.ok) {
            const response = jsonError(
              "rate_limited",
              result.reason === "rate_limited"
                ? "Too many export requests. Try again shortly."
                : "Compute budget for this window is exhausted.",
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
            pageSizeCeiling: CONTROLS.maxPageSize,
            requestedLimit: result.requestedLimit,
            effectiveLimit: result.effectiveLimit,
            requestedWorkFactor: result.requestedWorkFactor,
            effectiveWorkFactor: result.effectiveWorkFactor,
            rowsReturned: result.rowsReturned,
            computeUnits: result.computeUnits,
            durationMs: result.durationMs,
            controlsApplied: result.controlsApplied,
            usage: result.usage,
            rows: result.rows,
          });
        } catch (error) {
          console.error("[api/v1/lab/resource-consumption/secure/export POST]", error);
          return jsonError("server_error", "Unable to run the lab request.");
        }
      },
    },
  },
});
