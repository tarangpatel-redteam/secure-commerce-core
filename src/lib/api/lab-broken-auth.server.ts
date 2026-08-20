/**
 * Server-side logic for the Broken Authentication lab —
 * OWASP API Security Top 10, API2:2023.
 *
 * The scenario models a *secondary* sign-in surface (a fictional "legacy
 * account portal") that lives entirely inside the lab namespace. It has its
 * own synthetic account table, its own credentials and its own tokens. It is
 * NOT connected to the real ACME Commerce authentication stack in any way:
 * callers must already hold a valid ACME session to reach these endpoints.
 *
 * The intentional weaknesses (vulnerable variants only):
 *   1. User enumeration — distinct error messages for "unknown username" and
 *      "wrong password".
 *   2. No brute-force protection — unlimited password attempts, no lockout,
 *      no throttling, no attempt accounting that ever blocks.
 *   3. Predictable session tokens — sequential, guessable, unsigned.
 *   4. Brute-forceable one-time code — 4-digit recovery code with unlimited
 *      attempts and no expiry enforcement.
 *
 * Every secure counterpart below fixes exactly one class of the above.
 */
import type { AppRole } from "./context.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Row = {
  id: string;
  username: string;
  display_name: string;
  password_salt: string;
  password_hash: string;
  vuln_failed_attempts: number;
  secure_failed_attempts: number;
  locked_until: string | null;
  otp_code: string;
  otp_expires_at: string;
  vuln_otp_attempts: number;
  secure_otp_attempts: number;
  session_counter: number;
};

const SELECT =
  "id, username, display_name, password_salt, password_hash, vuln_failed_attempts, secure_failed_attempts, locked_until, otp_code, otp_expires_at, vuln_otp_attempts, secure_otp_attempts, session_counter";

/** Lockout policy applied by the SECURE variants only. */
export const SECURE_MAX_PASSWORD_ATTEMPTS = 5;
export const SECURE_MAX_OTP_ATTEMPTS = 5;
export const SECURE_LOCKOUT_MINUTES = 15;

async function loadAccount(username: string): Promise<Row | null> {
  const supabase = await admin();
  const { data, error } = await supabase
    .from("lab_auth_accounts")
    .select(SELECT)
    .eq("username", username)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Row | null) ?? null;
}

