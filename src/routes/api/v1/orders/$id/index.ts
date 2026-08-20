import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk } from "@/lib/api/http";
import { getOrder } from "@/lib/api/orders.server";
import { uuidSchema } from "@/lib/api/validation";

export const Route = createFileRoute("/api/v1/orders/$id/")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to view this order.");

        const id = uuidSchema.safeParse(params.id);
        if (!id.success) return jsonError("bad_request", "Invalid order identifier.");

        try {
          // RLS restricts the row to the owner (or staff); a foreign order is
          // reported as missing rather than forbidden.
          const order = await getOrder(caller.client, id.data);
          if (!order) return jsonError("not_found", "That order does not exist.");
          return jsonOk(order);
        } catch (error) {
          console.error("[api/v1/orders/:id GET]", error);
          return jsonError("server_error", "Unable to load that order.");
        }
      },
    },
  },
});
