"""Iteration 14 — Founder badges + Discover teasers backend tests."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://crossed-paths-3.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "hiagainxyz@gmail.com")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "HiAgain2024!")


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return s


# ---- Crossings: new founder fields + sort order ----
def test_crossings_has_founder_fields(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/crossings")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    if not data:
        pytest.skip("No crossings for admin")
    for c in data:
        assert "other_is_founder" in c, f"missing other_is_founder in {c}"
        assert isinstance(c["other_is_founder"], bool)
        assert "other_founder_number" in c
        # other_founder_number may be None
        if c["other_is_founder"]:
            # allowed to be None if not yet numbered, but usually int
            assert c["other_founder_number"] is None or isinstance(c["other_founder_number"], int)


# ---- Discover: new founder fields ----
def test_discover_has_founder_fields(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/discover")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    for cand in data:
        assert "is_founder" in cand
        assert isinstance(cand["is_founder"], bool)
        assert "founder_number" in cand


# ---- Teasers: auth required ----
def test_teasers_requires_auth():
    r = requests.get(f"{BASE_URL}/api/discover/teasers")
    assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"


def test_teasers_authed_returns_list(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/discover/teasers")
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    assert len(data) <= 5
    ids = [t["id"] for t in data]
    assert len(ids) == len(set(ids)), "duplicate teaser ids"
    for t in data:
        assert "id" in t and t["id"]
        assert "other_count" in t and t["other_count"] >= 1
        assert "hint" in t and isinstance(t["hint"], str) and t["hint"]
        # hint should include city when both event and city exist
        if t.get("event_or_place") and t.get("city"):
            assert t["city"] in t["hint"], f"city missing from hint: {t}"


# ---- Backward-compat serialization ----
def test_crossings_default_other_is_founder_false(admin_session):
    """Any crossing without explicit founder metadata must serialize as false, not crash."""
    r = admin_session.get(f"{BASE_URL}/api/crossings")
    assert r.status_code == 200
    for c in r.json():
        # bool type enforced by pydantic; passing here means no crash on legacy rows
        assert c["other_is_founder"] in (True, False)


# ---- Founder sort: founders bubble above premium non-founders ----
def test_crossings_founders_sort_above(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/crossings")
    data = r.json()
    if not data:
        pytest.skip("no crossings")
    founder_idx = [i for i, c in enumerate(data) if c["other_is_founder"]]
    non_founder_idx = [i for i, c in enumerate(data) if not c["other_is_founder"]]
    if founder_idx and non_founder_idx:
        assert max(founder_idx) < min(non_founder_idx), \
            "founders should be sorted above non-founders"
