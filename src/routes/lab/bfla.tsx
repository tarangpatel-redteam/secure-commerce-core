import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RotateCcw, ShieldCheck, ShieldX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { RequireSession } from "@/components/site/RequireSession";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/api-client";

export const Route = createFileRoute("/lab/bfla")({
  head: () => ({
    meta: [
      { title: "BFLA lab (API5:2023) — ACME Commerce Security Lab" },
      {
        name: "description",
        content:
          "Isolated training scenario demonstrating Broken Function Level Authorization on a staff-only order status transition, with a secure side-by-side comparison.",
      },
      { property: "og:title", content: "BFLA lab (API5:2023) — ACME Commerce Security Lab" },
      {
        property: "og:description",
        content: "Compare a vulnerable and a secure staff-only order function side by side.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BflaLabPage,
});

type LabOrder = {
  id: string;
  orderNumber: string;
  status: string;
  ownerUserId: string;
  ownerEmail: string | null;
  totalCents: number;
  currency: string;
  updatedAt: string;
};

type Scenario = {
  scenarioId: string;
  vulnerability: string;
  owaspMapping: string;
  description: string;
  privilegedFunction: string;
  allowedStatuses: string[];
  staffRoles: string[];
  users: { label: string; email: string; role: string }[];
  labOrder: LabOrder | null;
  caller: { userId: string; email: string; roles: string[]; isStaff: boolean };
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

function BflaLabPage() {
  return (
    <RequireSession
      title="Sign in to open the security lab"
      description="The BFLA scenario runs against real authenticated API requests, so a session is required."
    >
      <BflaLab />
    </RequireSession>
  );
}

function BflaLab() {
  const queryClient = useQueryClient();
  const [targetStatus, setTargetStatus] = useState("shipped");
  const [vulnerable, setVulnerable] = useState<RawResult | null>(null);
  const [secure, setSecure] = useState<RawResult | null>(null);

  const scenario = useQuery<Scenario>({
    queryKey: ["lab", "bfla"],
    queryFn: async () => {
      const result = await labRequest("GET", "/lab/bfla");
      if (result.status >= 400) throw new Error("Unable to load the lab scenario.");
      return (result.body as { data: Scenario }).data;
    },
  });

  const reset = useMutation({
    mutationFn: async () => {
      const result = await labRequest("POST", "/lab/bfla");
      if (result.status >= 400) throw new Error("Reset failed.");
      return (result.body as { data: Scenario }).data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["lab", "bfla"], data);
      setVulnerable(null);
      setSecure(null);
      toast.success("Lab data reset. Order restored to `paid`.");
    },
    onError: () => toast.error("Could not reset the lab data."),
  });

  const run = useMutation({
    mutationFn: async (orderId: string) => {
      const vuln = await labRequest("POST", `/lab/bfla/orders/${orderId}/status`, {
        status: targetStatus,
      });
      const safe = await labRequest("POST", `/lab/bfla/secure/orders/${orderId}/status`, {
        status: targetStatus,
      });
      return { vuln, safe };
    },
    onSuccess: ({ vuln, safe }) => {
      setVulnerable(vuln);
      setSecure(safe);
      void queryClient.invalidateQueries({ queryKey: ["lab", "bfla"] });
    },
    onError: () => toast.error("The lab request failed to send."),
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
  const labOrder = data.labOrder;

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
        <h1 className="text-4xl">Broken Function Level Authorization (BFLA)</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {data.description} This scenario is isolated to{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">/api/v1/lab/bfla/*</code>. Every
          production endpoint — including{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">/api/v1/orders/*</code> and the
          staff directory — keeps its server-side role checks.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg">Object vs function</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            BOLA asks “may this subject touch <em>this record</em>?”. BFLA asks “may this subject
            invoke <em>this operation at all</em>?”. Both must be answered on the server.
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg">Privileged function</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            <code className="rounded bg-muted px-1 py-0.5 text-xs">{data.privilegedFunction}</code>{" "}
            — moving an order through fulfilment. Reserved for{" "}
            {data.staffRoles.join(", ")}.
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg">Hidden ≠ protected</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The storefront never renders this control for customers. Hiding a button in the UI is
            not authorization — the route is still reachable with a plain HTTP client.
          </p>
        </article>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl">Privilege escalation simulator</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in as a synthetic customer, then invoke the staff-only fulfilment function.
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
              <Badge className="mt-3" variant={data.caller.isStaff ? "default" : "outline"}>
                {data.caller.isStaff ? "Staff privileges" : "No staff privileges"}
              </Badge>
            </div>
            {data.caller.isStaff && (
              <p className="mt-3 flex items-start gap-2 text-xs text-amber-600 dark:text-amber-500">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                You already hold a staff role, so both endpoints will succeed. Sign in as{" "}
                <strong>customer.a@acme-commerce.test</strong> to observe the failure.
              </p>
            )}
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Target function call
            </h3>
            <div className="mt-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
              {labOrder ? (
                <>
                  <p className="font-medium">
                    {labOrder.orderNumber} — owned by {labOrder.ownerEmail ?? labOrder.ownerUserId}
                  </p>
                  <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                    {labOrder.id}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    current status: <span className="font-mono">{labOrder.status}</span>
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Lab order missing — reset the lab data.
                </p>
              )}
            </div>
            <label className="mt-3 block text-xs text-muted-foreground">
              Target status
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                value={targetStatus}
                onChange={(event) => setTargetStatus(event.target.value)}
              >
                {data.allowedStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            onClick={() => labOrder && run.mutate(labOrder.id)}
            disabled={!labOrder || run.isPending}
          >
            {run.isPending ? "Sending requests…" : "Run both requests"}
          </Button>
          {!data.caller.isStaff && (
            <span className="text-xs text-muted-foreground">
              Vertical privilege escalation attempt: subject holds no staff role.
            </span>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <ResultPanel
          tone="vulnerable"
          title="Vulnerable endpoint"
          subtitle="No function-level authorization"
          result={vulnerable}
          pending={run.isPending}
        />
        <ResultPanel
          tone="secure"
          title="Secure endpoint"
          subtitle="Explicit role check, deny by default"
          result={secure}
          pending={run.isPending}
        />
      </section>

      {vulnerable && secure && (
        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
            <h2 className="text-lg">Why the vulnerable result is a failure</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The endpoint returned <strong>HTTP {vulnerable.status}</strong> and actually mutated
              the order's fulfilment state on behalf of a caller with no staff role. Function-level
              authorization was never evaluated, so the API's only protection was the fact that the
              route is not linked in the UI — which any proxy, JS bundle or docs page reveals. This
              is vertical privilege escalation: a customer performing an administrative action.
            </p>
          </article>
          <article className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-6">
            <h2 className="text-lg">Why the secure result is correct</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The secure endpoint resolved the caller's roles from the verified session, required a
              staff role before touching anything, and returned{" "}
              <strong>HTTP {secure.status}</strong> with no state change when the check failed. The
              authorization decision happens before the operation, on the server, from trusted data.
            </p>
          </article>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-xl">Remediation guidance</h2>
        <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Authorize the function, not just the record.</strong>{" "}
            Every administrative route needs an explicit role/permission check before any work is
            done, in addition to object-level checks.
          </li>
          <li>
            <strong className="text-foreground">Deny by default.</strong> Group privileged routes
            behind shared middleware that refuses unless a permission is explicitly granted, so a
            newly added handler is protected before anyone remembers to protect it.
          </li>
          <li>
            <strong className="text-foreground">Derive roles server-side.</strong> Resolve
            entitlements from the verified session against a dedicated roles table — never from a
            request body, header, query parameter or client-side flag.
          </li>
          <li>
            <strong className="text-foreground">Do not rely on obscurity.</strong> Unlinked routes,
            hidden buttons and undocumented verbs are discoverable. Treat every reachable method as
            attacker-visible.
          </li>
          <li>
            <strong className="text-foreground">Keep a defence in depth layer.</strong> Row-level
            security and database-side role functions fail closed when a handler forgets.
          </li>
          <li>
            <strong className="text-foreground">Test vertical privilege escalation.</strong> For
            every privileged operation add an automated test where a low-privilege user invokes it
            and must receive 403 with no state change.
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
          No request sent yet. Choose a target status and run the simulator.
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
          authenticatedAs?: { userId: string; email: string; roles: string[] };
          roleCheckPerformed?: boolean;
          privilegeEscalation?: boolean;
          previousStatus?: string;
          order?: { orderNumber: string; status: string; totalCents: number; currency: string };
        };
        error?: { code: string; message: string };
      }
    | null;

  const ok = result.status < 400;

  return (
    <div className="mt-5 space-y-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
        <dt className="text-muted-foreground">Method</dt>
        <dd className="font-mono">{result.method}</dd>
        <dt className="text-muted-foreground">Endpoint</dt>
        <dd className="break-all font-mono">{result.endpoint}</dd>
        <dt className="text-muted-foreground">Request body</dt>
        <dd className="break-all font-mono">{JSON.stringify(result.requestBody)}</dd>
        <dt className="text-muted-foreground">Identity</dt>
        <dd className="break-all font-mono">
          {payload?.data?.authenticatedAs?.email ?? "bearer token (session)"}
        </dd>
        <dt className="text-muted-foreground">Roles</dt>
        <dd className="font-mono">{payload?.data?.authenticatedAs?.roles?.join(", ") ?? "—"}</dd>
        <dt className="text-muted-foreground">Role check</dt>
        <dd className="font-mono">
          {payload?.data?.roleCheckPerformed === undefined
            ? "n/a"
            : String(payload.data.roleCheckPerformed)}
        </dd>
        <dt className="text-muted-foreground">Status</dt>
        <dd>
          <Badge variant={ok ? "default" : "destructive"}>{result.status}</Badge>
          <span className="ml-2 text-muted-foreground">{result.durationMs} ms</span>
        </dd>
      </dl>

      {payload?.data?.privilegeEscalation && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs">
          Staff-only function executed by a non-staff subject — vertical privilege escalation.
        </p>
      )}

      {payload?.data?.order && (
        <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
          <p className="font-medium">
            {payload.data.order.orderNumber} ·{" "}
            {formatPrice(payload.data.order.totalCents, payload.data.order.currency)}
          </p>
          <p className="mt-1 text-muted-foreground">
            status: {payload.data.previousStatus} → {payload.data.order.status}
          </p>
        </div>
      )}

      {payload?.error && (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
          <span className="font-mono">{payload.error.code}</span> — {payload.error.message}
        </p>
      )}

      <details className="rounded-md border border-border bg-muted/30">
        <summary className="cursor-pointer px-3 py-2 text-xs text-muted-foreground">
          Sanitized response body
        </summary>
        <pre className="max-h-72 overflow-auto px-3 pb-3 text-[11px] leading-relaxed">
          {JSON.stringify(result.body, null, 2)}
        </pre>
      </details>
    </div>
  );
}
