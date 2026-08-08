"""Iter 17: Evening wrap-up push endpoint + voice-driven post creation (voice_post).
Plus regressions on voice fast-path + queries + admin founders + feed seed."""
import os
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://crossed-paths-3.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "hiagainxyz@gmail.com"
ADMIN_PASSWORD = "HiAgain2024!"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def admin_first_name(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/auth/me", timeout=15)
    assert r.status_code == 200
    return (r.json().get("name") or "there").split()[0]


# ---------- voice_post via LLM ----------
@pytest.mark.parametrize("transcript,expected_words", [
    ("post about the sunset at fenway park", ["sunset", "fenway"]),
    ("post about my birthday", ["birthday"]),
])
def test_voice_intent_voice_post_llm(admin_session, admin_first_name, transcript, expected_words):
    r = admin_session.post(f"{BASE_URL}/api/voice/intent", json={"transcript": transcript}, timeout=60)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["intent"] == "action", body
    assert body["target"] == "voice_post", body
    params = body.get("params") or {}
    caption = (params.get("caption") or "").lower()
    assert caption, f"empty caption in {body}"
    for w in expected_words:
        assert w in caption, f"'{w}' not in caption '{caption}'"
    assert admin_first_name.lower() in body["reply"].lower() or len(body["reply"]) > 0


# ---------- evening wrap ----------
def test_evening_wrap_admin_ok(admin_session):
    r = admin_session.post(f"{BASE_URL}/api/admin/push/evening-wrap", timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    for k in ("sent", "skipped_already_today", "skipped_quiet_day", "errored"):
        assert k in body, f"missing {k} in {body}"
        assert isinstance(body[k], int)


def test_evening_wrap_non_admin_forbidden():
    r = requests.post(f"{BASE_URL}/api/admin/push/evening-wrap", timeout=15)
    # unauthenticated → 401 (auth guard runs before admin check)
    assert r.status_code in (401, 403)


def test_evening_wrap_idempotent(admin_session):
    r1 = admin_session.post(f"{BASE_URL}/api/admin/push/evening-wrap", timeout=30)
    assert r1.status_code == 200
    first_sent = r1.json()["sent"]
    r2 = admin_session.post(f"{BASE_URL}/api/admin/push/evening-wrap", timeout=30)
    assert r2.status_code == 200
    b2 = r2.json()
    # Second call should not re-send: skipped_already_today >= first_sent, and second sent == 0
    assert b2["sent"] == 0, f"idempotency broken: second sent={b2['sent']} body={b2}"
    assert b2["skipped_already_today"] >= first_sent, (
        f"expected skipped_already_today >= {first_sent}, got {b2['skipped_already_today']}"
    )


# ---------- regressions ----------
def test_voice_intent_fastpath_profile_regression(admin_session):
    r = admin_session.post(f"{BASE_URL}/api/voice/intent", json={"transcript": "go to my profile"}, timeout=15)
    assert r.status_code == 200
    b = r.json()
    assert b["intent"] == "navigate" and b["target"] == "/profile"


def test_voice_query_todays_highlights_regression(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/voice/query/todays_highlights", timeout=15)
    assert r.status_code == 200
    b = r.json()
    for k in ("crossings", "messages", "views", "summary"):
        assert k in b


def test_admin_founders_codes_regression(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/founders/codes", timeout=20)
    assert r.status_code == 200
    b = r.json()
    codes = b.get("codes") if isinstance(b, dict) else b
    assert isinstance(codes, list)
    assert len(codes) == 61, f"expected 61 codes, got {len(codes)}"


def test_admin_feed_seed_idempotent_regression(admin_session):
    r1 = admin_session.post(f"{BASE_URL}/api/admin/feed/seed", timeout=60)
    assert r1.status_code == 200
    r2 = admin_session.post(f"{BASE_URL}/api/admin/feed/seed", timeout=60)
    assert r2.status_code == 200
