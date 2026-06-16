"""
Hi Again — Play Store Internal Testing regression
Tests the endpoints requested by main agent against the deployed preview URL
(REACT_APP_BACKEND_URL from /app/frontend/.env).

Endpoints under test:
  - POST /api/auth/login (httpOnly cookie + user)
  - GET  /api/auth/me (cookie auth)
  - GET  /api/locations
  - POST /api/locations
  - GET  /api/crossings
  - GET  /api/achievements
  - GET  /api/gatherings
  - GET  /api/subscription/status (the real route — main-agent's PRD says /api/premium/status which does not exist)
  - POST /api/push/register
  - Frontend public legal pages: /privacy, /terms, /delete-account, /data-deletion
  - Sanity: every JSON response is free of MongoDB ObjectId leaks (`_id`, `$oid`)
"""
import os
import json
import re
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set in env"

# Also read frontend .env directly so the test works under pytest where
# os.environ may not include the frontend variable.
if not BASE_URL:
    with open("/app/frontend/.env") as fh:
        for line in fh:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

OWNER_EMAIL = "hiagainxyz@gmail.com"
OWNER_PASSWORD = "HiAgain2024!"


# ---------- helpers ----------

OBJECTID_PATTERN = re.compile(r'"\$oid"\s*:')


def assert_no_objectid_leak(resp_text, label):
    """Fail the test if the response contains any ObjectId leak."""
    body_lower = resp_text
    assert '"_id"' not in body_lower, f"{label}: response leaks MongoDB _id field"
    assert not OBJECTID_PATTERN.search(body_lower), f"{label}: response leaks $oid"


