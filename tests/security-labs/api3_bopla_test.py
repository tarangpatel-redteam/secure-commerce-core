"""Phase 5 — API3:2023 Broken Object Property Level Authorization lab tests.

Run with the dev server on :8080 and the backend env vars loaded:
    set -a && . ./.env && set +a && python3 tests/security-labs/api3_bopla_test.py
"""
import json, os, urllib.request, urllib.error, sys

BASE = "http://localhost:8080"
SB = os.environ["VITE_SUPABASE_URL"]
KEY = os.environ["VITE_SUPABASE_PUBLISHABLE_KEY"]
PW = "AcmeLab#2026"

PRIVILEGED = ["accountCreditCents", "isVip", "internalRiskScore", "internalNotes",
              "supportPin", "dateOfBirth"]


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


cust_a = login("customer.a@acme-commerce.test")
cust_b = login("customer.b@acme-commerce.test")

# --- metadata + reset ------------------------------------------------------
s, meta = req(f"{BASE}/api/v1/lab/bopla", "POST", None, auth(cust_a))
check("reset lab data", s == 200, s)
d = meta["data"]
check("metadata maps to API3:2023", d["owaspMapping"] == "API3:2023")
check("lab record present for Customer-A", d["hasLabRecord"] is True)
check("caller roles resolved server-side", d["caller"]["roles"] == ["customer"], d["caller"]["roles"])
check("writable allowlist advertised",
      set(d["clientWritableProperties"]) == {"displayName", "phone", "marketingOptIn"})
blob = json.dumps(meta).lower()
check("no secrets in metadata",
      not any(k in blob for k in ("password", "acmelab", "service_role", "secret", "access_token", "supportpin\":")))

s, _ = req(f"{BASE}/api/v1/lab/bopla", "GET")
check("anonymous metadata denied", s == 401, s)

# --- excessive data exposure ----------------------------------------------
s, vuln = req(f"{BASE}/api/v1/lab/bopla/profile", "GET", None, auth(cust_a))
check("vulnerable GET succeeds", s == 200, s)
vprof = vuln["data"]["profile"]
check("vulnerable GET leaks every privileged property",
      all(p in vprof for p in PRIVILEGED), [p for p in PRIVILEGED if p not in vprof])
check("vulnerable GET reports no filtering", vuln["data"]["propertyFilteringApplied"] is False)
check("leaked support PIN is the synthetic one", vprof["supportPin"] == "4821", vprof["supportPin"])

s, safe = req(f"{BASE}/api/v1/lab/bopla/secure/profile", "GET", None, auth(cust_a))
check("secure GET succeeds", s == 200, s)
sprof = safe["data"]["profile"]
check("secure GET leaks nothing privileged",
      not any(p in sprof for p in PRIVILEGED), [p for p in PRIVILEGED if p in sprof])
check("secure GET returns the allowlisted shape",
      set(sprof) == {"id", "userId", "displayName", "email", "phone", "marketingOptIn",
                     "loyaltyTier", "updatedAt"}, sorted(sprof))
check("secure GET reports filtering applied", safe["data"]["propertyFilteringApplied"] is True)

s, _ = req(f"{BASE}/api/v1/lab/bopla/profile", "GET")
check("anonymous vulnerable GET denied", s == 401, s)
s, _ = req(f"{BASE}/api/v1/lab/bopla/secure/profile", "GET")
check("anonymous secure GET denied", s == 401, s)

# --- mass assignment -------------------------------------------------------
ATTACK = {"displayName": "Ada Attacker", "loyaltyTier": "platinum",
          "accountCreditCents": 500000, "isVip": True, "internalRiskScore": 0}

s, vres = req(f"{BASE}/api/v1/lab/bopla/secure/profile", "PATCH", ATTACK, auth(cust_a))
check("secure PATCH succeeds", s == 200, s)
sd = vres["data"]
check("secure PATCH applies only writable properties", sd["appliedProperties"] == ["displayName"], sd["appliedProperties"])
check("secure PATCH rejects privileged properties",
      set(sd["rejectedProperties"]) == {"loyaltyTier", "accountCreditCents", "isVip", "internalRiskScore"},
      sd["rejectedProperties"])
