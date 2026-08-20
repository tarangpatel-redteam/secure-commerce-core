import json, os, urllib.request, sys

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
    assert s == 200, (s, b)
    return b["access_token"]

def auth(t): return {"authorization": f"Bearer {t}"}

results = []
def check(name, cond, extra=""):
    results.append((name, cond, extra))
    print(("PASS " if cond else "FAIL ") + name + ("  " + str(extra) if extra else ""))

a = login("customer.a@acme-commerce.test")
b = login("customer.b@acme-commerce.test")

s, meta = req(f"{BASE}/api/v1/lab/bola", "POST", None, auth(a))
check("reset lab data", s == 200, s)
users = {u["label"]: u for u in meta["data"]["users"]}
oa, ob = users["Customer-A"]["orderId"], users["Customer-B"]["orderId"]

s, m = req(f"{BASE}/api/v1/lab/bola", headers=auth(a))
check("metadata 200", s == 200)
check("metadata has no secrets",
      not any(k in json.dumps(m).lower() for k in ["password", "access_token", "service_role", "secret"]))

s, r = req(f"{BASE}/api/v1/lab/bola/orders/{oa}/access", "POST", None, auth(a))
check("A -> own order via vulnerable = 200", s == 200 and r["data"]["crossAccountAccess"] is False, s)

s, r = req(f"{BASE}/api/v1/lab/bola/secure/orders/{oa}/access", "POST", None, auth(a))
check("A -> own order via secure = 200", s == 200 and r["data"]["ownershipCheckPerformed"], s)

s, r = req(f"{BASE}/api/v1/lab/bola/orders/{ob}/access", "POST", None, auth(a))
check("A -> B order via VULNERABLE succeeds (intentional)",
      s == 200 and r["data"]["crossAccountAccess"] is True and r["data"]["order"]["orderNumber"] == "LAB-BOLA-B1", s)

s, r = req(f"{BASE}/api/v1/lab/bola/secure/orders/{ob}/access", "POST", None, auth(a))
check("A -> B order via SECURE denied", s == 403 and "data" not in r, (s, r))

s, r = req(f"{BASE}/api/v1/orders/{ob}", headers=auth(a))
check("A -> B order via production /orders/:id denied", s == 404, (s, r))

s, r = req(f"{BASE}/api/v1/orders/{oa}", headers=auth(a))
check("A -> own order via production /orders/:id ok", s == 200, s)

s, r = req(f"{BASE}/api/v1/lab/bola/orders/{ob}/access", "POST")
check("anonymous vulnerable = 401", s == 401, s)
s, r = req(f"{BASE}/api/v1/lab/bola/secure/orders/{ob}/access", "POST")
check("anonymous secure = 401", s == 401, s)
s, r = req(f"{BASE}/api/v1/lab/bola", "GET")
check("anonymous metadata = 401", s == 401, s)

s, r = req(f"{BASE}/api/v1/lab/bola/orders/not-a-uuid/access", "POST", None, auth(a))
check("malformed id = 400", s == 400, s)
s, r = req(f"{BASE}/api/v1/lab/bola/secure/orders/not-a-uuid/access", "POST", None, auth(a))
check("malformed id secure = 400", s == 400, s)

s, r = req(f"{BASE}/api/v1/lab/bola/orders/00000000-0000-4000-8000-000000000000/access", "POST", None, auth(a))
check("unknown uuid = 404", s == 404, s)

# regression: existing functionality
s, r = req(f"{BASE}/api/v1/products?perPage=3")
check("products endpoint ok", s == 200 and len(r["data"]["items"]) == 3, s)
s, r = req(f"{BASE}/api/v1/cart", headers=auth(b))
check("cart endpoint ok", s == 200, s)
s, r = req(f"{BASE}/api/v1/me", headers=auth(a))
check("me endpoint ok", s == 200, s)
s, r = req(f"{BASE}/api/v1/orders", headers=auth(b))
check("B sees only own orders",
      s == 200 and all(o["orderNumber"] != "LAB-BOLA-A1" for o in r["data"]), s)
s, r = req(f"{BASE}/api/v1/addresses", headers=auth(a))
check("addresses endpoint ok", s == 200, s)

# regression: full checkout still works for Customer-B
s, r = req(f"{BASE}/api/v1/products?perPage=1")
pid = r["data"]["items"][0]["id"]
s, r = req(f"{BASE}/api/v1/cart", "POST", {"productId": pid, "quantity": 1}, auth(b))
check("add to cart", s in (200, 201), s)
s, r = req(f"{BASE}/api/v1/addresses", headers=auth(b))
if r["data"]:
    addr = r["data"][0]["id"]
else:
    s, r = req(f"{BASE}/api/v1/addresses", "POST", {"label":"Home","recipientName":"Ben Customer","line1":"44 Sandpiper Court","city":"Austin","state":"TX","postalCode":"78701","country":"US","isDefault":True}, auth(b))
    check("create address", s in (200,201), s)
    addr = r["data"]["id"]
s, r = req(f"{BASE}/api/v1/orders", "POST", {"addressId": addr, "paymentMethod": "test_success"}, auth(b))
check("checkout test_success creates paid order", s in (200,201) and r["data"]["paymentStatus"] == "succeeded", (s, r))
s, r = req(f"{BASE}/api/v1/cart", headers=auth(b))
check("cart cleared after checkout", s == 200 and len(r["data"]["items"]) == 0, s)

failed = [n for n, c, _ in results if not c]
print("\n%d/%d passed" % (len(results) - len(failed), len(results)))
sys.exit(1 if failed else 0)
