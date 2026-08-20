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

export const Route = createFileRoute("/lab/resource-consumption")({
  head: () => ({
    meta: [
      {
        title: "Resource consumption lab (API4:2023) — ACME Commerce Security Lab",
      },
      {
        name: "description",
        content:
          "Isolated training scenario for Unrestricted Resource Consumption: unbounded page sizes, unmetered compute and uncapped costly operations, with a rate-limited secure comparison.",
      },
      {
        property: "og:title",
        content: "Resource consumption lab (API4:2023) — ACME Commerce Security Lab",
      },
      {
        property: "og:description",
        content:
          "Flood an unbounded export endpoint, then watch the hardened endpoint clamp, throttle and budget the same request.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResourceConsumptionLabPage,
});

type Usage = {
  variant: string;
  windowSecondsRemaining: number;
  requestCount: number;
  rowsReturned: number;
  computeUnits: number;
  notificationsSent: number;
  budgetSpentCents: number;
};

type Scenario = {
  scenarioId: string;
  vulnerability: string;
  owaspMapping: string;
  description: string;
  datasetSize: number;
  controls: {
    maxPageSize: number;
    maxWorkFactor: number;
    windowSeconds: number;
    maxExportRequestsPerWindow: number;
    maxComputeUnitsPerWindow: number;
    maxNotificationsPerRequest: number;
    maxNotificationsPerWindow: number;
    maxBudgetCentsPerWindow: number;
    notificationCostCents: number;
  };
  caller: { userId: string; email: string; roles: string[] };
  usage: { vulnerable: Usage; secure: Usage };
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
  method: "GET" | "POST",
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

function ResourceConsumptionLabPage() {
  return (
    <RequireSession
      title="Sign in to open the security lab"
      description="The resource-consumption scenario runs real authenticated API requests, so a session is required."
    >
      <ResourceConsumptionLab />
    </RequireSession>
  );
}

function ResourceConsumptionLab() {
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState(500);
  const [workFactor, setWorkFactor] = useState(50);
  const [notifyCount, setNotifyCount] = useState(25);
  const [burst, setBurst] = useState(12);
  const [vulnerable, setVulnerable] = useState<RawResult | null>(null);
  const [secure, setSecure] = useState<RawResult | null>(null);
  const [burstSummary, setBurstSummary] = useState<{
    vulnerableAccepted: number;
    vulnerableThrottled: number;
    secureAccepted: number;
    secureThrottled: number;
  } | null>(null);

  const scenario = useQuery<Scenario>({
    queryKey: ["lab", "rc"],
    queryFn: async () => {
      const result = await labRequest("GET", "/lab/resource-consumption");
      if (result.status >= 400) throw new Error("Unable to load the lab scenario.");
      return (result.body as { data: Scenario }).data;
    },
  });

  const reset = useMutation({
    mutationFn: async () => {
      const result = await labRequest("POST", "/lab/resource-consumption");
      if (result.status >= 400) throw new Error("Reset failed.");
      return (result.body as { data: Scenario }).data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["lab", "rc"], data);
      setVulnerable(null);
      setSecure(null);
      setBurstSummary(null);
      toast.success("Lab reset. Dataset rebuilt and quotas cleared.");
    },
    onError: () => toast.error("Could not reset the lab data."),
  });

  const runExport = useMutation({
    mutationFn: async () => ({
      vuln: await labRequest("POST", "/lab/resource-consumption/export", { limit, workFactor }),
      safe: await labRequest("POST", "/lab/resource-consumption/secure/export", {
        limit,
        workFactor,
      }),
    }),
    onSuccess: ({ vuln, safe }) => {
      setVulnerable(vuln);
      setSecure(safe);
      void queryClient.invalidateQueries({ queryKey: ["lab", "rc"] });
    },
    onError: () => toast.error("The lab request failed to send."),
  });

  const runNotify = useMutation({
    mutationFn: async () => ({
      vuln: await labRequest("POST", "/lab/resource-consumption/notify", { count: notifyCount }),
      safe: await labRequest("POST", "/lab/resource-consumption/secure/notify", {
        count: notifyCount,
      }),
    }),
    onSuccess: ({ vuln, safe }) => {
      setVulnerable(vuln);
      setSecure(safe);
      void queryClient.invalidateQueries({ queryKey: ["lab", "rc"] });
    },
    onError: () => toast.error("The lab request failed to send."),
  });

  const runBurst = useMutation({
    mutationFn: async () => {
      let vulnerableAccepted = 0;
      let vulnerableThrottled = 0;
      let secureAccepted = 0;
      let secureThrottled = 0;
      let lastVuln: RawResult | null = null;
      let lastSafe: RawResult | null = null;

      for (let i = 0; i < burst; i += 1) {
        const v = await labRequest("POST", "/lab/resource-consumption/export", {
          limit,
          workFactor,
        });
        const s = await labRequest("POST", "/lab/resource-consumption/secure/export", {
          limit,
          workFactor,
        });
        if (v.status === 429) vulnerableThrottled += 1;
        else vulnerableAccepted += 1;
        if (s.status === 429) secureThrottled += 1;
        else secureAccepted += 1;
        lastVuln = v;
        lastSafe = s;
      }
      return { vulnerableAccepted, vulnerableThrottled, secureAccepted, secureThrottled, lastVuln, lastSafe };
    },
    onSuccess: (result) => {
      setBurstSummary({
        vulnerableAccepted: result.vulnerableAccepted,
        vulnerableThrottled: result.vulnerableThrottled,
        secureAccepted: result.secureAccepted,
        secureThrottled: result.secureThrottled,
      });
      setVulnerable(result.lastVuln);
      setSecure(result.lastSafe);
      void queryClient.invalidateQueries({ queryKey: ["lab", "rc"] });
    },
    onError: () => toast.error("The burst run failed."),
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
  const pending = runExport.isPending || runNotify.isPending || runBurst.isPending;

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
        <h1 className="text-4xl">Unrestricted Resource Consumption</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {data.description} The weakness is isolated to{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            /api/v1/lab/resource-consumption/*
          </code>{" "}
          and the synthetic{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">lab_rc_records</code> dataset.
          Production endpoints such as{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">/api/v1/products</code> keep their
          own server-side page-size ceilings.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg">Synthetic dataset</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {data.datasetSize} deterministic invoice rows, rebuilt exactly the same way on every
            reset so runs are repeatable.
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg">Secure-side controls</h2>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            page ≤ {data.controls.maxPageSize} · work ≤ {data.controls.maxWorkFactor} ·{" "}
            {data.controls.maxExportRequestsPerWindow} req / {data.controls.windowSeconds}s ·{" "}
            {data.controls.maxComputeUnitsPerWindow} compute units
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg">Costly operation</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Each synthetic notification costs {data.controls.notificationCostCents}¢. The secure
            side caps {data.controls.maxNotificationsPerRequest} per request,{" "}
            {data.controls.maxNotificationsPerWindow} per window and {data.controls.maxBudgetCentsPerWindow}
            ¢ of spend.
          </p>
        </article>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl">Consumption simulator</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Both endpoints receive the identical body. Only the secure one clamps, throttles and
              budgets it.
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
          <div className="space-y-4">
            <NumberField
              label="limit (rows per request)"
              value={limit}
              min={1}
              max={1000000}
              onChange={setLimit}
            />
            <NumberField
              label="workFactor (per-row enrichment passes)"
              value={workFactor}
              min={1}
              max={1000}
              onChange={setWorkFactor}
            />
            <NumberField
              label="burst size (repeated export requests)"
              value={burst}
              min={1}
              max={40}
              onChange={setBurst}
            />
            <NumberField
              label="notification count (costly operation)"
              value={notifyCount}
              min={1}
              max={1000}
              onChange={setNotifyCount}
            />
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recorded consumption (this session)
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <UsageCard title="Vulnerable" usage={data.usage.vulnerable} tone="vulnerable" />
              <UsageCard title="Secure" usage={data.usage.secure} tone="secure" />
            </div>
            <p className="mt-3 break-all font-mono text-[11px] text-muted-foreground">
              sub: {data.caller.userId}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={() => runExport.mutate()} disabled={pending} variant="secondary">
            {runExport.isPending ? "Sending…" : "Run export on both"}
          </Button>
          <Button onClick={() => runBurst.mutate()} disabled={pending}>
            {runBurst.isPending ? "Flooding…" : `Flood with ${burst} requests`}
          </Button>
          <Button onClick={() => runNotify.mutate()} disabled={pending} variant="outline">
            {runNotify.isPending ? "Sending…" : "Run costly notification"}
          </Button>
        </div>

        {burstSummary && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs">
              Vulnerable: {burstSummary.vulnerableAccepted} accepted,{" "}
              {burstSummary.vulnerableThrottled} throttled.
            </p>
            <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs">
              Secure: {burstSummary.secureAccepted} accepted, {burstSummary.secureThrottled}{" "}
              throttled with HTTP 429.
            </p>
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <ResultPanel
          tone="vulnerable"
          title="Vulnerable endpoint"
          subtitle="No ceiling, no rate limit, no budget"
          result={vulnerable}
        />
        <ResultPanel
          tone="secure"
          title="Secure endpoint"
          subtitle="Clamped page size, throttled, budgeted"
          result={secure}
        />
      </section>

      {vulnerable && secure && (
        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
            <h2 className="text-lg">Why the vulnerable result is a failure</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The endpoint returned <strong>HTTP {vulnerable.status}</strong> and performed exactly
              as much work as the client asked for. One authenticated caller can request the whole
              dataset with an arbitrary work factor, repeat it as fast as the network allows and
              spend the business's notification budget — no authorization flaw required, just
              missing limits. In production that is a denial-of-service and a billing incident.
            </p>
          </article>
          <article className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-6">
            <h2 className="text-lg">Why the secure result is correct</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The secure endpoint returned <strong>HTTP {secure.status}</strong>, clamped the page
              size and work factor to server-owned maxima, counted the request against a
              per-caller sliding window and refused with 429 plus{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">Retry-After</code> once the
              quota or budget was exhausted.
            </p>
          </article>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-xl">Remediation guidance</h2>
        <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Server-owned pagination.</strong> Treat client page
            sizes as a request, not an instruction: clamp to a maximum and return the effective
            value in the response.
          </li>
          <li>
            <strong className="text-foreground">Rate limit per identity.</strong> Apply sliding
            window or token-bucket limits keyed on the authenticated subject (and IP for anonymous
            traffic), and answer with 429 plus Retry-After.
          </li>
          <li>
            <strong className="text-foreground">Budget the expensive path.</strong> Any operation
            that costs money — SMS, email, AI calls, third-party lookups — needs a per-caller and
            per-tenant spend cap with alerting.
          </li>
          <li>
            <strong className="text-foreground">Bound the work, not just the rows.</strong> Cap
            query complexity, nesting, work factors and execution time; add statement timeouts in
            the database.
          </li>
          <li>
            <strong className="text-foreground">Cap the payload.</strong> Limit request body size,
            array lengths and upload sizes before the handler does any work.
          </li>
          <li>
            <strong className="text-foreground">Observe and test.</strong> Track per-caller
            consumption, alert on outliers, and add regression tests asserting oversized requests
            are clamped and bursts are throttled.
          </li>
        </ul>
      </section>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        type="number"
        className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground"
        value={value}
        min={min}
        max={max}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(Math.max(min, Math.min(max, Math.round(next))));
        }}
      />
    </label>
  );
}

function UsageCard({
  title,
  usage,
  tone,
}: {
  title: string;
  usage: Usage;
  tone: "vulnerable" | "secure";
}) {
  const accent = tone === "vulnerable" ? "border-destructive/40" : "border-emerald-500/40";
  return (
    <div className={`rounded-lg border bg-muted/30 p-4 text-xs ${accent}`}>
      <p className="text-sm font-medium">{title}</p>
      <dl className="mt-2 grid grid-cols-2 gap-1 font-mono text-[11px]">
        <dt className="text-muted-foreground">requests</dt>
        <dd>{usage.requestCount}</dd>
        <dt className="text-muted-foreground">rows</dt>
        <dd>{usage.rowsReturned}</dd>
        <dt className="text-muted-foreground">compute</dt>
        <dd>{usage.computeUnits}</dd>
        <dt className="text-muted-foreground">notifications</dt>
        <dd>{usage.notificationsSent}</dd>
        <dt className="text-muted-foreground">spend</dt>
        <dd>{usage.budgetSpentCents}¢</dd>
      </dl>
    </div>
  );
}

type Panel = {
  data?: {
    mode?: string;
    weakness?: string | null;
    rateLimitApplied?: boolean;
    pageSizeCeiling?: number | null;
    requestedLimit?: number;
    effectiveLimit?: number;
    requestedWorkFactor?: number;
    effectiveWorkFactor?: number;
    rowsReturned?: number;
    computeUnits?: number;
    sentCount?: number;
    costCents?: number;
    controlsApplied?: string[];
  };
  error?: { code: string; message: string };
};

function ResultPanel({
  tone,
  title,
  subtitle,
  result,
}: {
  tone: "vulnerable" | "secure";
  title: string;
  subtitle: string;
  result: RawResult | null;
}) {
  const accent = tone === "vulnerable" ? "border-destructive/40" : "border-emerald-500/40";
  const payload = result?.body as Panel | null;
  const ok = result ? result.status < 400 : false;

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

      {!result ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Run a request to see the real HTTP exchange.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-xs">
            <dt className="text-muted-foreground">Request</dt>
            <dd className="break-all font-mono">
              {result.method} {result.endpoint}
            </dd>
            <dt className="text-muted-foreground">Request body</dt>
            <dd className="break-all font-mono">{JSON.stringify(result.requestBody)}</dd>
            <dt className="text-muted-foreground">Limits applied</dt>
            <dd className="font-mono">
              {payload?.data?.controlsApplied?.length
                ? payload.data.controlsApplied.join(", ")
                : "none"}
            </dd>
            <dt className="text-muted-foreground">Rows / compute</dt>
            <dd className="font-mono">
              {payload?.data?.rowsReturned ?? "—"} / {payload?.data?.computeUnits ?? "—"}
            </dd>
            <dt className="text-muted-foreground">Notifications</dt>
            <dd className="font-mono">
              {payload?.data?.sentCount !== undefined
                ? `${payload.data.sentCount} (${payload.data.costCents ?? 0}¢)`
                : "—"}
            </dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <Badge variant={ok ? "default" : "destructive"}>{result.status}</Badge>
              <span className="ml-2 text-muted-foreground">{result.durationMs} ms</span>
            </dd>
          </dl>

          {payload?.error && (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
              <span className="font-mono">{payload.error.code}</span> — {payload.error.message}
            </p>
          )}

          <details className="rounded-md border border-border bg-muted/30">
            <summary className="cursor-pointer px-3 py-2 text-xs text-muted-foreground">
              Raw response body
            </summary>
            <pre className="max-h-72 overflow-auto px-3 pb-3 text-[11px] leading-relaxed">
              {JSON.stringify(result.body, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </article>
  );
}
