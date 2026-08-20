import { createFileRoute } from "@tanstack/react-router";

import { createAddress, listAddresses } from "@/lib/api/addresses.server";
import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk, readJsonBody } from "@/lib/api/http";
import { addressSchema } from "@/lib/api/validation";

export const Route = createFileRoute("/api/v1/addresses/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to view your addresses.");
        try {
          return jsonOk(await listAddresses(caller.client, caller.userId));
        } catch (error) {
          console.error("[api/v1/addresses GET]", error);
          return jsonError("server_error", "Unable to load your addresses.");
        }
      },

      POST: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to add an address.");

        const body = await readJsonBody(request);
        if (body === undefined) return jsonError("bad_request", "Malformed request body.");
        const parsed = addressSchema.safeParse(body);
        if (!parsed.success) {
          return jsonError("bad_request", "Please correct the highlighted fields.", parsed.error.flatten());
        }

        try {
          // Ownership comes from the verified session, never from the payload.
          return jsonOk(await createAddress(caller.client, caller.userId, parsed.data), 201);
        } catch (error) {
          console.error("[api/v1/addresses POST]", error);
          return jsonError("server_error", "Unable to save that address.");
        }
      },
    },
  },
});
