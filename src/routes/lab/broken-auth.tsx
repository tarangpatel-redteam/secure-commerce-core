import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, RotateCcw, ShieldCheck, ShieldX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { RequireSession } from "@/components/site/RequireSession";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/lab/broken-auth")({
  head: () => ({
    meta: [
      { title: "Broken Authentication lab (API2:2023) — ACME Commerce" },
      {
        name: "description",
        content:
          "Isolated training scenario for Broken Authentication: user enumeration, missing brute-force protection, predictable tokens and weak recovery codes, with a secure side-by-side comparison.",
      },
      { property: "og:title", content: "Broken Authentication lab (API2:2023) — ACME Commerce" },
      {
        property: "og:description",
        content:
          "Compare a weak synthetic sign-in portal with a hardened implementation over real HTTP requests.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BrokenAuthLabPage,
});

type Scenario = {
  scenarioId: string;
  vulnerability: string;
  owaspMapping: string;
  description: string;
  weaknesses: string[];
  targetUsername: string;
  knownUsernames: string[];
  candidatePasswords: string[];
  otpDigits: number;
  securePolicy: {
    maxPasswordAttempts: number;
    maxOtpAttempts: number;
    lockoutMinutes: number;
    genericErrorMessage: string;
    tokenStrategy: string;
  };
  caller: { userId: string; email: string; roles: string[] };
  accountsSeeded: number;
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

function BrokenAuthLabPage() {
  return (
    <RequireSession
      title="Sign in to open the security lab"
      description="The Broken Authentication scenario runs real authenticated API requests, so an ACME session is required."
    >
      <BrokenAuthLab />
    </RequireSession>
  );
}

type Summary = { label: string; value: string };

function ResultPanel({
  tone,
  title,
  subtitle,
  summary,
  result,
}: {
  tone: "vulnerable" | "secure";
  title: string;
  subtitle: string;
  summary: Summary[];
  result: RawResult | null;
}) {
  const Icon = tone === "vulnerable" ? ShieldX : ShieldCheck;
  return (
    <article
      className={`rounded-xl border p-6 ${
        tone === "vulnerable" ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={`size-5 ${tone === "vulnerable" ? "text-destructive" : "text-muted-foreground"}`}
        />
        <h3 className="text-lg">{title}</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>

      {summary.length > 0 && (
        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
          {summary.map((item) => (
            <div key={item.label} className="rounded-lg border border-border bg-background/60 p-3">
              <dt className="text-muted-foreground">{item.label}</dt>
              <dd className="mt-1 break-all font-mono">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Last HTTP exchange
        </p>
        {result ? (
          <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-muted/60 p-3 font-mono text-[11px] leading-relaxed">
            {`${result.method} ${result.endpoint}\n${
              result.requestBody ? `${JSON.stringify(result.requestBody, null, 2)}\n` : ""
            }\n→ ${result.status} (${result.durationMs}ms)\n${JSON.stringify(result.body, null, 2)}`}
          </pre>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Run a simulation to see the traffic.</p>
        )}
      </div>
    </article>
  );
}

function BrokenAuthLab() {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("nora.vance");
  const [vulnerable, setVulnerable] = useState<RawResult | null>(null);
  const [secure, setSecure] = useState<RawResult | null>(null);
  const [vulnSummary, setVulnSummary] = useState<Summary[]>([]);
  const [secureSummary, setSecureSummary] = useState<Summary[]>([]);

  const scenario = useQuery<Scenario>({
    queryKey: ["lab", "broken-auth"],
    queryFn: async () => {
      const result = await labRequest("GET", "/lab/broken-auth");
      if (result.status >= 400) throw new Error("Unable to load the lab scenario.");
      return (result.body as { data: Scenario }).data;
    },
  });

  const reset = useMutation({
    mutationFn: async () => {
      const result = await labRequest("POST", "/lab/broken-auth");
      if (result.status >= 400) throw new Error("Reset failed.");
      return (result.body as { data: Scenario }).data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["lab", "broken-auth"], data);
      setVulnerable(null);
      setSecure(null);
      setVulnSummary([]);
      setSecureSummary([]);
      toast.success("Lab data reset. Synthetic portal accounts restored.");
    },
    onError: () => toast.error("Could not reset the lab data."),
  });

  /** Probe an existing vs. a non-existent username and compare the messages. */
  const enumerate = useMutation({
    mutationFn: async () => {
      const bogus = "definitely.not.a.user";
      const vulnKnown = await labRequest("POST", "/lab/broken-auth/login", {
        username,
        password: "wrong-password",
      });
      const vulnUnknown = await labRequest("POST", "/lab/broken-auth/login", {
        username: bogus,
        password: "wrong-password",
      });
      const safeKnown = await labRequest("POST", "/lab/broken-auth/secure/login", {
        username,
        password: "wrong-password",
      });
      const safeUnknown = await labRequest("POST", "/lab/broken-auth/secure/login", {
        username: bogus,
        password: "wrong-password",
      });
      return { vulnKnown, vulnUnknown, safeKnown, safeUnknown };
    },
    onSuccess: ({ vulnKnown, vulnUnknown, safeKnown, safeUnknown }) => {
      const msg = (r: RawResult) =>
        String((r.body as { data?: { message?: string } })?.data?.message ?? "—");
      setVulnerable(vulnUnknown);
      setSecure(safeUnknown);
      setVulnSummary([
        { label: "Existing user", value: msg(vulnKnown) },
        { label: "Unknown user", value: msg(vulnUnknown) },
        { label: "Messages differ", value: msg(vulnKnown) === msg(vulnUnknown) ? "no" : "YES" },
        { label: "Enumeration", value: "possible" },
      ]);
      setSecureSummary([
        { label: "Existing user", value: msg(safeKnown) },
        { label: "Unknown user", value: msg(safeUnknown) },
        { label: "Messages differ", value: msg(safeKnown) === msg(safeUnknown) ? "no" : "YES" },
        { label: "Enumeration", value: "blocked" },
      ]);
    },
    onError: () => toast.error("The lab request failed to send."),
  });

  /** Walk the synthetic wordlist against both portals. */
  const bruteForce = useMutation({
    mutationFn: async () => {
      const list = scenario.data?.candidatePasswords ?? [];
      let vulnLast: RawResult | null = null;
      let safeLast: RawResult | null = null;
      let vulnAllowed = 0;
      let safeAllowed = 0;
      let vulnCracked: string | null = null;
      let safeCracked: string | null = null;
      let safeLocked = false;

      for (const candidate of list) {
        vulnLast = await labRequest("POST", "/lab/broken-auth/login", {
          username,
          password: candidate,
        });
        const vd = (vulnLast.body as { data?: { authenticated?: boolean } })?.data;
        vulnAllowed += 1;
        if (vd?.authenticated) vulnCracked = candidate;

        safeLast = await labRequest("POST", "/lab/broken-auth/secure/login", {
          username,
          password: candidate,
        });
        const sd = (safeLast.body as { data?: { authenticated?: boolean; reason?: string } })?.data;
        if (sd?.reason !== "account_locked") safeAllowed += 1;
        else safeLocked = true;
        if (sd?.authenticated) safeCracked = candidate;
      }

      return {
        vulnLast,
        safeLast,
        vulnAllowed,
        safeAllowed,
        vulnCracked,
        safeCracked,
        safeLocked,
        total: list.length,
      };
    },
    onSuccess: (r) => {
      setVulnerable(r.vulnLast);
      setSecure(r.safeLast);
      const token = (r.vulnLast?.body as { data?: { sessionToken?: string | null } })?.data
        ?.sessionToken;
      setVulnSummary([
        { label: "Attempts processed", value: `${r.vulnAllowed} / ${r.total}` },
        { label: "Lockout", value: "never" },
        { label: "Credential cracked", value: r.vulnCracked ? "YES" : "no" },
        { label: "Session token", value: token ?? "—" },
      ]);
      setSecureSummary([
        { label: "Attempts processed", value: `${r.safeAllowed} / ${r.total}` },
        { label: "Lockout", value: r.safeLocked ? "enforced" : "not needed yet" },
        { label: "Credential cracked", value: r.safeCracked ? "YES" : "no" },
        { label: "Token strategy", value: "csprng-256bit" },
      ]);
    },
    onError: () => toast.error("The lab request failed to send."),
  });

  /** Walk recovery codes 0000…: the vulnerable portal never stops you. */
  const otpAttack = useMutation({
    mutationFn: async () => {
      const codes = ["0000", "0100", "0200", "0300", "0400", "0410", "0415", "0417"];
      let vulnLast: RawResult | null = null;
      let safeLast: RawResult | null = null;
      let vulnAttempts = 0;
      let safeProcessed = 0;
      let vulnVerified = false;
      let safeVerified = false;
      let safeBlockedAt: number | null = null;

      for (const code of codes) {
        vulnLast = await labRequest("POST", "/lab/broken-auth/recovery", { username, code });
        vulnAttempts += 1;
        if ((vulnLast.body as { data?: { verified?: boolean } })?.data?.verified) {
          vulnVerified = true;
        }

        safeLast = await labRequest("POST", "/lab/broken-auth/secure/recovery", { username, code });
        const sd = (safeLast.body as { data?: { verified?: boolean; reason?: string } })?.data;
        if (sd?.reason === "too_many_attempts") {
          if (safeBlockedAt === null) safeBlockedAt = safeProcessed;
        } else {
          safeProcessed += 1;
        }
        if (sd?.verified) safeVerified = true;
      }

      return {
        vulnLast,
        safeLast,
        vulnAttempts,
        safeProcessed,
        vulnVerified,
        safeVerified,
        safeBlockedAt,
        total: codes.length,
      };
    },
    onSuccess: (r) => {
      setVulnerable(r.vulnLast);
      setSecure(r.safeLast);
      const token = (r.vulnLast?.body as { data?: { recoveryToken?: string | null } })?.data
        ?.recoveryToken;
      setVulnSummary([
        { label: "Codes tried", value: `${r.vulnAttempts} / ${r.total}` },
        { label: "Attempt cap", value: "none" },
        { label: "Expiry enforced", value: "no" },
        { label: "Recovery token", value: token ?? (r.vulnVerified ? "issued" : "—") },
      ]);
      setSecureSummary([
        { label: "Codes processed", value: `${r.safeProcessed} / ${r.total}` },
        { label: "Attempt cap", value: `${scenario.data?.securePolicy.maxOtpAttempts ?? 5}` },
        { label: "Expiry enforced", value: "yes" },
        { label: "Account takeover", value: r.safeVerified ? "YES" : "blocked" },
      ]);
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
  const pending = enumerate.isPending || bruteForce.isPending || otpAttack.isPending;

  return (
    <div className="container-page space-y-10 py-12">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="destructive" className="uppercase tracking-wide">
            Training lab
          </Badge>
          <Badge variant="secondary">{data.owaspMapping}</Badge>
          <Badge variant="outline">Synthetic accounts only</Badge>
        </div>
        <h1 className="text-4xl">Broken Authentication</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {data.description} The scenario is isolated to{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">/api/v1/lab/broken-auth/*</code>{" "}
          and the synthetic{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">lab_auth_accounts</code> table.
          Real ACME sign-in still uses the hardened production auth stack — you had to pass it to
          reach this page.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg">Weaknesses in scope</h2>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {data.weaknesses.join(", ")}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg">Synthetic portal accounts</h2>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {data.knownUsernames.join(", ")}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            {data.accountsSeeded} fictional accounts seeded. They grant no access to ACME