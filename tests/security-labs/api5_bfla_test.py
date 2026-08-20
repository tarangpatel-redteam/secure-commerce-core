"""Phase 4 — API5:2023 Broken Function Level Authorization lab tests.

Run with the dev server on :8080 and the backend env vars loaded:
    set -a && . ./.env && set +a && python3 tests/security-labs/api5_bfla_test.py
"""
import json, os, urllib.request, urllib.error, sys

BASE = "http://localhost:8080"
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
    results.append(cond)
    print(("PASS " if cond else "FAIL ") + name + (f"  {extra}" if extra else ""))


cust = login("customer.a@acme-commerce.test")
emp = login("employee.a@acme-commerce.test")
mgr = login("manager.a@acme-commerce.test")

# --- metadata + reset ------------------------------------------------------
s, meta = req(f"{BASE}/api/v1/lab/bfla", "POST", None, auth(cust))
check("reset lab data", s == 200, s)
order = meta["data"]["labOrder"]
oid = order["id"]
check("lab order rebuilt as paid", order["orderNumber"] == "LAB-BFLA-A1" and order["status"] == "paid", order["status"])
check("metadata maps to API5:2023", meta["data"]["owaspMapping"] == "API5:2023")
check("caller roles resolved server-side", meta["data"]["caller"]["roles"] == ["customer"], meta["data"]["caller"]["roles"])
blob = json.dumps(meta).lower()
check("no secrets in metadata", not any(k in blob for k in ("password", "acmelab", "service_role", "secret", "access_token")))

s, _ = req(f"{BASE}/api/v1/lab/bfla", "GET")
check("anonymous metadata denied", s == 401, s)

# --- vulnerable endpoint ---------------------------------------------------
s, b = req(f"{BASE}/api/v1/lab/bfla/orders/{oid}/status", "POST", {"status": "shipped"}, auth(cust))
check("customer invokes staff-only function (intentional lab result)", s == 200 and b["data"]["order"]["status"] == "shipped", s)
check("vulnerable response flags escalation", b["data"]["privilegeEscalation"] is True and b["data"]["roleCheckPerformed"] is False)

s, b = req(f"{BASE}/api/v1/lab/bfla/orders/{oid}/status", "POST", {"status": "processing"}, auth(emp))
check("staff may use vulnerable endpoint", s == 200 and b["data"]["order"]["status"] == "processing", s)

s, _ = req(f"{BASE}/api/v1/lab/bfla/orders/{oid}/status", "POST", {"status": "shipped"})
check("anonymous vulnerable call denied", s == 401, s)

s, _ = req(f"{BASE}/api/v1/lab/bfla/orders/not-a-uuid/status", "POST", {"status": "shipped"}, auth(cust))
check("malformed id rejected", s == 400, s)

s, _ = req(f"{BASE}/api/v1/lab/bfla/orders/{oid}/status", "POST", {"status": "refunded"}, auth(cust))
check("invalid status rejected", s == 400, s)

s, _ = req(f"{BASE}/api/v1/lab/bfla/orders/00000000-0000-4000-8000-000000000000/status", "POST", {"status": "shipped"}, auth(emp))
check("unknown order id -> 404", s == 404, s)

# --- secure endpoint -------------------------------------------------------
_, meta_r = req(f"{BASE}/api/v1/lab/bfla", "POST", None, auth(cust))
oid = meta_r["data"]["labOrder"]["id"]

s, b = req(f"{BASE}/api/v1/lab/bfla/secure/orders/{oid}/status", "POST", {"status": "shipped"}, auth(cust))
check("secure endpoint denies customer", s == 403, s)

s, meta2 = req(f"{BASE}/api/v1/lab/bfla", "GET", None, auth(cust))
check("denied call caused no state change", meta2["data"]["labOrder"]["status"] == "paid", meta2["data"]["labOrder"]["status"])

s, b = req(f"{BASE}/api/v1/lab/bfla/secure/orders/{oid}/status", "POST", {"status": "shipped"}, auth(emp))
check("secure endpoint allows employee", s == 200 and b["data"]["order"]["status"] == "shipped", s)

s, b = req(f"{BASE}/api/v1/lab/bfla/secure/orders/{oid}/status", "POST", {"status": "delivered"}, auth(mgr))
check("secure endpoint allows manager", s == 200 and b["data"]["order"]["status"] == "delivered", s)

s, _ = req(f"{BASE}/api/v1/lab/bfla/secure/orders/{oid}/status", "POST", {"status": "shipped"})
check("anonymous secure call denied", s == 401, s)

# --- production regression -------------------------------------------------
s, b = req(f"{BASE}/api/v1/orders", "GET", None, auth(cust))
orders = b["data"]["orders"] if isinstance(b["data"], dict) else b["data"]
check("customer order list still works", s == 200 and isinstance(orders, list), s)
own = [o for o in orders if o["orderNumber"] == "LAB-BFLA-A1"]
check("customer sees only own orders", len(own) == 1, len(orders))

try:
    s, _ = req(f"{BASE}/api/v1/orders/{oid}/status", "POST", {"status": "shipped"}, auth(cust))
except Exception:
    s = 404  # SPA fallback returns HTML, not a JSON API response
check("no production status endpoint exists", s != 200, s)

s, _ = req(f"{BASE}/api/v1/orders/{oid}/cancel", "POST", None, auth(cust))
check("production cancel rejects delivered order", s >= 400, s)

s, b = req(f"{BASE}/api/v1/products?limit=3", "GET")
prods = b["data"]["items"] if isinstance(b["data"], dict) else b["data"]
check("catalog still public", s == 200 and len(prods) == 3, s)

s, _ = req(f"{BASE}/api/v1/cart", "GET", None, auth(cust))
check("cart still works", s == 200, s)

s, _ = req(f"{BASE}/api/v1/addresses", "GET", None, auth(cust))
check("addresses still work", s == 200, s)

s, b = req(f"{BASE}/api/v1/lab/bola", "GET", None, auth(cust))
check("phase 3 BOLA lab intact", s == 200 and b["data"]["owaspMapping"] == "API1:2023", s)

# restore deterministic state
req(f"{BASE}/api/v1/lab/bfla", "POST", None, auth(cust))

passed = sum(1 for r in results if r)
print(f"\n{passed}/{len(results)} checks passed")
sys.exit(0 if passed == len(results) else 1)
