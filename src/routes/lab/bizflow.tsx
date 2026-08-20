import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, RotateCcw, ShieldCheck } from "lucide-react";

import { RequireSession } from "@/components/site/RequireSession";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { labRequest, type RawResult } from "@/lib/lab-client";

export const Route = createFileRoute("/lab/bizflow")({
  head: () => ({
    meta: [
      { title: "Business flow abuse lab (API6:2023) — ACME Commerce" },
      {
        name: "description",
        content:
          "Training scenario: a flash sale with no anti-automation controls, compared with a rate- and quota-limited secure implementation.",
      },
      { property: "og:title", content: "Business flow abuse lab (API6:2023) — ACME Commerce" },
      {
        property: "og:description",
        content: "Sweep a limited drop with a scripted client, then see the controls that stop it.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <RequireSession
      title="Sign in to run the business flow lab"
      description="This training scenario needs an authenticated ACME session."
    >
      <BizflowLab />
    </RequireSession>
  ),
});

type Scenario = {
  description: string;
  sku: string;
  controls: { maxPerRequest: number; maxPerUser: number; minIntervalMs: number };
  stock: { vulnerable: number; secure: number };
  ownedByCaller: { vulnerable: number; secure: number };
};

function Panel({ title, tone, result }: { title: string; tone: "vuln" | "safe"; result: RawResult | null }) {
  return (
    <section className="rounded-lg border p-4">
      <div className="mb-2 flex items-center gap-2">
        {tone === "vuln" ? (
          <AlertTriangle className="h-4 w-4 text-destructive" />
        ) : (
          <ShieldCheck className="h-4 w-4 text-primary" />
        )}
        <h2 className="font-semibold">{title}</h2>
        {result ? <Badge variant="outline">HTTP {result.status}</Badge> : null}
      </div>
      <pre className="max-h-96 overflow-auto rounded bg-muted p-3 text-xs">
        {result ? JSON.stringify(result, null, 2) : "No request sent yet."}
      </pre>
    </section>
  );
}

function BizflowLab() {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [vuln, setVuln] = useState<RawResult | null>(null);
  const [safe, setSafe] = useState<RawResult | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [quantity, setQuantity] = useState(10);
  const [bursts, setBursts] = useState(5);
  const [busy, setBusy] = useState(false);

  async function load(method: "GET" | "POST" = "GET") {
    const res = await labRequest(method, "/lab/bizflow");
    const data = (res.body as { data?: Scenario } | null)?.data ?? null;
    setScenario(data);
  }

  async function flood(secure: boolean) {
    setBusy(true);
    try {
      let granted = 0;
      let blocked = 0;
      let last: RawResult | null = null;
      for (let i = 0; i < bursts; i += 1) {
        last = await labRequest("POST", secure ? "/lab/bizflow/secure/buy" : "/lab/bizflow/buy", {
          quantity,
        });
        const body = last.body as { data?: { granted?: number } } | null;
        if (last.status === 200) granted += body?.data?.granted ?? 0;
        else blocked += 1;
      }
      if (secure) setSafe(last);
      else setVuln(last);
      setSummary(
        `${secure ? "Secure" : "Vulnerable"} run: ${bursts} requests x ${quantity} units → ${granted} units acquired, ${blocked} requests blocked.`,
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!scenario) void load();

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <header className="space-y-2">
        <Badge variant="destructive">API6:2023</Badge>
        <h1 className="text-3xl font-semibold">Unrestricted access to sensitive business flows</h1>
        <p className="text-muted-foreground">{scenario?.description}</p>
      </header>

      <section className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
        <div>
          <p className="text-sm text-muted-foreground">Vulnerable drop stock</p>
          <p className="text-2xl font-semibold">{scenario?.stock.vulnerable ?? "—"}</p>
          <p className="text-xs text-muted-foreground">
            You own {scenario?.ownedByCaller.vulnerable ?? 0}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Secure drop stock</p>
          <p className="text-2xl font-semibold">{scenario?.stock.secure ?? "—"}</p>
          <p className="text-xs text-muted-foreground">
            You own {scenario?.ownedByCaller.secure ?? 0} (cap {scenario?.controls.maxPerUser})
          </p>
        </div>
      </section>

      <section className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <label className="text-sm">
          Units per request
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            className="mt-1 block w-28 rounded border bg-background px-2 py-1"
          />
        </label>
        <label className="text-sm">
          Requests in burst
          <input
            type="number"
            min={1}
            max={20}
            value={bursts}
            onChange={(event) => setBursts(Number(event.target.value))}
            className="mt-1 block w-28 rounded border bg-background px-2 py-1"
          />
        </label>
        <Button variant="destructive" disabled={busy} onClick={() => void flood(false)}>
          Run bot against vulnerable
        </Button>
        <Button disabled={busy} onClick={() => void flood(true)}>
          Run bot against secure
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => void load("POST")}>
          <RotateCcw className="mr-2 h-4 w-4" /> Reset lab
        </Button>
      </section>

      {summary ? <p className="rounded bg-muted p-3 text-sm">{summary}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Vulnerable — POST /api/v1/lab/bizflow/buy" tone="vuln" result={vuln} />
        <Panel title="Secure — POST /api/v1/lab/bizflow/secure/buy" tone="safe" result={safe} />
      </div>

      <section className="rounded-lg border p-4 text-sm">
        <h2 className="mb-2 font-semibold">Remediation</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Cap quantity per request and total allocation per customer/payment instrument.</li>
          <li>Apply velocity limits and device/automation fingerprinting on sensitive flows.</li>
          <li>Require human-verification challenges for high-demand drops.</li>
          <li>Monitor for single-identity sweeps and alert on anomalous acquisition rates.</li>
        </ul>
      </section>
    </main>
  );
}
