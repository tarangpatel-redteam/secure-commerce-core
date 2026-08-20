import { createFileRoute } from "@tanstack/react-router";

import { deleteAddress, updateAddress } from "@/lib/api/addresses.server";
import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk, readJsonBody } from "@/lib/api/http";
import { addressSchema, uuidSchema } from "@/lib/api/validation";

export const Route = createFileRoute("/api/v1/addresses/$id")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to update an address.");

        const id = uuidSchema.safeParse(params.id);
        if (!id.success) return jsonError("bad_request", "Invalid address identifier.");

        const body = await readJsonBody(request);
        if (body === undefined) return jsonError("bad_request", "Malformed request body.");
        const parsed = addressSchema.safeParse(body);
        if (!parsed.success) {
          return jsonError("bad_request", "Please correct the highlighted fields.", parsed.error.flatten());
        }

        try {
          const updated = await updateAddress(caller.client, caller.userId, id.data, parsed.data);
          // A row owned by somebody else is indistinguishable from a missing one.
          if (!updated) return jsonError("not_found", "That address does not exist.");
          return jsonOk(updated);
        } catch (error) {
          console.error("[api/v1/addresses PUT]", error);
          return jsonError("server_error", "Unable to update that address.");
        }
      },

      DELETE: async ({ request, params }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to remove an address.");

        const id = uuidSchema.safeParse(params.id);
        if (!id.success) return jsonError("bad_request", "Invalid address identifier.");

        try {
          const removed = await deleteAddress(caller.client, caller.userId, id.data);
          if (!removed) return jsonError("not_found", "That address does not exist.");
          return jsonOk({ deleted: true });
        } catch (error) {
          console.error("[api/v1/addresses DELETE]", error);
          return jsonError("server_error", "Unable to remove that address.");
        }
      },
    },
  },
});
