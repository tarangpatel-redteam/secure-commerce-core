import { createFileRoute } from "@tanstack/react-router";

import { addToCart, getCart } from "@/lib/api/cart.server";
import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk, readJsonBody } from "@/lib/api/http";
import { addCartItemSchema } from "@/lib/api/validation";

export const Route = createFileRoute("/api/v1/cart/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to view your cart.");
        try {
          return jsonOk(await getCart(caller.client, caller.userId));
        } catch (error) {
          console.error("[api/v1/cart GET]", error);
          return jsonError("server_error", "Unable to load your cart.");
        }
      },

      POST: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to add items to your cart.");

        const body = await readJsonBody(request);
        if (body === undefined) return jsonError("bad_request", "Malformed request body.");
        const parsed = addCartItemSchema.safeParse(body);
        if (!parsed.success) {
          return jsonError("bad_request", "Invalid cart request.", parsed.error.flatten());
        }

        try {
          const result = await addToCart(
            caller.client,
            caller.userId,
            parsed.data.productId,
            parsed.data.quantity,
          );
          if (!result.ok) {
            return result.reason === "not_found"
              ? jsonError("not_found", "That product does not exist.")
              : jsonError("conflict", "There is not enough stock for that quantity.");
          }
          return jsonOk(await getCart(caller.client, caller.userId), 201);
        } catch (error) {
          console.error("[api/v1/cart POST]", error);
          return jsonError("server_error", "Unable to update your cart.");
        }
      },

      DELETE: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to modify your cart.");
        const { error } = await caller.client
          .from("cart_items")
          .delete()
          .eq("user_id", caller.userId);
        if (error) {
          console.error("[api/v1/cart DELETE]", error);
          return jsonError("server_error", "Unable to empty your cart.");
        }
        return jsonOk({ items: [], itemCount: 0, subtotalCents: 0, currency: "USD" });
      },
    },
  },
});
