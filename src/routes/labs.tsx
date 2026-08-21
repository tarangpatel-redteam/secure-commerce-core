import { Link, createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/labs")({
  head: () => ({
    meta: [
      { title: "Security lab index — ACME Commerce assessment environment" },
      {
        name: "description",
        content:
          "Index of the five controlled OWASP API Security Top 10 training scenarios available in the ACME Commerce assessment environment.",
      },
      { property: "og:title", content: "Security lab index — ACME Commerce" },
      {
        property: "og:description",
        content: "Five controlled OWASP API Security Top 10 training scenarios.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LabIndexPage,
});

const LABS = [
  {
    to: "/lab/bola",
    owasp: "API1:2023",
    title: "Broken Object Level Authorization",
    summary:
      "Read another customer's order by changing the object identifier, then compare with an ownership-checked endpoint.",
    namespace: "/api/v1/lab/bola/*",
  },
  {
    to: "/lab/bfla",
    owasp: "API5:2023",
    title: "Broken Function Level Authorization",
    summary:
      "Call a staff-only order status transition as an ordinary customer, then compare with a role-gated endpoint.",
    namespace: "/api/v1/lab/bfla/*",
  },
  {
    to: "/lab/bopla",
    owasp: "API3:2023",
    title: "Broken Object Property Level Authorization",
    summary:
      "Observe excessive data exposure and mass assignment on a profile object, then compare with allowlisted read/write.",
    namespace: "/api/v1/lab/bopla/*",
  },
  {
    to: "/lab/broken-auth",
    owasp: "API2:2023",
    title: "Broken Authentication",
    summary:
      "User enumeration, unlimited brute force, predictable tokens and weak OTP recovery versus a hardened login flow.",
    namespace: "/api/v1/lab/broken-auth/*",
  },
  {
    to: "/lab/resource-consumption",
    owasp: "API4:2023",
    title: "Unrestricted Resource Consumption",
    summary:
      "Unbounded exports and unmetered costly notifications versus page-size ceilings, rate limits and spend caps.",
    namespace: "/api/v1/lab/resource-consumption/*",
  },
] as const;

function LabIndexPage() {
  return (
    <div className="container-page py-16">
      <p className="eyebrow">Controlled assessment environment</p>
      <h1 className="mt-3 max-w-3xl text-4xl">API security lab index</h1>
      <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
        These are synthetic, isolated training scenarios built for an internship Web &amp; API
        security assessment. Every intentional weakness lives under the{" "}
        <code className="rounded bg-secondary px-1.5 py-0.5">/api/v1/lab/*</code> namespace and uses
        synthetic data only. The production ACME Commerce storefront and its{" "}
        <code className="rounded bg-secondary px-1.5 py-0.5">/api/v1</code> endpoints stay secure and
        are covered by regression tests.
      </p>

      <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        <p>
          Sign in with a lab test account before running a scenario. Every lab page exposes the raw
          HTTP request and response so the same calls can be replayed through Burp Suite.
        </p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {LABS.map((lab) => (
          <Link
            key={lab.to}
            to={lab.to}
            className="rounded-xl border border-border bg-card p-6 shadow-card transition-shadow hover:shadow-lift"
          >
            <p className="eyebrow">{lab.owasp}</p>
            <p className="mt-2 font-display text-lg font-semibold">{lab.title}</p>
            <p className="mt-2 text-sm text-muted-foreground">{lab.summary}</p>
            <p className="mt-4 break-all font-mono text-xs text-muted-foreground">
              {lab.namespace}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
