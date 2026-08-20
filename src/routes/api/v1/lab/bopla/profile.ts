import { createFileRoute } from "@tanstack/react-router";

import { resolveCaller } from "@/lib/api/context.server";
import { jsonError, jsonOk, readJsonBody } from "@/lib/api/http";
import {
  labBoplaVulnerableGet,
  labBoplaVulnerableUpdate,
  PRIVILEGED_PROPERTIES,
} from "@/lib/api/lab-bopla.server";

/**
 * ⚠️ INTENTIONALLY VULNERABLE LAB ENDPOINT — API3:2023 (BOPLA).
 *
 * Authentication and object-level ownership ARE enforced: the caller can only
 * touch their own synthetic lab record. What is missing on purpose is
 * PROPERTY-level authorization:
 *   GET   → serialises every column (excessive data exposure)
 *   PATCH → writes every property the client sends (mass assignment)
 *
 * This weakness is scoped to /api/v1/lab/bopla/*. Production endpoints such as
 * /api/v1/me stay allowlisted on both read and write.
 */
export const Route = createFileRoute("/api/v1/lab/bopla/profile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const caller = await resolveCaller(request);
        if (!caller) return jsonError("unauthorized", "Sign in to run the lab request.");
        try {
          const outcome = await labBoplaVulnerableGet(caller.userId);
          if (!outcome.ok) {
            return jsonError("not_found", "No lab record — reset the scenario first.");
          }
          return jsonOk({
            mode: "vulnerable",
            owaspMapping: "API3:2023",
            weakness: "excessive_data_exposure",
            propertyFilteringApplied: false,
            exposedPrivilegedProperties: outcome.exposedPrivilegedProperties,
            profile: outcome.profile,
          });
        } catch (error) {
          console.error("[api/v1/lab/bopla/profile GET]", error);
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
          // ⚠️ No write allowlist here — that omission IS the vulnerability.
          const outcome = await labBoplaVulnerableUpdate(
            caller.userId,
            body as Record<string, unknown>,
          );
          if (!outcome.ok) {
            return outcome.reason === "not_found"
              ? jsonError("not_found", "No lab record — reset the scenario first.")
              : jsonError("bad_request", "No known properties were supplied.");
          }
          const escalated = outcome.appliedProperties.filter((p) =>
            (PRIVILEGED_PROPERTIES as readonly string[]).includes(p),
          );
          return jsonOk({
            mode: "vulnerable",
            owaspMapping: "API3:2023",
            weakness: "mass_assignment",
            writeAllowlistApplied: false,
            appliedProperties: outcome.appliedProperties,
            rejectedProperties: outcome.rejectedProperties,
            privilegedPropertiesWritten: escalated,
            propertyEscalation: escalated.length > 0,
            profile: outcome.profile,
          });
        } catch (error) {
          console.error("[api/v1/lab/bopla/profile PATCH]", error);
          return jsonError("server_error", "Unable to run the lab request.");
        }
      },
    },
  },
});