async function patchAccount(id: string, patch: Record<string, unknown>) {
  const supabase = await admin();
  const { error } = await supabase
    .from("lab_auth_accounts")
    .update(patch as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

const encoder = new TextEncoder();

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function passwordMatches(row: Row, password: string): Promise<boolean> {
  return (await sha256Hex(row.password_salt + password)) === row.password_hash;
}

/** Length-safe, timing-safe string comparison used by the secure variants. */
function timingSafeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i += 1) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type LabAuthLoginResult = {
  mode: "vulnerable" | "secure";
  authenticated: boolean;
  reason:
    | "authenticated"
    | "unknown_user"
    | "invalid_password"
    | "invalid_credentials"
    | "account_locked";
  /** The message a real client would render — enumeration lives here. */
  message: string;
  userEnumerationPossible: boolean;
  bruteForceProtection: boolean;
  failedAttempts: number;
  attemptsRemaining: number | null;
  lockedUntil: string | null;
  sessionToken: string | null;
  tokenStrategy: string;
};

/**
 * ⚠️ INTENTIONALLY VULNERABLE (API2:2023).
 *
 * - Different errors for unknown user vs. wrong password → enumeration.
 * - Failed attempts are counted but never enforced → unlimited brute force.
 * - The issued token is `lab-<username>-<sequence>` → fully predictable.
 */
export async function labAuthVulnerableLogin(
  username: string,
  password: string,
): Promise<LabAuthLoginResult> {
  const row = await loadAccount(username);

  if (!row) {
    // ⚠️ Tells the attacker the username does not exist.
    return {
      mode: "vulnerable",
      authenticated: false,
      reason: "unknown_user",
      message: `No account found for username "${username}".`,
      userEnumerationPossible: true,
      bruteForceProtection: false,
      failedAttempts: 0,
      attemptsRemaining: null,
      lockedUntil: null,
      sessionToken: null,
      tokenStrategy: "sequential-predictable",
    };
  }

  if (!(await passwordMatches(row, password))) {
    // ⚠️ Counter increases, but nothing ever blocks the next attempt.
    await patchAccount(row.id, { vuln_failed_attempts: row.vuln_failed_attempts + 1 });
    return {
      mode: "vulnerable",
      authenticated: false,
      reason: "invalid_password",
      message: `Incorrect password for "${username}". Please try again.`,
      userEnumerationPossible: true,
      bruteForceProtection: false,
      failedAttempts: row.vuln_failed_attempts + 1,
      attemptsRemaining: null,
      lockedUntil: null,
      sessionToken: null,
      tokenStrategy: "sequential-predictable",
    };
  }

  const nextCounter = row.session_counter + 1;
  await patchAccount(row.id, { session_counter: nextCounter, vuln_failed_attempts: 0 });

  return {
    mode: "vulnerable",
    authenticated: true,
    reason: "authenticated",
    message: `Welcome back, ${row.display_name}.`,
    userEnumerationPossible: true,
    bruteForceProtection: false,
    failedAttempts: 0,
    attemptsRemaining: null,
    lockedUntil: null,
    // ⚠️ Guessable: anyone can forge the next session token.
    sessionToken: `lab-${row.username}-${String(nextCounter).padStart(6, "0")}`,
    tokenStrategy: "sequential-predictable",
  };
}

/**
 * Secure counterpart: one generic failure message, an enforced lockout after
 * a small number of failures, and a cryptographically random session token.
 */
export async function labAuthSecureLogin(
  username: string,
  password: string,
): Promise<LabAuthLoginResult> {
  const generic = "Invalid username or password.";
  const row = await loadAccount(username);

  if (!row) {
    // Same shape, same message, same reason code as a wrong password.
    return {
      mode: "secure",
      authenticated: false,
      reason: "invalid_credentials",
      message: generic,
      userEnumerationPossible: false,
      bruteForceProtection: true,
      failedAttempts: 0,
      attemptsRemaining: SECURE_MAX_PASSWORD_ATTEMPTS,
      lockedUntil: null,
      sessionToken: null,
      tokenStrategy: "csprng-256bit",
    };
  }

  const lockedUntil = row.locked_until ? new Date(row.locked_until) : null;
  if (lockedUntil && lockedUntil.getTime() > Date.now()) {
    return {
      mode: "secure",
      authenticated: false,
      reason: "account_locked",
      message: "Too many attempts. Try again later or use account recovery.",
      userEnumerationPossible: false,
      bruteForceProtection: true,
      failedAttempts: row.secure_failed_attempts,
      attemptsRemaining: 0,
      lockedUntil: row.locked_until,
      sessionToken: null,
      tokenStrategy: "csprng-256bit",
    };
  }

  if (!(await passwordMatches(row, password))) {
    const attempts = row.secure_failed_attempts + 1;
    const shouldLock = attempts >= SECURE_MAX_PASSWORD_ATTEMPTS;
    const lockUntil = shouldLock
      ? new Date(Date.now() + SECURE_LOCKOUT_MINUTES * 60_000).toISOString()
      : null;
    await patchAccount(row.id, {
      secure_failed_attempts: attempts,
      ...(shouldLock ? { locked_until: lockUntil } : {}),
    });
    return {
      mode: "secure",
      authenticated: false,
      reason: shouldLock ? "account_locked" : "invalid_credentials",
      message: shouldLock
        ? "Too many attempts. Try again later or use account recovery."
        : generic,
      userEnumerationPossible: false,
      bruteForceProtection: true,
      failedAttempts: attempts,
      attemptsRemaining: Math.max(0, SECURE_MAX_PASSWORD_ATTEMPTS - attempts),
      lockedUntil: lockUntil,
      sessionToken: null,
      tokenStrategy: "csprng-256bit",
    };
  }

  await patchAccount(row.id, { secure_failed_attempts: 0, locked_until: null });

  return {
    mode: "secure",
    authenticated: true,
    reason: "authenticated",
    message: "Signed in.",
    userEnumerationPossible: false,
    bruteForceProtection: true,
    failedAttempts: 0,
    attemptsRemaining: SECURE_MAX_PASSWORD_ATTEMPTS,
    lockedUntil: null,
    sessionToken: randomToken(),
    tokenStrategy: "csprng-256bit",
  };
}

export type LabAuthOtpResult = {
  mode: "vulnerable" | "secure";
  verified: boolean;
  reason: "verified" | "invalid_code" | "expired" | "too_many_attempts" | "unknown_user";
  message: string;
  attempts: number;
  attemptsRemaining: number | null;
  expiryEnforced: boolean;
  recoveryToken: string | null;
};

/**
 * ⚠️ INTENTIONALLY VULNERABLE (API2:2023 — weak account recovery).
 *
 * A 4-digit code with unlimited attempts and no expiry check: the whole
 * keyspace (10,000 values) can be walked in seconds.
 */
export async function labAuthVulnerableVerifyOtp(
  username: string,
  code: string,
): Promise<LabAuthOtpResult> {
  const row = await loadAccount(username);
  if (!row) {
    return {
      mode: "vulnerable",
      verified: false,
      reason: "unknown_user",
      message: `No account found for username "${username}".`,
      attempts: 0,
      attemptsRemaining: null,
      expiryEnforced: false,
      recoveryToken: null,
    };
  }

  const attempts = row.vuln_otp_attempts + 1;
  await patchAccount(row.id, { vuln_otp_attempts: attempts });

  // ⚠️ No attempt cap and no expiry check.
  if (row.otp_code !== code) {
    return {
      mode: "vulnerable",
      verified: false,
      reason: "invalid_code",
      message: "That code is not correct. Try another one.",
      attempts,
      attemptsRemaining: null,
      expiryEnforced: false,
      recoveryToken: null,
    };
  }

  return {
    mode: "vulnerable",
    verified: true,
    reason: "verified",
    message: "Recovery code accepted.",
    attempts,
    attemptsRemaining: null,
    expiryEnforced: false,
    recoveryToken: `lab-reset-${row.username}-${String(attempts).padStart(4, "0")}`,
  };
}

/** Secure counterpart: capped attempts, enforced expiry, timing-safe compare. */
export async function labAuthSecureVerifyOtp(
  username: string,
  code: string,
): Promise<LabAuthOtpResult> {
  const generic = "That code is not valid.";
  const row = await loadAccount(username);
  if (!row) {
    return {
      mode: "secure",
      verified: false,
      reason: "invalid_code",
      message: generic,
      attempts: 0,
      attemptsRemaining: SECURE_MAX_OTP_ATTEMPTS,
      expiryEnforced: true,
      recoveryToken: null,
    };
  }

  if (row.secure_otp_attempts >= SECURE_MAX_OTP_ATTEMPTS) {
    return {
      mode: "secure",
      verified: false,
      reason: "too_many_attempts",
      message: "Too many recovery attempts. Request a new code.",
      attempts: row.secure_otp_attempts,
      attemptsRemaining: 0,
      expiryEnforced: true,
      recoveryToken: null,
    };
  }

  const attempts = row.secure_otp_attempts + 1;
  await patchAccount(row.id, { secure_otp_attempts: attempts });

  if (new Date(row.otp_expires_at).getTime() <= Date.now()) {
    return {
      mode: "secure",
      verified: false,
      reason: "expired",
      message: "That code has expired. Request a new one.",
      attempts,
      attemptsRemaining: Math.max(0, SECURE_MAX_OTP_ATTEMPTS - attempts),
      expiryEnforced: true,
      recoveryToken: null,
    };
  }

  if (!timingSafeEqual(row.otp_code, code)) {
    return {
      mode: "secure",
      verified: false,
      reason: "invalid_code",
      message: generic,
      attempts,
      attemptsRemaining: Math.max(0, SECURE_MAX_OTP_ATTEMPTS - attempts),
      expiryEnforced: true,
      recoveryToken: null,
    };
  }

  await patchAccount(row.id, { secure_otp_attempts: 0 });
  return {
    mode: "secure",
    verified: true,
    reason: "verified",
    message: "Recovery code accepted.",
    attempts,
    attemptsRemaining: SECURE_MAX_OTP_ATTEMPTS,
    expiryEnforced: true,
    recoveryToken: randomToken(),
  };
}

/** Rebuilds the deterministic synthetic accounts. */
export async function labAuthReset(): Promise<Record<string, unknown>> {
  const supabase = await admin();
  const { data, error } = await supabase.rpc("lab_broken_auth_reset");
  if (error) throw new Error(error.message);
  return data as unknown as Record<string, unknown>;
}

export type LabAuthScenario = {
  scenarioId: string;
  vulnerability: string;
  owaspMapping: string;
  description: string;
  weaknesses: string[];
  targetUsername: string;
  knownUsernames: string[];
  /** Synthetic wordlist used by the training brute-force simulator. */
  candidatePasswords: string[];
  otpDigits: number;
  securePolicy: {
    maxPasswordAttempts: number;
    maxOtpAttempts: number;
    lockoutMinutes: number;
    genericErrorMessage: string;
    tokenStrategy: string;
  };
  caller: { userId: string; email: string; roles: AppRole[] };
  accountsSeeded: number;
};

/**
 * Scenario metadata. Everything here is synthetic: the "passwords" belong to
 * fictional lab-only accounts and grant no access to the real application.
 */
export async function labAuthScenario(caller: {
  userId: string;
  email: string;
  roles: AppRole[];
}): Promise<LabAuthScenario> {
  const supabase = await admin();
  const { count } = await supabase
    .from("lab_auth_accounts")
    .select("id", { count: "exact", head: true });

  return {
    scenarioId: "api2-broken-authentication-legacy-portal",
    vulnerability: "Broken Authentication",
    owaspMapping: "API2:2023",
    description:
      "A fictional legacy account portal exposes its own sign-in and recovery API. The vulnerable variant answers with different messages for unknown usernames and wrong passwords, never locks an account out, hands back a sequential session token, and verifies a 4-digit recovery code with unlimited attempts and no expiry check.",
    weaknesses: [
      "user_enumeration",
      "no_brute_force_protection",
      "predictable_session_token",
      "brute_forceable_recovery_code",
    ],
    targetUsername: "nora.vance",
    knownUsernames: ["nora.vance", "milo.hart", "ops.desk"],
    candidatePasswords: [
      "Password1!",
      "acme2026",
      "letmein",
      "Summer2026",
      "Sunshine2026!",
      "hunter2",
    ],
    otpDigits: 4,
    securePolicy: {
      maxPasswordAttempts: SECURE_MAX_PASSWORD_ATTEMPTS,
      maxOtpAttempts: SECURE_MAX_OTP_ATTEMPTS,
      lockoutMinutes: SECURE_LOCKOUT_MINUTES,
      genericErrorMessage: "Invalid username or password.",
      tokenStrategy: "csprng-256bit",
    },
    caller,
    accountsSeeded: count ?? 0,
  };
}
