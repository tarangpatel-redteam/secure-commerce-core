import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";

import { RequireSession } from "@/components/site/RequireSession";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { labRequest, type RawResult } from "@/lib/lab-client";

export const Route = createFileRoute("/lab/ssrf")({
  head: () => ({
    meta: [
      { title: "SSRF lab (API7:2023) — ACME Commerce" },
      {
        name: "description",
        content:
          "Training scenario: a supplier image importer that fetches any URL server-side, compared with an allowlisted secure importer.",
      },
      { property: "og:title", content: "SSRF lab (API7:2023) — ACME Commerce" },
      {
        property: "og:description",
        content: "Pivot a server-side fetch into a simulated internal network, then block it.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <RequireSession
      title="Sign in to run the SSRF lab"
      description="This training scenario needs an authenticated ACME session."
    >
      <SsrfLab />
    </RequireSession>
  ),
});

type Scenario = {
  description: string;
  allowedHosts: string[];
  samplePayloads: string[];
  simulatedTargets: { host: string; internal: boolean }[];
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

function SsrfLab() {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [url, setUrl] = useState("http://169.254.169.254/latest/meta-data/iam/security-credentials/");
  const [vuln, setVuln] = useState<RawResult | null>(null);
  const [safe, setSafe] = useState<RawResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await labRequest("GET", "/lab/ssrf");
    setScenario((res.body as { data?: Scenario } | null)?.data ?? null);
  }
  if (!scenario) void load();

  async function run(secure: boolean) {
    setBusy(true);
    try {
      const res = await labRequest("POST", secure ? "/lab/ssrf/secure/import" : "/lab/ssrf/import", {
        url,
      });
      if (secure) setSafe(res);
      else setVuln(res);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <header className="space-y-2">
        <Badge variant="destructive">API7:2023</Badge>
        <h1 className="text-3xl font-semibold">Server Side Request Forgery</h1>
        <p className="text-muted-foreground">{scenario?.description}</p>
      </header>

      <section className="space-y-3 rounded-lg border p-4">
        <label className="block text-sm">
          Supplier image URL
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className="mt-1 w-full rounded border bg-background px-3 py-2 font-mono text-xs"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {(scenario?.samplePayloads ?? []).map((sample) => (
            <Button key={sample} size="sm" variant="outline" onClick={() => setUrl(sample)}>
              {sample.slice(0, 46)}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="destructive" disabled={busy} onClick={() => void run(false)}>
            Import via vulnerable endpoint
          </Button>
          <Button disabled={busy} onClick={() => void run(true)}>
            Import via secure endpoint
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Allowlisted hosts: {(scenario?.allowedHosts ?? []).join(", ")}. Fetches resolve against a
          simulated offline network — no real egress.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Vulnerable — POST /api/v1/lab/ssrf/import" tone="vuln" result={vuln} />
        <Panel title="Secure — POST /api/v1/lab/ssrf/secure/import" tone="safe" result={safe} />
      </div>

      <section className="rounded-lg border p-4 text-sm">
        <h2 className="mb-2 font-semibold">Remediation</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Allowlist destination hosts and schemes; reject everything else by default.</li>
          <li>Resolve DNS and block private, loopback and link-local ranges (re-check after redirects).</li>
          <li>Disable redirect following, set timeouts and cap response size.</li>
          <li>Fetch from an egress-restricted network segment with no metadata service access.</li>
        </ul>
      </section>
    </main>
  );
}
