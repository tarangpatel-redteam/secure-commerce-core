import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, ShieldCheck, ShieldX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { RequireSession } from "@/components/site/RequireSession";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/lab/bopla")({
  head: () => ({
    meta: [
      { title: "BOPLA lab (API3:2023) — ACME Commerce Security Lab" },
      {
        name: "description",
        content:
          "Isolated training scenario demonstrating Broken Object Property Level Authorization: excessive data exposure and mass assignment, with a secure side-by-side comparison.",
      },
      { property: "og:title", content: "BOPLA lab (API3:2023) — ACME Commerce Security Lab" },
      {
        property: "og:description",
        content:
          "Compare leaky, mass-assignable profile endpoints with allowlisted secure ones.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BoplaLabPage,
});

type Scenario = {
  scenarioId: string;
  vulnerability: string;
  owaspMapping: string;
  description: string;
  publicProperties: string[];
  clientWritableProperties: string[];
  privilegedProperties: string[];
  users: { label: string; email: string; role: string }[];
  caller: { userId: string; email: string; roles: string[] };
  hasLabRecord: boolean;
};

type RawResult = {
  method: string;
  endpoint: string;
  requestBody: unknown;
  status: number;
  body: unknown;
  durationMs: number;
};

/** Raw fetch so the lab shows the real HTTP status and response body. */
async function labRequest(
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown,
): Promise<RawResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const started = performance.now();
  const response = await fetch(`/api/v1${path}`, {
    method,
    headers: {
      accept: "application/json",
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  return {
    method,
    endpoint: `/api/v1${path}`,
    requestBody: body ?? null,
    status: response.status,
    body: payload,
    durationMs: Math.round(performance.now() - started),
  };
}

const DEFAULT_PAYLOAD = JSON.stringify(
  {
    displayName: "Ada Customer",
    loyaltyTier: "platinum",
    accountCreditCents: 500000,
    isVip: true,
    internalRiskScore: 0,
  },
  null,
  2,
);

function BoplaLabPage() {
  return (
    <RequireSession
      title="Sign in to open the security lab"
      description="The BOPLA scenario runs against real authenticated API requests, so a session is required."
    >
      <BoplaLab />
    </RequireSession>
  );
}

function BoplaLab() {
  const queryClient = useQueryClient();
  const [payload, setPayload] = useState(DEFAULT_PAYLOAD);
  const [vulnerable, setVulnerable] = useState<RawResult | null>(null);
  const [secure, setSecure] = useState<RawResult | null>(null);

  const scenario = useQuery<Scenario>({
    queryKey: ["lab", "bopla"],
    queryFn: async () => {
      const result = await labRequest("GET", "/lab/bopla");
      if (result.status >= 400) throw new Error("Unable to load the lab scenario.");
      return (result.body as { data: Scenario }).data;
    },
  });

  const reset = useMutation({
    mutationFn: async () => {
      const result = await labRequest("POST", "/lab/bopla");
      if (result.status >= 400) throw new Error("Reset failed.");
      return (result.body as { data: Scenario }).data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["lab", "bopla"], data);
      setVulnerable(null);
      setSecure(null);
      toast.success("Lab data reset. Synthetic profiles restored.");
    },
    onError: () => toast.error("Could not reset the lab data."),
  });

  const readBoth = useMutation({
    mutationFn: async () => ({
      vuln: await labRequest("GET", "/lab/bopla/profile"),
      safe: await labRequest("GET", "/lab/bopla/secure/profile"),
    }),
    onSuccess: ({ vuln, safe }) => {
      setVulnerable(vuln);
      setSecure(safe);
    },
    onError: () => toast.error("The lab request failed to send."),
  });

  const writeBoth = useMutation({
    mutationFn: async () => {
      let body: unknown;
      try {
        body = JSON.parse(payload) as unknown;
      } catch {
        throw new Error("The payload must be valid JSON.");
      }
      return {
        vuln: await labRequest("PATCH", "/lab/bopla/profile", body),
        safe: await labRequest("PATCH", "/lab/bopla/secure/profile", body),
      };
    },
    onSuccess: ({ vuln, safe }) => {
      setVulnerable(vuln);
      setSecure(safe);
      void queryClient.invalidateQueries({ queryKey: ["lab", "bopla"] });
    },
    onError: (error: Error) => toast.error(error.message || "The lab request failed to send."),
  });

  if (scenario.isLoading) {
    return (
      <div className="container-page py-12">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="mt-8 h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (scenario.isError || !scenario.data) {
    return (
      <div className="container-page py-24 text-center">
        <h1 className="text-3xl">The lab scenario didn't load</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Try resetting the lab data, then reload this page.
        </p>
        <Button className="mt-6" onClick={() => reset.mutate()} disabled={reset.isPending}>
          Reset lab data
        </Button>
      </div>
    );
  }

  const data = scenario.data;
  const pending = readBoth.isPending || writeBoth.isPending;

  return (
    <div className="container-page space-y-10 py-12">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="destructive" className="uppercase tracking-wide">
            Training lab
          </Badge>
          <Badge variant="secondary">{data.owaspMapping}</Badge>
          <Badge variant="outline">Synthetic data only</Badge>
        </div>
        <h1 className="text-4xl">Broken Object Property Level Authorization (BOPLA)</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {data.description} This scenario is isolated to{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">/api/v1/lab/bopla/*</code> and the
          synthetic <code className="rounded bg-muted px-1 py-0.5 text-xs">lab_bopla_profiles</code>{" "}
          table. Production endpoints such as{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">/api/v1/me</code> keep both a
          response projection and a write allowlist.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg">Object vs property</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Ownership is enforced here — the caller only ever touches their own record. API3 asks a
            finer question: may this subject read or write <em>this property</em> of that object?
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg">Readable properties</h2>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {data.publicProperties.join(", ")}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg">Client-writable properties</h2>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {data.clientWritableProperties.join(", ")}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Server-owned: <span className="font-mono">{data.privilegedProperties.join(", ")}</span>
          </p>
        </article>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl">Property abuse simulator</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Read your own lab record, then try to write server-owned properties. Both endpoints
              receive the exact same request.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => reset.mutate()}
            disabled={reset.isPending}
          >
            <RotateCcw className="mr-2 size-4" />
            {reset.isPending ? "Resetting…" : "Reset lab data"}
          </Button>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Authenticated subject (your real session)
            </h3>
            <div className="mt-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
              <p className="font-medium">{data.caller.email || "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                roles: {data.caller.roles.join(", ") || "—"}
              </p>
              <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
                sub: {data.caller.userId}
              </p>
              <Badge className="mt-3" variant={data.hasLabRecord ? "default" : "outline"}>
                {data.hasLabRecord ? "Lab record present" : "No lab record — reset first"}
              </Badge>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Deterministic records exist for {data.users.map((u) => u.label).join(" and ")}.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Mass-assignment payload (JSON)
            </h3>
            <textarea
              className="mt-3 h-52 w-full rounded-md border border-border bg-background p-3 font-mono text-xs text-foreground"
              value={payload}
              spellCheck={false}
              onChange={(event) => setPayload(event.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={() => readBoth.mutate()} disabled={pending} variant="secondary">
            {readBoth.isPending ? "Sending…" : "Run GET on both"}
          </Button>
          <Button onClick={() => writeBoth.mutate()} disabled={pending}>
            {writeBoth.isPending ? "Sending…" : "Run PATCH on both"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Watch the vulnerable panel leak internal properties and accept privileged writes.
          </span>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <ResultPanel
          tone="vulnerable"
          title="Vulnerable endpoint"
          subtitle="No response projection, no write allowlist"
          result={vulnerable}
          pending={pending}
        />
        <ResultPanel
          tone="secure"
          title="Secure endpoint"
          subtitle="Allowlisted read projection and write schema"
          result={secure}
          pending={pending}
        />
      </section>

      {vulnerable && secure && (
        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
            <h2 className="text-lg">Why the vulnerable result is a failure</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The endpoint returned <strong>HTTP {vulnerable.status}</strong>. On read it serialised
              the whole database row — internal risk score, staff notes, support PIN and date of
              birth — to a customer who is only entitled to their contact details. On write it
              copied the request body straight onto the row, so the customer granted themselves
              store credit, VIP status and a higher loyalty tier. Both are the same root cause:
              authorization was decided per object, never per property.
            </p>
          </article>
          <article className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-6">
            <h2 className="text-lg">Why the secure result is correct</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The secure endpoint returned <strong>HTTP {secure.status}</strong> with an explicit
              projection of caller-visible properties, and applied only the three client-writable
              fields. Privileged properties were reported back as rejected rather than silently
              written, so the response is both safe and debuggable.
            </p>
          </article>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-xl">Remediation guidance</h2>
        <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Never return the database entity.</strong> Map rows
            to an explicit DTO per audience, so a new column is invisible until someone deliberately
            exposes it.
          </li>
          <li>
            <strong className="text-foreground">Allowlist writes, never blocklist.</strong> Parse
            request bodies with a strict schema and drop unknown keys; blocklists rot as the model
            grows.
          </li>
          <li>
            <strong className="text-foreground">Keep server-owned properties server-owned.</strong>{" "}
            Balances, tiers, flags, scores and audit fields should only ever be changed by
            server-side business logic or a staff-only workflow.
          </li>
          <li>
            <strong className="text-foreground">Classify sensitive properties.</strong> Mark
            PII/internal fields in the schema and assert in tests that they never appear in customer
            responses.
          </li>
          <li>
            <strong className="text-foreground">Report rejections.</strong> Returning the ignored
            property names makes tampering visible in logs and to legitimate integrators.
          </li>
          <li>
            <strong className="text-foreground">Test both directions.</strong> For every object add
            a test that reads it as a low-privilege user and asserts no privileged property leaks,
            plus one that attempts a privileged write and asserts the value is unchanged.
          </li>
        </ul>
      </section>
    </div>
  );
}

function ResultPanel({
  tone,
  title,
  subtitle,
  result,
  pending,
}: {
  tone: "vulnerable" | "secure";
  title: string;
  subtitle: string;
  result: RawResult | null;
  pending: boolean;
}) {
  const accent = tone === "vulnerable" ? "border-destructive/40" : "border-emerald-500/40";

  return (
    <article className={`rounded-xl border bg-card p-6 ${accent}`}>
      <div className="flex items-center gap-2">
        {tone === "vulnerable" ? (
          <ShieldX className="size-5 text-destructive" />
        ) : (
          <ShieldCheck className="size-5 text-emerald-600" />
        )}
        <div>
          <h2 className="text-lg leading-none">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      {pending && <Skeleton className="mt-6 h-48 w-full rounded-lg" />}

      {!pending && !result && (
        <p className="mt-6 text-sm text-muted-foreground">
          No request sent yet. Run a GET or a PATCH from the simulator.
        </p>
      )}

      {!pending && result && <ResultBody result={result} />}
    </article>
  );
}

function ResultBody({ result }: { result: RawResult }) {
  const payload = result.body as
    | {
        data?: {
          weakness?: string;
          propertyFilteringApplied?: boolean;
          writeAllowlistApplied?: boolean;
          appliedProperties?: string[];
          rejectedProperties?: string[];
          privilegedPropertiesWritten?: string[];
          propertyEscalation?: boolean;
          profile?: Record<string, unknown>;
        };
        error?: { code: string; message: string };
      }
    | null;

  const ok = result.status < 400;
  const profileKeys = Object.keys(payload?.data?.profile ?? {});

  return (
    <div className="mt-5 space-y-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
        <dt className="text-muted-foreground">Method</dt>
        <dd className="font-mono">{result.method}</dd>
        <dt className="text-muted-foreground">Endpoint</dt>
        <dd className="break-all font-mono">{result.endpoint}</dd>
        <dt className="text-muted-foreground">Request body</dt>
        <dd className="max-h-24 overflow-auto break-all font-mono">
          {JSON.stringify(result.requestBody)}
        </dd>
        <dt className="text-muted-foreground">Weakness</dt>
        <dd className="font-mono">{payload?.data?.weakness ?? "—"}</dd>
        <dt className="text-muted-foreground">Property controls</dt>
        <dd className="font-mono">
          {payload?.data?.propertyFilteringApplied !== undefined
            ? `read filter: ${String(payload.data.propertyFilteringApplied)}`
            : payload?.data?.writeAllowlistApplied !== undefined
              ? `write allowlist: ${String(payload.data.writeAllowlistApplied)}`
              : "n/a"}
        </dd>
        <dt className="text-muted-foreground">Properties returned</dt>
        <dd className="font-mono">{profileKeys.length || "—"}</dd>
        <dt className="text-muted-foreground">Status</dt>
        <dd>
          <Badge variant={ok ? "default" : "destructive"}>{result.status}</Badge>
          <span className="ml-2 text-muted-foreground">{result.durationMs} ms</span>
        </dd>
      </dl>

      {payload?.data?.propertyEscalation && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs">
          Server-owned properties written by a customer:{" "}
          <span className="font-mono">
            {payload.data.privilegedPropertiesWritten?.join(", ")}
          </span>
        </p>
      )}

      {payload?.data?.rejectedProperties && payload.data.rejectedProperties.length > 0 && (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs">
          Rejected properties:{" "}
          <span className="font-mono">{payload.data.rejectedProperties.join(", ")}</span>
        </p>
      )}

      {payload?.error && (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
          <span className="font-mono">{payload.error.code}</span> — {payload.error.message}
        </p>
      )}

      <details className="rounded-md border border-border bg-muted/30" open>
        <summary className="cursor-pointer px-3 py-2 text-xs text-muted-foreground">
          Raw response body
        </summary>
        <pre className="max-h-72 overflow-auto px-3 pb-3 text-[11px] leading-relaxed">
          {JSON.stringify(result.body, null, 2)}
        </pre>
      </details>
    </div>
  );
}
