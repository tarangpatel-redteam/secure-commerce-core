import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk, readJsonBody } from "@/lib/api/http";
import { labBizflowVulnerableBuy } from "@/lib/api/lab-bizflow.server";
import { labBuySchema } from "@/lib/api/validation";

/**
 * ⚠️ INTENTIONALLY VULNERABLE LAB ENDPOINT — API6:2023.
 * Authenticated and validated, but with no anti-automation controls on a
 * sensitive business flow (limited flash-sale allocation).
 */
export const Route = createFileRoute("/api/v1/lab/bizflow/buy")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to run the lab request.");
        const parsed = labBuySchema.safeParse(await readJsonBody(request));
        if (!parsed.success) {
          return jsonError("bad_request", "Provide a valid quantity.", parsed.error.flatten());
        }
        try {
          const result = await labBizflowVulnerableBuy(
            caller.userId,
            parsed.data.quantity,
            request.headers.get("user-agent") ?? "",
          );
          return jsonOk({ owaspMapping: "API6:2023", ...result });
        } catch (error) {
          console.error("[api/v1/lab/bizflow/buy POST]", error);
          return jsonError("server_error", "Unable to run the lab request.");
        }
      },
    },
  },
});