check("secure PATCH reports no escalation", sd["propertyEscalation"] is False)
check("secure PATCH response stays allowlisted", not any(p in sd["profile"] for p in PRIVILEGED))

# confirm nothing privileged actually changed after the secure attempt
s, after = req(f"{BASE}/api/v1/lab/bopla/profile", "GET", None, auth(cust_a))
ap = after["data"]["profile"]
check("secure PATCH left store credit unchanged", ap["accountCreditCents"] == 0, ap["accountCreditCents"])
check("secure PATCH left VIP flag unchanged", ap["isVip"] is False)
check("secure PATCH left tier unchanged", ap["loyaltyTier"] == "standard", ap["loyaltyTier"])
check("secure PATCH did apply the display name", ap["displayName"] == "Ada Attacker", ap["displayName"])

s, mres = req(f"{BASE}/api/v1/lab/bopla/profile", "PATCH", ATTACK, auth(cust_a))
check("vulnerable PATCH succeeds", s == 200, s)
md = mres["data"]
check("vulnerable PATCH writes privileged properties", md["propertyEscalation"] is True)
check("vulnerable PATCH reports the escalated keys",
      set(md["privilegedPropertiesWritten"]) == {"loyaltyTier", "accountCreditCents", "isVip", "internalRiskScore"},
      md["privilegedPropertiesWritten"])
check("vulnerable PATCH granted store credit", md["profile"]["accountCreditCents"] == 500000)
check("vulnerable PATCH granted VIP", md["profile"]["isVip"] is True)
check("vulnerable PATCH raised the tier", md["profile"]["loyaltyTier"] == "platinum")

s, _ = req(f"{BASE}/api/v1/lab/bopla/profile", "PATCH", ATTACK)
check("anonymous vulnerable PATCH denied", s == 401, s)
s, _ = req(f"{BASE}/api/v1/lab/bopla/secure/profile", "PATCH", ATTACK)
check("anonymous secure PATCH denied", s == 401, s)
s, _ = req(f"{BASE}/api/v1/lab/bopla/profile", "PATCH", ["not", "an", "object"], auth(cust_a))
check("non-object body rejected", s == 400, s)

# --- object-level isolation still holds ------------------------------------
s, b_prof = req(f"{BASE}/api/v1/lab/bopla/profile", "GET", None, auth(cust_b))
check("Customer-B sees only their own lab record",
      b_prof["data"]["profile"]["email"] == "customer.b@acme-commerce.test",
      b_prof["data"]["profile"]["email"])
check("Customer-B record untouched by Customer-A's attack",
      b_prof["data"]["profile"]["accountCreditCents"] == 2500,
      b_prof["data"]["profile"]["accountCreditCents"])

# --- production endpoints remain property-safe ------------------------------
s, me = req(f"{BASE}/api/v1/me", "GET", None, auth(cust_a))
check("production /me responds", s == 200, s)
me_blob = json.dumps(me)
check("production /me exposes no lab-internal properties",
      not any(k in me_blob for k in ("supportPin", "internalRiskScore", "internalNotes")))

s, _ = req(f"{BASE}/api/v1/lab/bopla", "POST", None, auth(cust_a))
check("re-run reset restores deterministic state", s == 200, s)
s, restored = req(f"{BASE}/api/v1/lab/bopla/profile", "GET", None, auth(cust_a))
rp = restored["data"]["profile"]
check("reset restored credit/vip/tier",
      rp["accountCreditCents"] == 0 and rp["isVip"] is False and rp["loyaltyTier"] == "standard")
check("reset restored display name", rp["displayName"] == "Ada Customer", rp["displayName"])

print(f"\n{sum(results)}/{len(results)} checks passed")
sys.exit(0 if all(results) else 1)
