"""Phases 8-10 — API6 (business flows), API7 (SSRF), API8 (misconfiguration).

Run with the dev server on :8080 and backend env vars loaded:
    set -a && . ./.env && set +a && python3 tests/security-labs/api_8_9_10_test.py
"""
import json, os, urllib.request, urllib.error, sys

BASE = "http://localhost:8080/api/v1"
SB = os.environ["VITE_SUPABASE_URL"]
KEY = os.environ["VITE_SUPABASE_PUBLISHABLE_KEY"]
PW = "AcmeLab#2026"


def req(url, method="GET", body=None, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("content-type", "application/json")
    r.add_header("accept", "application/json")
    for k, v in (headers or {}).items():
        r.add_header(k, v)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read() or b"null"), dict(resp.headers)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null"), dict(e.headers)


def login(email):
    s, b, _ = req(f"{SB}/auth/v1/token?grant_type=password", "POST",
                  {"email": email, "password": PW}, {"apikey": KEY})
    assert s == 200, (email, s, b)
    return b["access_token"]


def auth(t, ua="Mozilla/5.0 (lab browser)"):
    return {"authorization": f"Bearer {t}", "user-agent": ua}


def payload(body):
    """Secure bizflow blocks return 403 with the result under error.details."""
    if isinstance(body, dict) and "data" in body:
        return body["data"]
    return (body or {}).get("error", {}).get("details", {})


results = []


def check(name, cond, extra=""):
    results.append(bool(cond))
    print(("PASS " if cond else "FAIL ") + name + (f"  {extra}" if extra else ""))


A = login("customer.a@acme-commerce.test")

# ---------------------------------------------------------------- Phase 8 ---
s, b, _ = req(f"{BASE}/lab/bizflow", "POST", None, auth(A))
check("bizflow reset ok", s == 200, s)
d = b["data"]
check("bizflow maps to API6:2023", d["owaspMapping"] == "API6:2023")
check("vulnerable stock restored", d["stock"]["vulnerable"] == 25, d["stock"])
check("secure stock restored", d["stock"]["secure"] == 25, d["stock"])
check("caller owns nothing after reset", d["ownedByCaller"]["vulnerable"] == 0)

s, b, _ = req(f"{BASE}/lab/bizflow/buy", "POST", {"quantity": 25}, auth(A))
check("vulnerable buy sweeps whole drop", s == 200 and b["data"]["granted"] == 25, b)
check("vulnerable applies no controls", b["data"]["antiAutomationApplied"] is False)
check("vulnerable drop sold out", b["data"]["remaining"] == 0)

s, b, _ = req(f"{BASE}/lab/bizflow/secure/buy", "POST", {"quantity": 25}, auth(A))
d = payload(b)
check("secure blocks oversized request", s == 403 and d["granted"] == 0, b)
check("secure rejects on per-request cap", d["rejectedBy"] == "per_request_cap", d)

s, b, _ = req(f"{BASE}/lab/bizflow/secure/buy", "POST", {"quantity": 2}, auth(A))
check("secure grants within cap", payload(b)["granted"] == 2, b)
s, b, _ = req(f"{BASE}/lab/bizflow/secure/buy", "POST", {"quantity": 2}, auth(A))
d = payload(b)
check("secure blocks second purchase", s == 403 and d["granted"] == 0, b)
check("secure rejection is cap or velocity",
      d["rejectedBy"] in ("per_user_cap", "velocity"), d["rejectedBy"])

s, b, _ = req(f"{BASE}/lab/bizflow/secure/buy", "POST", {"quantity": 1},
              auth(A, "python-urllib/3.11"))
check("secure blocks bot user agent", payload(b)["rejectedBy"] == "bot_signature", b)

s, _, _ = req(f"{BASE}/lab/bizflow/buy", "POST", {"quantity": 1})
check("bizflow requires auth", s == 401, s)
s, _, _ = req(f"{BASE}/lab/bizflow/buy", "POST", {"quantity": 0}, auth(A))
check("bizflow validates input", s == 400, s)

# ---------------------------------------------------------------- Phase 9 ---
s, b, _ = req(f"{BASE}/lab/ssrf", "GET", None, auth(A))
check("ssrf metadata ok", s == 200 and b["data"]["owaspMapping"] == "API7:2023", s)
check("ssrf advertises allowlist", len(b["data"]["allowedHosts"]) == 2)