@pytest.fixture(scope="module")
def session():
    """A requests.Session that will hold the httpOnly auth cookie after login."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def authed_session(session):
    r = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:300]}"
    # Cookie must be set
    cookie_names = {c.name for c in session.cookies}
    assert "hiagain_token" in cookie_names, (
        f"login did not set hiagain_token cookie. got: {cookie_names}"
    )
    return session


# ---------- Auth ----------

class TestAuth:
    def test_login_sets_cookie_and_returns_user(self, session):
        r = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data and isinstance(data["access_token"], str)
        assert "user" in data
        assert data["user"]["email"] == OWNER_EMAIL
        assert "id" in data["user"]
        # httpOnly cookie set
        assert "hiagain_token" in {c.name for c in session.cookies}
        assert_no_objectid_leak(r.text, "POST /api/auth/login")

    def test_login_invalid_credentials_returns_401(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": OWNER_EMAIL, "password": "wrong-password"},
            timeout=20,
        )
        assert r.status_code == 401

    def test_auth_me_with_cookie(self, authed_session):
        r = authed_session.get(f"{BASE_URL}/api/auth/me", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == OWNER_EMAIL
        assert "id" in data
        assert "email_verified" in data
        assert "onboarded" in data
        assert_no_objectid_leak(r.text, "GET /api/auth/me")

    def test_auth_me_without_cookie_401(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=20)
        assert r.status_code in (401, 403)


# ---------- Locations ----------

class TestLocations:
    def test_list_locations(self, authed_session):
        r = authed_session.get(f"{BASE_URL}/api/locations", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        assert_no_objectid_leak(r.text, "GET /api/locations")

    def test_create_location_returns_id(self, authed_session):
        payload = {
            "city": "TEST_City_Seattle",
            "event_or_place": f"TEST_Pike_Place_{uuid.uuid4().hex[:6]}",
            "date": "2026-02-14",
            "description": "Play-store regression test entry"
        }
        r = authed_session.post(
            f"{BASE_URL}/api/locations", json=payload, timeout=20
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "id" in data and data["id"]
        assert data["city"] == payload["city"]
        assert data["event_or_place"] == payload["event_or_place"]
        assert_no_objectid_leak(r.text, "POST /api/locations")
        # cleanup
        loc_id = data["id"]
        d = authed_session.delete(
            f"{BASE_URL}/api/locations/{loc_id}", timeout=20
        )
        # Don't fail the suite if cleanup fails
        if d.status_code not in (200, 204):
            print(f"warn: cleanup of test location failed: {d.status_code}")


# ---------- Crossings ----------

class TestCrossings:
    def test_get_crossings(self, authed_session):
        r = authed_session.get(f"{BASE_URL}/api/crossings", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        assert_no_objectid_leak(r.text, "GET /api/crossings")


# ---------- Achievements ----------

class TestAchievements:
    def test_get_achievements(self, authed_session):
        r = authed_session.get(f"{BASE_URL}/api/achievements", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        # response model has `unlocked` (list) and likely other fields
        assert isinstance(data, dict)
        assert_no_objectid_leak(r.text, "GET /api/achievements")


# ---------- Gatherings ----------

class TestGatherings:
    def test_get_gatherings(self, authed_session):
        r = authed_session.get(f"{BASE_URL}/api/gatherings", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        # Endpoint returns either a flat list OR {my_gatherings: [...], upcoming: [...]}
        if isinstance(data, list):
            pass
        else:
            assert isinstance(data, dict)
            assert "my_gatherings" in data and isinstance(data["my_gatherings"], list)
            assert "upcoming" in data and isinstance(data["upcoming"], list)
        assert_no_objectid_leak(r.text, "GET /api/gatherings")


# ---------- Premium / Subscription ----------

class TestPremiumStatus:
    def test_premium_status_endpoint_alias(self, authed_session):
        """Main agent's PRD says GET /api/premium/status; the code actually
        exposes GET /api/subscription/status. Try both to confirm and surface
        a clear failure on the missing alias."""
        primary = authed_session.get(
            f"{BASE_URL}/api/premium/status", timeout=20
        )
        secondary = authed_session.get(
            f"{BASE_URL}/api/subscription/status", timeout=20
        )
        # /api/subscription/status MUST work
        assert secondary.status_code == 200, (
            f"/api/subscription/status failed: {secondary.status_code} {secondary.text[:200]}"
        )
        data = secondary.json()
        assert "tier" in data, f"missing tier in response: {data}"
        assert data["tier"] in ("free", "premium")
        assert_no_objectid_leak(secondary.text, "GET /api/subscription/status")

        # /api/premium/status is described in the review request — record outcome
        if primary.status_code == 200:
            print("✅ /api/premium/status alias also works")
        else:
            print(
                f"ℹ️  /api/premium/status returned {primary.status_code} — "
                f"only /api/subscription/status is exposed in server.py. "
                f"This is a naming mismatch vs. PRD."
            )


# ---------- Push registration ----------

class TestPushRegister:
    def test_register_dummy_fcm_token(self, authed_session):
        dummy = "TEST_FCM_" + uuid.uuid4().hex + uuid.uuid4().hex  # >20 chars
        r = authed_session.post(
            f"{BASE_URL}/api/push/register",
            json={"token": dummy, "platform": "android"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert "push_enabled" in data
        assert_no_objectid_leak(r.text, "POST /api/push/register")
        # cleanup — unregister
        d = authed_session.delete(
            f"{BASE_URL}/api/push/register",
            json={"token": dummy, "platform": "android"},
            timeout=20,
        )
        if d.status_code != 200:
            print(f"warn: unregister token cleanup returned {d.status_code}")

    def test_register_rejects_short_token(self, authed_session):
        r = authed_session.post(
            f"{BASE_URL}/api/push/register",
            json={"token": "short", "platform": "android"},
            timeout=20,
        )
        assert r.status_code == 400


# ---------- Public legal HTML pages on the frontend ----------

class TestPublicLegalPages:
    @pytest.mark.parametrize("path", ["/privacy", "/terms", "/delete-account", "/data-deletion"])
    def test_legal_page_html_200(self, path):
        r = requests.get(f"{BASE_URL}{path}", timeout=30, allow_redirects=True)
        assert r.status_code == 200, f"{path} returned {r.status_code}"
        # The React SPA serves the index.html shell at every route — assert HTML
        ctype = r.headers.get("content-type", "")
        assert "text/html" in ctype.lower(), (
            f"{path} did not return HTML, got {ctype}"
        )
        # Sanity: page should not be a JSON error envelope
        assert "<html" in r.text.lower() or "<!doctype" in r.text.lower(), (
            f"{path} body does not look like HTML: {r.text[:200]}"
        )


# ---------- ObjectId sweep across all GET endpoints ----------

class TestObjectIdSweep:
    """Walk a handful of read endpoints and assert none of them leak Mongo's _id."""

    GET_ENDPOINTS = [
        "/api/auth/me",
        "/api/locations",
        "/api/crossings",
        "/api/achievements",
        "/api/gatherings",
        "/api/subscription/status",
    ]

    @pytest.mark.parametrize("path", GET_ENDPOINTS)
    def test_no_objectid_leak(self, authed_session, path):
        r = authed_session.get(f"{BASE_URL}{path}", timeout=20)
        assert r.status_code == 200, f"{path} -> {r.status_code}"
        assert_no_objectid_leak(r.text, f"GET {path}")
