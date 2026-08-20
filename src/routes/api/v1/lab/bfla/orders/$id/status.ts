import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk, readJsonBody } from "@/lib/api/http";
import { isStaff, labBflaVulnerableSetStatus } from "@/lib/api/lab-bfla.server";
import { labStatusSchema, uuidSchema } from "@/lib/api/validation";

/**
 * ⚠️ INTENTIONALLY VULNERABLE LAB ENDPOINT — API5:2023 (BFLA).
 *
 * Authentication IS enforced (anonymous callers get 401) and the input IS
 * validated. What is missing on purpose is the FUNCTION-level authorization
 * check: the handler never verifies the caller holds a staff role before
 * running a staff-only fulfilment operation.
 *
 * This weakness is scoped to /api/v1/lab/bfla/*. Production endpoints are
 * unaffected.
 */
export const Route = createFileRoute("/api/v1/lab/bfla/orders/$id/status")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to run the lab request.");

        const id = uuidSchema.safeParse(params.id);
        if (!id.success) return jsonError("bad_request", "Invalid order identifier.");

        const parsed = labStatusSchema.safeParse(await readJsonBody(request));
        if (!parsed.success) {
          return jsonError("bad_request", "Provide a valid target status.", parsed.error.flatten());
        }

        try {
          // ⚠️ No `isStaff(caller.roles)` gate here — that omission IS the
          // vulnerability being demonstrated.
          const outcome = await labBflaVulnerableSetStatus(id.data, parsed.data.status);
          if (!outcome.ok) return jsonError("not_found", "That order does not exist.");

          return jsonOk({
            mode: "vulnerable",
            owaspMapping: "API5:2023",
            privilegedFunction: "order.status.transition",
            authenticatedAs: { userId: caller.userId, email: caller.email, roles: caller.roles },
            roleCheckPerformed: false,
            privilegeEscalation: !isStaff(caller.roles),
            previousStatus: outcome.previousStatus,
            order: outcome.order,
          });
        } catch (error) {
          console.error("[api/v1/lab/bfla/orders/:id/status POST]", error);
          return jsonError("server_error", "Unable to run the lab request.");
        }
      },
    },
  },
});
