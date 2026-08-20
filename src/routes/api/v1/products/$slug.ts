import { createFileRoute } from "@tanstack/react-router";

import { getProductBySlug } from "@/lib/api/catalog.server";
import { anonClient, resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk } from "@/lib/api/http";
import { slugSchema } from "@/lib/api/validation";

export const Route = createFileRoute("/api/v1/products/$slug")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const parsed = slugSchema.safeParse(params.slug);
        if (!parsed.success) return jsonError("bad_request", "Invalid product identifier.");

        try {
          const caller = await resolveCaller(request);
          const client = caller?.client ?? anonClient();
          const product = await getProductBySlug(client, parsed.data);
          if (!product) return jsonError("not_found", "That product does not exist.");
          return jsonOk(product);
        } catch (error) {
          console.error("[api/v1/products/$slug]", error);
          return jsonError("server_error", "Unable to load the product.");
        }
      },
    },
  },
});
