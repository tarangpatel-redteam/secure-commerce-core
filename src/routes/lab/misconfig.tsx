import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";

import { RequireSession } from "@/components/site/RequireSession";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { labRequest, type RawResult } from "@/lib/lab-client";

export const Route = createFileRoute("/lab/misconfig")({
  head: () => ({
    meta: [
      { title: "Security misconfiguration lab (API8:2023) — ACME Commerce" },
      {
        name: "description",
        content:
          "Training scenario: a debug diagnostics endpoint leaking configuration, stack traces and permissive CORS, versus a hardened variant.",
      },
      { property: "og:title", content: "Security misconfiguration lab (API8:2023) — ACME Commerce" },
      {
        property: "og:description",
        content: "Compare a debug-mode endpoint with a hardened one, headers included.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <RequireSession
      title="Sign in to run the misconfiguration lab"
      description="This training scenario needs an authenticated ACME session."
    >
      <MisconfigLab />
    </RequireSession>
  ),
});

type Probe = "diagnostics" | "error" | "headers";

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
      {result ? (
        <>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Response headers</p>
          <pre className="mb-3 max-h-40 overflow-auto rounded bg-muted p-3 text-xs">
            {JSON.stringify(result.headers, null, 2)}
          </pre>
        </>
      ) : null}
      <pre className="max-h-80 overflow-auto rounded bg-muted p-3 text-xs">
        {result ? JSON.stringify(result.body, null, 2) : "No request sent yet."}
      </pre>
    </section>
  );
}

function MisconfigLab() {
  const [probe, setProbe] = useState<Probe>("diagnostics");
  const [vuln, setVuln] = useState<RawResult | null>(null);
  const [safe, setSafe] = useState<RawResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(secure: boolean) {
    setBusy(true);
    try {
      const res = await labRequest(
        "POST",
        secure ? "/lab/misconfig/secure/diagnostics" : "/lab/misconfig/diagnostics",
        { probe },
      );
      if (secure) setSafe(res);
      else setVuln(res);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <header className="space-y-2">
        <Badge variant="destructive">API8:2023</Badge>
        <h1 className="text-3xl font-semibold">Security misconfiguration</h1>
        <p className="text-muted-foreground">
          A diagnostics endpoint shipped with debug mode enabled: verbose stack traces, environment
          configuration, synthetic secret material, wildcard CORS with credentials and no hardening
          headers. All values are synthetic lab strings.
        </p>
      </header>

      <section className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <label className="text-sm">
          Probe
          <select
            value={probe}
            onChange={(event) => setProbe(event.target.value as Probe)}
            className="mt-1 block rounded border bg-background px-2 py-1"
          >
            <option value="diagnostics">diagnostics (config dump)</option>
            <option value="error">error (stack trace)</option>
            <option value="headers">headers</option>
          </select>
        </label>
        <Button variant="destructive" disabled={busy} onClick={() => void run(false)}>
          Probe misconfigured endpoint
        </Button>
        <Button disabled={busy} onClick={() => void run(true)}>
          Probe hardened endpoint
        </Button>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Vulnerable — POST /api/v1/lab/misconfig/diagnostics" tone="vuln" result={vuln} />
        <Panel
          title="Secure — POST /api/v1/lab/misconfig/secure/diagnostics"
          tone="safe"
          result={safe}
        />
      </div>

      <section className="rounded-lg border p-4 text-sm">
        <h2 className="mb-2 font-semibold">Remediation</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Disable debug endpoints and verbose errors outside development.</li>
          <li>Return generic errors with a correlation id; log details server-side only.</li>
          <li>Restrict CORS to known origins; never combine wildcard origin with credentials.</li>
          <li>Send hardening headers (HSTS, CSP, nosniff, frame-ancestors, referrer policy).</li>
          <li>Strip server/framework version banners and review configuration in CI.</li>
        </ul>
      </section>
    </main>
  );
}
