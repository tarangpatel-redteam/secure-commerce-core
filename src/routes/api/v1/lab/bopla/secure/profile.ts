import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk, readJsonBody } from "@/lib/api/http";
import {
  CLIENT_WRITABLE_PROPERTIES,
  labBoplaSecureGet,
  labBoplaSecureUpdate,
  PUBLIC_PROPERTIES,
} from "@/lib/api/lab-bopla.server";

/**
 * Secure counterpart to the vulnerable BOPLA lab endpoint. Same authentication,
 * same object, same operation — but with property-level authorization:
 *   GET   → allowlisted response projection
 *   PATCH → strict write allowlist; privileged properties are ignored
 */
export const Route = createFileRoute("/api/v1/lab/bopla/secure/profile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to run the lab request.");
        try {
          const outcome = await labBoplaSecureGet(caller.userId);
          if (!outcome.ok) {
            return jsonError("not_found", "No lab record — reset the scenario first.");
          }
          return jsonOk({
            mode: "secure",
            owaspMapping: "API3:2023",
            weakness: "excessive_data_exposure",
            propertyFilteringApplied: true,
            serialisedProperties: PUBLIC_PROPERTIES,
            exposedPrivilegedProperties: [],
            profile: outcome.profile,
          });
        } catch (error) {
          console.error("[api/v1/lab/bopla/secure/profile GET]", error);
          return jsonError("server_error", "Unable to run the lab request.");
        }
      },

      PATCH: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to run the lab request.");

        const body = await readJsonBody(request);
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
          return jsonError("bad_request", "Send a JSON object of properties to update.");
        }

        try {
          const outcome = await labBoplaSecureUpdate(
            caller.userId,
            body as Record<string, unknown>,
          );
          if (!outcome.ok) {
            return jsonError("not_found", "No lab record — reset the scenario first.");
          }
          return jsonOk({
            mode: "secure",
            owaspMapping: "API3:2023",
            weakness: "mass_assignment",
            writeAllowlistApplied: true,
            writableProperties: CLIENT_WRITABLE_PROPERTIES,
            appliedProperties: outcome.appliedProperties,
            rejectedProperties: outcome.rejectedProperties,
            privilegedPropertiesWritten: [],
            propertyEscalation: false,
            profile: outcome.profile,
          });
        } catch (error) {
          console.error("[api/v1/lab/bopla/secure/profile PATCH]", error);
          return jsonError("server_error", "Unable to run the lab request.");
        }
      },
    },
  },
});
