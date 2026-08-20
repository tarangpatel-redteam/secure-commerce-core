import { createFileRoute } from "@tanstack/react-router";

import { getCart, removeCartItem, setCartItemQuantity } from "@/lib/api/cart.server";
import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk, readJsonBody } from "@/lib/api/http";
import { updateCartItemSchema, uuidSchema } from "@/lib/api/validation";

export const Route = createFileRoute("/api/v1/cart/items/$itemId")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to modify your cart.");

        const id = uuidSchema.safeParse(params.itemId);
        if (!id.success) return jsonError("bad_request", "Invalid cart item identifier.");

        const body = await readJsonBody(request);
        if (body === undefined) return jsonError("bad_request", "Malformed request body.");
        const parsed = updateCartItemSchema.safeParse(body);
        if (!parsed.success) return jsonError("bad_request", "Invalid quantity.");

        try {
          const changed = await setCartItemQuantity(
            caller.client,
            caller.userId,
            id.data,
            parsed.data.quantity,
          );
          if (!changed) return jsonError("not_found", "That cart item is not in your cart.");
          return jsonOk(await getCart(caller.client, caller.userId));
        } catch (error) {
          console.error("[api/v1/cart/items PATCH]", error);
          return jsonError("server_error", "Unable to update your cart.");
        }
      },

      DELETE: async ({ request, params }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to modify your cart.");

        const id = uuidSchema.safeParse(params.itemId);
        if (!id.success) return jsonError("bad_request", "Invalid cart item identifier.");

        try {
          const removed = await removeCartItem(caller.client, caller.userId, id.data);
          if (!removed) return jsonError("not_found", "That cart item is not in your cart.");
          return jsonOk(await getCart(caller.client, caller.userId));
        } catch (error) {
          console.error("[api/v1/cart/items DELETE]", error);
          return jsonError("server_error", "Unable to update your cart.");
        }
      },
    },
  },
});
