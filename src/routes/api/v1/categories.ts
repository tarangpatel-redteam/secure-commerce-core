import { createFileRoute } from "@tanstack/react-router";

import { anonClient } from "@/lib/api/context.server";
import { listCategories } from "@/lib/api/catalog.server";
import { jsonError, jsonOk } from "@/lib/api/http";

export const Route = createFileRoute("/api/v1/categories")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return jsonOk(await listCategories(anonClient()));
        } catch (error) {
          console.error("[api/v1/categories]", error);
          return jsonError("server_error", "Unable to load categories.");
        }
      },
    },
  },
});
