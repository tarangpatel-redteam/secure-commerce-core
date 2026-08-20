import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk, readJsonBody } from "@/lib/api/http";
import { labBflaSecureSetStatus, STAFF_ROLES } from "@/lib/api/lab-bfla.server";
import { labStatusSchema, uuidSchema } from "@/lib/api/validation";

/**
 * Secure counterpart to the vulnerable BFLA lab endpoint. Same authentication,
 * same validation, same operation — but gated by an explicit deny-by-default
 * function-level authorization check using roles resolved server-side.
 */
export const Route = createFileRoute("/api/v1/lab/bfla/secure/orders/$id/status")({
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
          const outcome = await labBflaSecureSetStatus(id.data, parsed.data.status, caller.roles);
          if (!outcome.ok) {
            return outcome.reason === "forbidden"
              ? jsonError(
                  "forbidden",
                  `This function requires one of: ${STAFF_ROLES.join(", ")}.`,
                )
              : jsonError("not_found", "That order does not exist.");
          }

          return jsonOk({
            mode: "secure",
            owaspMapping: "API5:2023",
            privilegedFunction: "order.status.transition",
            authenticatedAs: { userId: caller.userId, email: caller.email, roles: caller.roles },
            roleCheckPerformed: true,
            privilegeEscalation: false,
            previousStatus: outcome.previousStatus,
            order: outcome.order,
          });
        } catch (error) {
          console.error("[api/v1/lab/bfla/secure/orders/:id/status POST]", error);
          return jsonError("server_error", "Unable to run the lab request.");
        }
      },
    },
  },
});
