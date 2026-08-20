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