meta_url = "http://169.254.169.254/latest/meta-data/iam/security-credentials/"
s, b, _ = req(f"{BASE}/lab/ssrf/import", "POST", {"url": meta_url}, auth(A))
check("vulnerable ssrf reaches metadata service", s == 200 and b["data"]["ok"], b)
check("vulnerable ssrf flags internal hit", b["data"]["reachedInternalService"] is True)
check("vulnerable ssrf returns synthetic creds",
      "SYNTHETIC" in json.dumps(b["data"]["response"]))

s, b, _ = req(f"{BASE}/lab/ssrf/secure/import", "POST", {"url": meta_url}, auth(A))
d = payload(b)
check("secure ssrf blocks metadata", s == 403 and d["ok"] is False, b)
check("secure ssrf block reason", d["blockedBy"] in ("scheme", "private_address"), d["blockedBy"])

s, b, _ = req(f"{BASE}/lab/ssrf/secure/import", "POST",
              {"url": "https://10.0.0.12/admin/users"}, auth(A))
check("secure ssrf blocks private range", payload(b)["blockedBy"] == "private_address", b)

s, b, _ = req(f"{BASE}/lab/ssrf/secure/import", "POST",
              {"url": "https://evil.example.com/x.png"}, auth(A))
check("secure ssrf enforces allowlist", payload(b)["blockedBy"] == "host_not_allowlisted", b)

s, b, _ = req(f"{BASE}/lab/ssrf/secure/import", "POST",
              {"url": "https://cdn.acme-supplies.test/drop/hero.jpg"}, auth(A))
check("secure ssrf allows supplier host", payload(b)["ok"] is True, b)
check("secure ssrf never reaches internal", payload(b)["reachedInternalService"] is False)

s, _, _ = req(f"{BASE}/lab/ssrf/import", "POST", {"url": meta_url})
check("ssrf requires auth", s == 401, s)

# --------------------------------------------------------------- Phase 10 ---
s, b, h = req(f"{BASE}/lab/misconfig/diagnostics", "POST", {"probe": "diagnostics"}, auth(A))
check("vulnerable diagnostics ok", s == 200 and b["data"]["mode"] == "vulnerable", s)
check("vulnerable leaks configuration", "SYNTHETIC" in json.dumps(b["data"]["payload"]))
check("vulnerable uses wildcard CORS", h.get("access-control-allow-origin") == "*", h.get("access-control-allow-origin"))
check("vulnerable allows credentials with wildcard",
      h.get("access-control-allow-credentials") == "true")
check("vulnerable discloses framework version", "acme-commerce" in (h.get("x-powered-by") or ""))
check("vulnerable omits nosniff header", h.get("x-content-type-options") is None)

s, b, h = req(f"{BASE}/lab/misconfig/diagnostics", "POST", {"probe": "error"}, auth(A))
check("vulnerable leaks stack trace", "at loadOrder" in b["data"]["payload"]["stack"])

s, b, h = req(f"{BASE}/lab/misconfig/secure/diagnostics", "POST", {"probe": "error"}, auth(A))
check("secure diagnostics ok", s == 200 and b["data"]["mode"] == "secure", s)
check("secure returns generic error", "stack" not in json.dumps(b["data"]["payload"]))
check("secure returns correlation id", b["data"]["payload"]["correlationId"].startswith("req_"))
check("secure sets nosniff", h.get("x-content-type-options") == "nosniff")
check("secure sets frame options", h.get("x-frame-options") == "DENY")
check("secure sets HSTS", "max-age=31536000" in (h.get("strict-transport-security") or ""))
check("secure sets CSP", "frame-ancestors 'none'" in (h.get("content-security-policy") or ""))
check("secure has no wildcard CORS", h.get("access-control-allow-origin") is None)

s, _, _ = req(f"{BASE}/lab/misconfig/diagnostics", "POST", {"probe": "diagnostics"})
check("misconfig requires auth", s == 401, s)
s, _, _ = req(f"{BASE}/lab/misconfig/diagnostics", "POST", {"probe": "nope"}, auth(A))
check("misconfig validates probe", s == 400, s)

# ------------------------------------------------- production regression ---
s, _, _ = req(f"{BASE}/products")
check("production catalogue still public", s == 200, s)
s, _, _ = req(f"{BASE}/orders")
check("production orders still require auth", s == 401, s)

print(f"\n{sum(results)}/{len(results)} checks passed")
sys.exit(0 if all(results) else 1)
