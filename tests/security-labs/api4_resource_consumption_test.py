"""Phase 7 — API4:2023 Unrestricted Resource Consumption lab tests.

Run with the dev server on :8080 and the backend env vars loaded:
    set -a && . ./.env && set +a && python3 tests/security-labs/api4_resource_consumption_test.py
"""
import json, os, urllib.request, urllib.error, sys

BASE = "http://localhost:8080"
SB = os.environ["VITE_SUPABASE_URL"]
KEY = os.environ["VITE_SUPABASE_PUBLISHABLE_KEY"]
PW = "AcmeLab#2026"
LAB = f"{BASE}/api/v1/lab/resource-consumption"


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


def auth(t):
    return {"authorization": f"Bearer {t}"}


results = []


def check(name, cond, extra=""):
    results.append(bool(cond))
    print(("PASS " if cond else "FAIL ") + name + (f"  {extra}" if extra else ""))


cust_a = login("customer.a@acme-commerce.test")
cust_b = login("customer.b@acme-commerce.test")

# --- metadata + reset ------------------------------------------------------
s, meta, _ = req(LAB, "POST", None, auth(cust_a))
check("reset lab data", s == 200, s)
d = meta["data"]
check("metadata maps to API4:2023", d["owaspMapping"] == "API4:2023")
check("dataset is deterministic size 500", d["datasetSize"] == 500, d["datasetSize"])
check("controls advertised", d["controls"]["maxPageSize"] == 50)
check("usage cleared after reset", d["usage"]["vulnerable"]["requestCount"] == 0)
check("secure usage cleared after reset", d["usage"]["secure"]["requestCount"] == 0)
check("caller resolved server-side", d["caller"]["roles"] == ["customer"], d["caller"]["roles"])

s, b, _ = req(LAB, "GET", None, auth(cust_a))
check("metadata readable", s == 200, s)

# --- anonymous access denied ----------------------------------------------
for path, method in [("", "GET"), ("", "POST"), ("/export", "POST"),
                     ("/secure/export", "POST"), ("/notify", "POST"),
                     ("/secure/notify", "POST")]:
    s, b, _ = req(LAB + path, method, {} if method == "POST" else None)
    check(f"anonymous denied {method} {path or '/'}", s == 401, s)

# --- vulnerable export: unbounded page size + compute ----------------------
s, vuln, _ = req(f"{LAB}/export", "POST", {"limit": 100000, "workFactor": 500}, auth(cust_a))
v = vuln["data"]
check("vulnerable export accepted", s == 200, s)
check("vulnerable applies no rate limit", v["rateLimitApplied"] is False)
check("vulnerable has no page-size ceiling", v["pageSizeCeiling"] is None)
check("vulnerable honours oversized limit verbatim", v["effectiveLimit"] == 100000, v["effectiveLimit"])
check("vulnerable returns the entire dataset", v["rowsReturned"] == 500, v["rowsReturned"])
check("vulnerable work factor unclamped", v["effectiveWorkFactor"] == 500)
check("vulnerable compute unbounded", v["computeUnits"] == 100000 * 500, v["computeUnits"])
check("vulnerable applied no controls", v["controlsApplied"] == [])

# --- secure export: clamped ------------------------------------------------
s, safe, _ = req(f"{LAB}/secure/export", "POST", {"limit": 100000, "workFactor": 500}, auth(cust_a))
sd = safe["data"]
check("secure export accepted", s == 200, s)
check("secure clamps page size", sd["effectiveLimit"] == 50, sd["effectiveLimit"])
check("secure returns at most the ceiling", sd["rowsReturned"] == 50, sd["rowsReturned"])
check("secure clamps work factor", sd["effectiveWorkFactor"] == 3, sd["effectiveWorkFactor"])
check("secure echoes the requested limit", sd["requestedLimit"] == 100000)
check("secure reports rate limiting on", sd["rateLimitApplied"] is True)
check("secure advertises applied controls", len(sd["controlsApplied"]) == 4, sd["controlsApplied"])
check("secure compute bounded", sd["computeUnits"] == 150, sd["computeUnits"])

# --- burst: vulnerable never throttles, secure does ------------------------
vuln_statuses = []
for _ in range(15):
    st, _b, _h = req(f"{LAB}/export", "POST", {"limit": 500, "workFactor": 10}, auth(cust_b))
    vuln_statuses.append(st)
check("vulnerable accepts a 15-request burst", all(x == 200 for x in vuln_statuses),
      sorted(set(vuln_statuses)))

secure_statuses = []
retry_after = None
for _ in range(15):
    st, body, headers = req(f"{LAB}/secure/export", "POST", {"limit": 500, "workFactor": 10}, auth(cust_b))
    secure_statuses.append(st)
    if st == 429 and retry_after is None:
        retry_after = headers.get("retry-after") or headers.get("Retry-After")
        throttled_body = body
