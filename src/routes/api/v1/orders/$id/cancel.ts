import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk } from "@/lib/api/http";
import { cancelOrder, getOrder } from "@/lib/api/orders.server";
import { uuidSchema } from "@/lib/api/validation";

export const Route = createFileRoute("/api/v1/orders/$id/cancel")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to cancel an order.");

        const id = uuidSchema.safeParse(params.id);
        if (!id.success) return jsonError("bad_request", "Invalid order identifier.");

        try {
          // Ownership (or manager role) is re-checked inside cancel_order using
          // the verified session id from the database.
          const outcome = await cancelOrder(caller.client, id.data);
          if (!outcome.ok) {
            return outcome.reason === "not_found"
              ? jsonError("not_found", "That order does not exist.")
              : jsonError("conflict", "This order can no longer be cancelled.");
          }
          const order = await getOrder(caller.client, id.data);
          return jsonOk(order);
        } catch (error) {
          console.error("[api/v1/orders/:id/cancel POST]", error);
          return jsonError("server_error", "Unable to cancel that order.");
        }
      },
    },
  },
});
