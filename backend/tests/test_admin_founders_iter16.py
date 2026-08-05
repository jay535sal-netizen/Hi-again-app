"""Iteration 16 — Admin Founders dashboard + voice regressions.

Validates:
- GET /api/admin/founders/codes (admin only, 60+ codes, structure)
- Non-admin gets 403
- POST /api/voice/intent fast-path (profile navigate)
- GET /api/voice/query/todays_highlights structure
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://crossed-paths-3.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = "hiagainxyz@gmail.com"
ADMIN_PASSWORD = "HiAgain2024!"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def anon_session():
    return requests.Session()


# ---------- Admin Founders endpoints ----------

class TestAdminFounders:
    def test_admin_list_codes(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/founders/codes")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "codes" in data and isinstance(data["codes"], list)
        assert data.get("total", 0) >= 60, f"expected >=60 codes, got {data.get('total')}"
        # Structure of a code entry
        sample = data["codes"][0]
        for key in ["code", "redeemed", "share_url"]:
            assert key in sample, f"missing key {key} in {sample}"
        # Ensure FOUNDER01..FOUNDER60 exist
        code_names = {c["code"] for c in data["codes"]}
        for i in range(1, 61):
            assert f"FOUNDER{i:02d}" in code_names

    def test_admin_list_at_least_one_redeemed(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/founders/codes")
        data = r.json()
        redeemed = [c for c in data["codes"] if c["redeemed"]]
        # Per spec, FOUNDER01 should be redeemed by Jay Sal
        assert len(redeemed) >= 1, "expected at least one redeemed founder code"

    def test_non_admin_forbidden(self, anon_session):
        # No auth cookie → depends on get_current_user; expect 401
        r = anon_session.get(f"{BASE_URL}/api/admin/founders/codes")
        assert r.status_code in (401, 403), f"expected 401/403 for anon, got {r.status_code}"


# ---------- Voice regressions ----------

class TestVoiceRegression:
    def test_voice_intent_navigate_profile(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/voice/intent",
            json={"transcript": "go to my profile", "context_page": "/feed"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("intent") == "navigate"
        assert data.get("target") == "/profile"

    def test_voice_query_todays_highlights(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/voice/query/todays_highlights")
        assert r.status_code == 200, r.text
        data = r.json()
        for key in ["crossings", "messages", "views", "summary"]:
            assert key in data, f"missing key {key} in {data}"
