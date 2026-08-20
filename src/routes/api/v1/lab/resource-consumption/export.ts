import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk, readJsonBody } from "@/lib/api/http";
import { labRcVulnerableExport } from "@/lib/api/lab-rc.server";
import { labExportSchema } from "@/lib/api/validation";

/**
 * ⚠️ INTENTIONALLY VULNERABLE LAB ENDPOINT — API4:2023.
 *
 * Authentication IS enforced. What is missing on purpose: a page-size ceiling,
 * a work-factor ceiling, a rate limit and a compute budget. The caller decides
 * how much server work happens. Scoped to /api/v1/lab/resource-consumption/*.
 */
export const Route = createFileRoute("/api/v1/lab/resource-consumption/export")({
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
          // ⚠️ No throttling, no clamping — that omission IS the vulnerability.
          const result = await labRcVulnerableExport(caller.userId, parsed.data);
          if (!result.ok) return jsonError("server_error", "Unexpected lab state.");
          return jsonOk({
            mode: "vulnerable",
            owaspMapping: "API4:2023",
            weakness: "unrestricted_resource_consumption",
            rateLimitApplied: false,
            pageSizeCeiling: null,
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
          console.error("[api/v1/lab/resource-consumption/export POST]", error);
          return jsonError("server_error", "Unable to run the lab request.");
        }
      },
    },
  },
});
