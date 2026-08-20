import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk, readJsonBody } from "@/lib/api/http";
import { labBizflowSecureBuy } from "@/lib/api/lab-bizflow.server";
import { labBuySchema } from "@/lib/api/validation";

/** Secure counterpart of the API6:2023 flash-sale flow. */
export const Route = createFileRoute("/api/v1/lab/bizflow/secure/buy")({
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
          const result = await labBizflowSecureBuy(
            caller.userId,
            parsed.data.quantity,
            request.headers.get("user-agent") ?? "",
          );
          if (!result.ok && result.rejectedBy !== "sold_out") {
            return new Response(
              JSON.stringify({
                error: {
                  code: "forbidden",
                  message: `Blocked by business-flow control: ${result.rejectedBy}`,
                  details: result,
                },
              }),
              { status: 403, headers: { "content-type": "application/json; charset=utf-8" } },
            );
          }
          return jsonOk({ owaspMapping: "API6:2023", ...result });
        } catch (error) {
          console.error("[api/v1/lab/bizflow/secure/buy POST]", error);
          return jsonError("server_error", "Unable to run the lab request.");
        }
      },
    },
  },
});
