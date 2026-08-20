import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk, readJsonBody } from "@/lib/api/http";
import { listOrders, placeOrder } from "@/lib/api/orders.server";
import { checkoutSchema } from "@/lib/api/validation";

export const Route = createFileRoute("/api/v1/orders/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to view your orders.");
        try {
          return jsonOk(await listOrders(caller.client, caller.userId));
        } catch (error) {
          console.error("[api/v1/orders GET]", error);
          return jsonError("server_error", "Unable to load your orders.");
        }
      },

      POST: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to place an order.");

        const body = await readJsonBody(request);
        if (body === undefined) return jsonError("bad_request", "Malformed request body.");
        const parsed = checkoutSchema.safeParse(body);
        if (!parsed.success) {
          return jsonError("bad_request", "Invalid checkout request.", parsed.error.flatten());
        }

        try {
          // Totals, prices and product names are derived server-side inside the
          // place_order transaction; the client only chooses an address and a
          // mock payment method.
          const outcome = await placeOrder(
            caller.client,
            parsed.data.addressId,
            parsed.data.paymentMethod,
          );

          if (!outcome.ok) {
            switch (outcome.reason) {
              case "address_not_found":
                return jsonError("not_found", "That delivery address does not exist.");
              case "cart_empty":
                return jsonError("conflict", "Your bag is empty.");
              case "out_of_stock":
                return jsonError(
                  "conflict",
                  outcome.detail
                    ? `There is not enough stock for ${outcome.detail}.`
                    : "There is not enough stock for one of your items.",
                );
              case "product_unavailable":
                return jsonError("conflict", "One of your items is no longer available.");
              default:
                return jsonError("bad_request", "Unsupported payment method.");
            }
          }

          return jsonOk(outcome.result, 201);
        } catch (error) {
          console.error("[api/v1/orders POST]", error);
          return jsonError("server_error", "Unable to place your order.");
        }
      },
    },
  },
});
