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
import { useAccount } from "@/hooks/useAccount";
import { formatPrice } from "@/lib/api-client";

export const Route = createFileRoute("/lab/bola")({
  head: () => ({
    meta: [
      { title: "BOLA lab (API1:2023) — ACME Commerce Security Lab" },
      {
        name: "description",
        content:
          "Isolated training scenario demonstrating Broken Object Level Authorization on customer orders, with a secure side-by-side comparison.",
      },
      { property: "og:title", content: "BOLA lab (API1:2023) — ACME Commerce Security Lab" },
      {
        property: "og:description",
        content: "Compare a vulnerable and a secure order-access endpoint side by side.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BolaLabPage,
});

type LabUser = {
  label: string;
  email: string;
  userId: string;
  orderId: string;
  orderNumber: string;
};

type Scenario = {
  scenarioId: string;
  vulnerability: string;
  owaspMapping: string;
  description: string;
  users: LabUser[];
};

type RawResult = {
  method: string;
  endpoint: string;
  status: number;
  body: unknown;
  durationMs: number;
};

/** Raw fetch so the lab can display the real HTTP status and response body. */
async function labRequest(method: "GET" | "POST", path: string): Promise<RawResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const started = performance.now();
  const response = await fetch(`/api/v1${path}`, {
    method,
    headers: {
      accept: "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = (await response.json().catch(() => null)) as unknown;
  return {
    method,
    endpoint: `/api/v1${path}`,
    status: response.status,
    body,
    durationMs: Math.round(performance.now() - started),
  };
}

function BolaLabPage() {
  return (
    <RequireSession
      title="Sign in to open the security lab"
      description="The BOLA scenario runs against real authenticated API requests, so a session is required."
    >
      <BolaLab />
    </RequireSession>
  );
}

function BolaLab() {
  const queryClient = useQueryClient();
  const { data: account } = useAccount();
  const [targetOrderId, setTargetOrderId] = useState<string>("");
  const [vulnerable, setVulnerable] = useState<RawResult | null>(null);
  const [secure, setSecure] = useState<RawResult | null>(null);

  const scenario = useQuery<Scenario>({
    queryKey: ["lab", "bola"],
    queryFn: async () => {
      const result = await labRequest("GET", "/lab/bola");
      if (result.status >= 400) throw new Error("Unable to load the lab scenario.");
      return (result.body as { data: Scenario }).data;
    },
  });

  const reset = useMutation({
    mutationFn: async () => {
      const result = await labRequest("POST", "/lab/bola");
      if (result.status >= 400) throw new Error("Reset failed.");
      return (result.body as { data: Scenario }).data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["lab", "bola"], data);
      setTargetOrderId("");
      setVulnerable(null);
      setSecure(null);
      toast.success("Lab data reset. Deterministic orders rebuilt.");
    },
    onError: () => toast.error("Could not reset the lab data."),
  });

  const run = useMutation({
    mutationFn: async (orderId: string) => {
      const [vuln, safe] = await Promise.all([
        labRequest("POST", `/lab/bola/orders/${orderId}/access`),
        labRequest("POST", `/lab/bola/secure/orders/${orderId}/access`),
      ]);
      return { vuln, safe };
    },
    onSuccess: ({ vuln, safe }) => {
      setVulnerable(vuln);
      setSecure(safe);
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

  const users = scenario.data.users;
  const signedInEmail = account?.profile.email ?? "";
  const signedInLabUser = users.find((u) => u.email === signedInEmail);
  const target = users.find((u) => u.orderId === targetOrderId);
  const isCrossAccount = Boolean(target && signedInLabUser && target.userId !== signedInLabUser.userId);

  return (
    <div className="container-page space-y-10 py-12">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="destructive" className="uppercase tracking-wide">
            Training lab
          </Badge>
          <Badge variant="secondary">{scenario.data.owaspMapping}</Badge>
          <Badge variant="outline">Synthetic data only</Badge>
        </div>
        <h1 className="text-4xl">Broken Object Level Authorization (BOLA)</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {scenario.data.description} This scenario is isolated to{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">/api/v1/lab/bola/*</code>. The
          production endpoints under{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">/api/v1/orders/*</code> remain
          fully authorized and will still refuse another customer's order.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg">Authentication</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Proves <em>who</em> the caller is. A valid bearer token gets you through the door — it
            says nothing about which records you may read.
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg">Authorization</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Proves <em>what</em> that caller may do with a specific object. BOLA happens when an
            API authenticates the request but forgets to bind the object to the subject.
          </p>
        </article>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl">Attack simulator</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in as one synthetic customer, then target the other customer's order object.
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
              <p className="font-medium">{signedInLabUser?.label ?? "Non-lab account"}</p>
              <p className="mt-1 break-all text-xs text-muted-foreground">{signedInEmail}</p>
              <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
                sub: {account?.profile.id ?? "—"}
              </p>
            </div>
            {!signedInLabUser && (
              <p className="mt-3 flex items-start gap-2 text-xs text-amber-600 dark:text-amber-500">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                For the intended walkthrough, sign in as{" "}
                <strong>customer.a@acme-commerce.test</strong> and target Customer-A's order.
              </p>
            )}
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Target object (order id)
            </h3>
            <div className="mt-3 space-y-2">
              {users.map((user) => (
                <label
                  key={user.orderId}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${
                    targetOrderId === user.orderId
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="target-order"
                    className="mt-1"
                    checked={targetOrderId === user.orderId}
                    onChange={() => setTargetOrderId(user.orderId)}
                  />
                  <span>
                    <span className="font-medium">
                      {user.orderNumber} — owned by {user.label}
                    </span>
                    <span className="mt-1 block break-all font-mono text-[11px] text-muted-foreground">
                      {user.orderId}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            onClick={() => run.mutate(targetOrderId)}
            disabled={!targetOrderId || run.isPending}
          >
            {run.isPending ? "Sending requests…" : "Run both requests"}
          </Button>
          {isCrossAccount && (
            <span className="text-xs text-muted-foreground">
              Horizontal privilege escalation attempt: subject and object owner differ.
            </span>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <ResultPanel
          tone="vulnerable"
          title="Vulnerable endpoint"
          subtitle="No object-level authorization"
          result={vulnerable}
          pending={run.isPending}
        />
        <ResultPanel
          tone="secure"
          title="Secure endpoint"
          subtitle="Explicit ownership check, deny by default"
          result={secure}
          pending={run.isPending}
        />
      </section>

      {vulnerable && secure && (
        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
            <h2 className="text-lg">Why the vulnerable result is a failure</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The endpoint returned{" "}
              <strong>HTTP {vulnerable.status}</strong> with a full order object — including the
              recipient name, shipping address, line items and payment reference — even though the
              authenticated subject does not own it. The order id is the only thing standing
              between an attacker and another customer's data, and ids are enumerable, logged and
              shared. This is horizontal privilege escalation and a reportable data breach.
            </p>
          </article>
          <article className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-6">
            <h2 className="text-lg">Why the secure result is correct</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The secure endpoint performed the same authentication and the same lookup, then
              compared the object's owner against the authenticated subject before returning
              anything. A mismatch produces <strong>HTTP {secure.status}</strong> and no object
              data at all. Authorization is decided on the server from the verified session, never
              from a client-supplied identity.
            </p>
          </article>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-xl">Remediation guidance</h2>
        <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Object-level authorization on every lookup.</strong>{" "}
            Bind the authenticated subject to the object: fetch the record, then require{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              record.owner_id === session.userId
            </code>{" "}
            (or a policy function) before serialising it.
          </li>
          <li>
            <strong className="text-foreground">Authorize on the server only.</strong> Never accept
            an owner id, role or tenant id from the request body, query string or a hidden field.
            Derive it from the verified token.
          </li>
          <li>
            <strong className="text-foreground">Deny by default.</strong> Handlers should refuse
            unless a check explicitly passes. Database-level row policies (RLS) give you a second
            layer that fails closed even when a handler forgets.
          </li>
          <li>
            <strong className="text-foreground">Prefer unpredictable identifiers.</strong> UUIDs
            reduce trivial enumeration — but they are defence in depth, never a substitute for the
            authorization check.
          </li>
          <li>
            <strong className="text-foreground">Test horizontal privilege escalation.</strong> For
            every object endpoint add an automated test where user A requests user B's object and
            assert a 403/404 with no object payload.
          </li>
          <li>
            <strong className="text-foreground">Log and alert.</strong> Record denied
            cross-account attempts; a spike is a strong enumeration signal.
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
  const accent =
    tone === "vulnerable"
      ? "border-destructive/40"
      : "border-emerald-500/40";

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
          No request sent yet. Choose a target order and run the simulator.
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
          authenticatedAs?: { userId: string; email: string };
          ownershipCheckPerformed?: boolean;
          crossAccountAccess?: boolean;
          order?: {
            id: string;
            orderNumber: string;
            ownerUserId: string;
            totalCents: number;
            currency: string;
            shippingAddress?: { recipientName?: string; city?: string };
          };
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
        <dt className="text-muted-foreground">Identity</dt>
        <dd className="break-all font-mono">
          {payload?.data?.authenticatedAs?.email ?? "bearer token (session)"}
        </dd>
        <dt className="text-muted-foreground">Ownership check</dt>
        <dd className="font-mono">
          {payload?.data?.ownershipCheckPerformed === undefined
            ? "n/a"
            : String(payload.data.ownershipCheckPerformed)}
        </dd>
        <dt className="text-muted-foreground">Status</dt>
        <dd>
          <Badge variant={ok ? "default" : "destructive"}>{result.status}</Badge>
          <span className="ml-2 text-muted-foreground">{result.durationMs} ms</span>
        </dd>
      </dl>

      {payload?.data?.crossAccountAccess && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs">
          Cross-account object returned — the authenticated subject is not the owner.
        </p>
      )}

      {payload?.data?.order && (
        <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
          <p className="font-medium">
            {payload.data.order.orderNumber} ·{" "}
            {formatPrice(payload.data.order.totalCents, payload.data.order.currency)}
          </p>
          <p className="mt-1 text-muted-foreground">
            Ships to {payload.data.order.shippingAddress?.recipientName ?? "—"},{" "}
            {payload.data.order.shippingAddress?.city ?? "—"}
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
