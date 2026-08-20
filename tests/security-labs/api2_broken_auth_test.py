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
