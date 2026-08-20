"""Phase 6 - API2:2023 Broken Authentication lab tests.

Run with the dev server on :8080 and the backend env vars loaded:
    set -a && . ./.env && set +a && python3 tests/security-labs/api2_broken_auth_test.py
"""
import json, os, urllib.request, urllib.error, sys

BASE = "http://localhost:8080"
SB = os.environ["VITE_SUPABASE_URL"]
KEY = os.environ["VITE_SUPABASE_PUBLISHABLE_KEY"]
PW = "AcmeLab#2026"
USER = "nora.vance"
REAL_PW = "Sunshine2026!"
OTP = "0417"


def req(url, method="GET", body=None, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("content-type", "application/json")
    r.add_header("accept", "application/json")
    for k, v in (headers or {}).items():
        r.add_header(k, v)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def login(email):
    s, b = req(f"{SB}/auth/v1/token?grant_type=password", "POST",
               {"email": email, "password": PW}, {"apikey": KEY})
    assert s == 200, (email, s, b)
    return b["access_token"]


def auth(t):
    return {"authorization": f"Bearer {t}"}


results = []


def check(name, cond, extra=""):
    results.append(bool(cond))
    print(("PASS " if cond else "FAIL ") + name + (f"  {extra}" if extra else ""))


T = login("customer.a@acme-commerce.test")
V = "/api/v1/lab/broken-auth"
S = "/api/v1/lab/broken-auth/secure"

# --- metadata + reset ------------------------------------------------------
s, meta = req(f"{BASE}{V}", "POST", None, auth(T))
check("reset lab data", s == 200, s)
d = meta["data"]
check("metadata maps to API2:2023", d["owaspMapping"] == "API2:2023")
check("three synthetic accounts seeded", d["accountsSeeded"] == 3, d["accountsSeeded"])
check("weaknesses advertised", set(d["weaknesses"]) == {
    "user_enumeration", "no_brute_force_protection",
    "predictable_session_token", "brute_forceable_recovery_code"})
blob = json.dumps(meta).lower()
check("no real credentials or secrets in metadata",
      not any(k in blob for k in ("acmelab", "service_role", "access_token", "supabase")))

s, _ = req(f"{BASE}{V}", "GET")
check("anonymous metadata denied", s == 401, s)
for p in (f"{V}/login", f"{S}/login", f"{V}/recovery", f"{S}/recovery"):
    s, _ = req(f"{BASE}{p}", "POST", {"username": USER, "password": "x", "code": "0000"})
    check(f"anonymous {p} denied", s == 401, s)

# --- input validation ------------------------------------------------------
s, _ = req(f"{BASE}{V}/login", "POST", {"username": ""}, auth(T))
check("vulnerable login validates input", s == 400, s)
s, _ = req(f"{BASE}{S}/login", "POST", {"username": ""}, auth(T))
check("secure login validates input", s == 400, s)
s, _ = req(f"{BASE}{V}/recovery", "POST", {"username": USER, "code": "abcd"}, auth(T))
check("recovery rejects non-numeric codes", s == 400, s)

# --- user enumeration ------------------------------------------------------
s, vk = req(f"{BASE}{V}/login", "POST", {"username": USER, "password": "nope"}, auth(T))
s2, vu = req(f"{BASE}{V}/login", "POST", {"username": "ghost.user", "password": "nope"}, auth(T))
check("vulnerable login responds 200 for both", s == 200 and s2 == 200, (s, s2))
check("vulnerable reveals unknown username", vu["data"]["reason"] == "unknown_user", vu["data"]["reason"])
check("vulnerable messages differ", vk["data"]["message"] != vu["data"]["message"])
check("vulnerable flags enumeration", vk["data"]["userEnumerationPossible"] is True)

_, sk = req(f"{BASE}{S}/login", "POST", {"username": USER, "password": "nope"}, auth(T))
_, su = req(f"{BASE}{S}/login", "POST", {"username": "ghost.user", "password": "nope"}, auth(T))
check("secure uses one generic message", sk["data"]["message"] == su["data"]["message"], sk["data"]["message"])
check("secure uses one generic reason",
      sk["data"]["reason"] == su["data"]["reason"] == "invalid_credentials")
check("secure reports enumeration blocked", sk["data"]["userEnumerationPossible"] is False)

# --- brute force -----------------------------------------------------------
req(f"{BASE}{V}", "POST", None, auth(T))  # deterministic starting point

vuln_locked = False
for i in range(12):
    _, r = req(f"{BASE}{V}/login", "POST", {"username": USER, "password": f"guess{i}"}, auth(T))
    if r["data"]["reason"] == "account_locked":
        vuln_locked = True
check("vulnerable endpoint never locks out", vuln_locked is False)
check("vulnerable counts failures without enforcing", r["data"]["failedAttempts"] >= 12,
      r["data"]["failedAttempts"])

s, cracked = req(f"{BASE}{V}/login", "POST", {"username": USER, "password": REAL_PW}, auth(T))
check("vulnerable password brute force succeeds", cracked["data"]["authenticated"] is True)
tok1 = cracked["data"]["sessionToken"]
_, again = req(f"{BASE}{V}/login", "POST", {"username": USER, "password": REAL_PW}, auth(T))
tok2 = again["data"]["sessionToken"]
check("vulnerable token is sequential/predictable",
      tok1.startswith(f"lab-{USER}-") and int(tok2.split("-")[-1]) == int(tok1.split("-")[-1]) + 1,
      (tok1, tok2))

req(f"{BASE}{V}", "POST", None, auth(T))
locked_at = None
for i in range(8):
    _, r = req(f"{BASE}{S}/login", "POST", {"username": USER, "password": f"guess{i}"}, auth(T))
    if r["data"]["reason"] == "account_locked" and locked_at is None:
        locked_at = i + 1
check("secure endpoint locks out after 5 attempts", locked_at == 5, locked_at)
check("secure reports zero attempts remaining", r["data"]["attemptsRemaining"] == 0)
check("secure exposes a lockout deadline", bool(r["data"]["lockedUntil"]))

_, blocked = req(f"{BASE}{S}/login", "POST", {"username": USER, "password": REAL_PW}, auth(T))
check("secure rejects the right password while locked",
      blocked["data"]["authenticated"] is False and blocked["data"]["reason"] == "account_locked")

req(f"{BASE}{V}", "POST", None, auth(T))
_, ok = req(f"{BASE}{S}/login", "POST", {"username": USER, "password": REAL_PW}, auth(T))
check("secure authenticates valid credentials", ok["data"]["authenticated"] is True)
stok = ok["data"]["sessionToken"]
_, ok2 = req(f"{BASE}{S}/login", "POST", {"username": USER, "password": REAL_PW}, auth(T))
check("secure token is 256-bit random hex", len(stok) == 64 and stok != ok2["data"]["sessionToken"])
check("secure token strategy reported", ok["data"]["tokenStrategy"] == "csprng-256bit")