accepted = sum(1 for x in secure_statuses if x == 200)
throttled = sum(1 for x in secure_statuses if x == 429)
check("secure throttles the burst", throttled > 0, secure_statuses)
check("secure accepts exactly the window allowance", accepted == 10, accepted)
check("secure returns 429 for the rest", accepted + throttled == 15)
check("secure sends Retry-After", retry_after is not None and int(retry_after) > 0, retry_after)
check("429 body carries the error code", throttled_body["error"]["code"] == "rate_limited")
check("429 body reports usage", "usage" in throttled_body["error"]["details"])

# --- costly operation ------------------------------------------------------
s, meta, _ = req(LAB, "POST", None, auth(cust_a))
check("re-run reset succeeds", s == 200, s)

s, vn, _ = req(f"{LAB}/notify", "POST", {"count": 250}, auth(cust_a))
vd = vn["data"]
check("vulnerable notify accepted", s == 200, s)
check("vulnerable sends every requested notification", vd["sentCount"] == 250, vd["sentCount"])
check("vulnerable spends unbounded budget", vd["costCents"] == 1000, vd["costCents"])
check("vulnerable notify has no spend cap", vd["spendCapApplied"] is False)

s, sn, _ = req(f"{LAB}/secure/notify", "POST", {"count": 250}, auth(cust_a))
snd = sn["data"]
check("secure notify accepted", s == 200, s)
check("secure caps notifications per request", snd["sentCount"] == 3, snd["sentCount"])
check("secure spend within cap", snd["costCents"] == 12, snd["costCents"])
check("secure notify advertises controls", len(snd["controlsApplied"]) == 3)

s2, sn2, h2 = req(f"{LAB}/secure/notify", "POST", {"count": 250}, auth(cust_a))
check("secure notify honours the window remainder", s2 == 200 and sn2["data"]["sentCount"] == 2,
      (s2, sn2.get("data", {}).get("sentCount")))
s3, sn3, h3 = req(f"{LAB}/secure/notify", "POST", {"count": 250}, auth(cust_a))
check("secure notify then throttles", s3 == 429, s3)
check("secure notify sends Retry-After", (h3.get("retry-after") or h3.get("Retry-After")) is not None)

# --- usage accounting ------------------------------------------------------
s, meta, _ = req(LAB, "GET", None, auth(cust_a))
u = meta["data"]["usage"]
check("vulnerable usage recorded", u["vulnerable"]["notificationsSent"] == 250,
      u["vulnerable"]["notificationsSent"])
check("secure usage capped at the window maximum", u["secure"]["notificationsSent"] == 5,
      u["secure"]["notificationsSent"])
check("secure spend stayed under the cap",
      u["secure"]["budgetSpentCents"] <= meta["data"]["controls"]["maxBudgetCentsPerWindow"],
      u["secure"]["budgetSpentCents"])

# --- input validation ------------------------------------------------------
s, b, _ = req(f"{LAB}/export", "POST", {"limit": "all"}, auth(cust_a))
check("non-numeric limit rejected", s == 400, s)
s, b, _ = req(f"{LAB}/secure/export", "POST", {"limit": -5}, auth(cust_a))
check("negative limit rejected", s == 400, s)
s, b, _ = req(f"{LAB}/notify", "POST", {"count": 0}, auth(cust_a))
check("zero notification count rejected", s == 400, s)

# --- reset restores determinism --------------------------------------------
s, meta, _ = req(LAB, "POST", None, auth(cust_a))
check("final reset succeeds", s == 200, s)
check("reset clears vulnerable counters", meta["data"]["usage"]["vulnerable"]["requestCount"] == 0)
check("reset clears secure counters", meta["data"]["usage"]["secure"]["notificationsSent"] == 0)
s, ex, _ = req(f"{LAB}/export", "POST", {"limit": 3, "workFactor": 1}, auth(cust_a))
rows = ex["data"]["rows"]
check("dataset deterministic after reset",
      rows[0]["reference"] == "ACME-INV-00001" and rows[2]["reference"] == "ACME-INV-00003",
      [r["reference"] for r in rows])

# --- production endpoints unaffected ---------------------------------------
s, b, _ = req(f"{BASE}/api/v1/products?limit=100000", "GET")
check("production catalog still public", s == 200, s)
check("production catalog clamps page size", len(b["data"]["products"]) <= 100,
      len(b["data"]["products"]))
s, b, _ = req(f"{BASE}/api/v1/me", "GET")
check("production /me still requires a session", s == 401, s)
s, b, _ = req(f"{BASE}/api/v1/orders", "GET", None, auth(cust_a))
check("production orders endpoint still works", s == 200, s)
s, b, _ = req(f"{BASE}/api/v1/cart", "GET", None, auth(cust_a))
check("production cart endpoint still works", s == 200, s)
s, b, _ = req(f"{BASE}/api/v1/lab/bola", "GET", None, auth(cust_a))
check("phase 3 BOLA lab intact", s == 200, s)
s, b, _ = req(f"{BASE}/api/v1/lab/bopla", "GET", None, auth(cust_a))
check("phase 5 BOPLA lab intact", s == 200, s)

print()
print(f"{sum(results)}/{len(results)} checks passed")
sys.exit(0 if all(results) else 1)
