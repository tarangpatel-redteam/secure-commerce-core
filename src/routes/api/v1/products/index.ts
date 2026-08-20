import { createFileRoute } from "@tanstack/react-router";

import { listProducts } from "@/lib/api/catalog.server";
import { anonClient, resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk } from "@/lib/api/http";
import { productQuerySchema } from "@/lib/api/validation";

export const Route = createFileRoute("/api/v1/products/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsed = productQuerySchema.safeParse(Object.fromEntries(url.searchParams));
        if (!parsed.success) {
          return jsonError("bad_request", "Invalid query parameters.", parsed.error.flatten());
        }

        try {
          // Signed-in staff read through their own client so that RLS can widen
          // visibility (e.g. deactivated products); everyone else gets the
          // anonymous client, which only exposes active catalogue rows.
          const caller = await resolveCaller(request);
          const client = caller?.client ?? anonClient();
          const { items, total } = await listProducts(client, parsed.data);
          return jsonOk({
            items,
            page: parsed.data.page,
            perPage: parsed.data.perPage,
            total,
            totalPages: Math.max(1, Math.ceil(total / parsed.data.perPage)),
          });
        } catch (error) {
          console.error("[api/v1/products]", error);
          return jsonError("server_error", "Unable to load products.");
        }
      },
    },
  },
});
