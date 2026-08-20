# API2:2023 — Broken Authentication (Phase 6)

Scenario id: `api2-broken-authentication-legacy-portal`.
Namespace: `/api/v1/lab/broken-auth/*` (weakness scoped here — the real ACME auth flow is unchanged).

## Synthetic data

`public.lab_auth_accounts` holds three fictional portal accounts, rebuilt by
`public.lab_broken_auth_reset()` (service-role only):

| username     | password        | recovery code |
| ------------ | --------------- | ------------- |
| nora.vance   | `Sunshine2026!` | `0417`        |
| milo.hart    | `Password1!`    | `7259`        |
| ops.desk     | `hunter2`       | `3186`        |

These credentials only exist inside the lab table and grant no access to the
real application.

## Endpoints

| Method | Path                                          | Behaviour                                     |
| ------ | --------------------------------------------- | --------------------------------------------- |
| GET    | `/api/v1/lab/broken-auth`                     | Scenario metadata (auth required).            |
| POST   | `/api/v1/lab/broken-auth`                     | Reset synthetic accounts (auth required).     |
| POST   | `/api/v1/lab/broken-auth/login`               | ⚠️ Vulnerable login.                          |
| POST   | `/api/v1/lab/broken-auth/secure/login`        | Hardened login.                               |
| POST   | `/api/v1/lab/broken-auth/recovery`            | ⚠️ Vulnerable OTP verification.               |
| POST   | `/api/v1/lab/broken-auth/secure/recovery`     | Hardened OTP verification.                    |

All endpoints require a valid ACME session bearer token.

## Weaknesses demonstrated

1. **User enumeration.** The vulnerable login returns different messages for
   unknown usernames vs. wrong passwords.
2. **No brute-force protection.** The vulnerable login never locks the
   account; failed attempts are counted but never enforced.
3. **Predictable session tokens.** After a successful vulnerable login the
   session token is `lab-<username>-<sequential-counter>`.
4. **Brute-forceable recovery.** The vulnerable OTP endpoint allows unlimited
   4-digit attempts and ignores expiry.

## Secure counterpart

The `/secure/*` variants use one generic error message, count failures in the
database and lock the account for 15 minutes after 5 wrong passwords, mint
session and recovery tokens from a 256-bit CSPRNG, enforce OTP expiry, cap OTP
attempts at 5, and compare codes with a constant-time equality check.

## Verification

```bash
set -a && . ./.env && set +a
python3 tests/security-labs/api2_broken_auth_test.py
```

Expected: `46/46 checks passed`.
