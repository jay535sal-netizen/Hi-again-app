"""Voice Assistant endpoint tests: /api/voice/intent + /api/voice/query/{name}."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://crossed-paths-3.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "hiagainxyz@gmail.com"
ADMIN_PASSWORD = "HiAgain2024!"


@pytest.fixture(scope="module")
def auth_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    # save native token as bearer fallback too
    tok = r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def user_first_name(auth_session):
    r = auth_session.get(f"{BASE_URL}/api/auth/me", timeout=15)
    assert r.status_code == 200
    name = r.json().get("name") or "there"
    return name.split()[0]


# ---------- Fast-path intent tests ----------
FAST_PATH_CASES = [
    ("go to my profile", "navigate", "/profile"),
    ("show me my missed crossings", "navigate", "/crossings"),
    ("what are todays highlights", "query", "todays_highlights"),
    ("show me reels", "query", "my_reels"),
    ("take me to gatherings", "navigate", "/gatherings"),
    ("log me out", "action", "logout"),
    ("turn on ghost mode", "action", "ghost_on"),
]

@pytest.mark.parametrize("transcript,intent,target", FAST_PATH_CASES)
def test_voice_intent_fastpath(auth_session, transcript, intent, target):
    r = auth_session.post(f"{BASE_URL}/api/voice/intent", json={"transcript": transcript}, timeout=15)
    assert r.status_code == 200, f"{transcript} -> {r.status_code} {r.text}"
    body = r.json()
    assert body["intent"] == intent, f"intent mismatch for '{transcript}': {body}"
    assert body["target"] == target, f"target mismatch for '{transcript}': {body}"
    assert isinstance(body["reply"], str) and len(body["reply"]) > 0


def test_voice_intent_smalltalk_uses_first_name(auth_session, user_first_name):
    r = auth_session.post(f"{BASE_URL}/api/voice/intent", json={"transcript": "hey there"}, timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["intent"] == "smalltalk"
    assert user_first_name.lower() in body["reply"].lower(), f"reply missing first name: {body['reply']}"


def test_voice_intent_llm_fallback(auth_session):
    """Phrasing not in the fast-path regex hits Claude Sonnet 5 fallback."""
    transcript = "can you check if anyone crossed my path near dolores park recently"
    r = auth_session.post(f"{BASE_URL}/api/voice/intent", json={"transcript": transcript}, timeout=60)
    assert r.status_code == 200, f"fallback failed: {r.status_code} {r.text}"
    body = r.json()
    assert body["intent"] in {"navigate", "query", "action", "smalltalk", "unknown"}
    assert isinstance(body["reply"], str)
    assert 0 < len(body["reply"]) <= 400


def test_voice_intent_empty_transcript(auth_session):
    r = auth_session.post(f"{BASE_URL}/api/voice/intent", json={"transcript": ""}, timeout=15)
    assert r.status_code == 400


def test_voice_intent_requires_auth():
    r = requests.post(f"{BASE_URL}/api/voice/intent", json={"transcript": "hi"}, timeout=15)
    assert r.status_code == 401, f"expected 401 unauth, got {r.status_code}"


# ---------- Voice query data tests ----------
def test_voice_query_todays_highlights(auth_session):
    r = auth_session.get(f"{BASE_URL}/api/voice/query/todays_highlights", timeout=15)
    assert r.status_code == 200
    body = r.json()
    for k in ("crossings", "messages", "views", "summary"):
        assert k in body, f"missing {k}: {body}"
    # grammar check
    s = body["summary"]
    if body["crossings"] == 1:
        assert "1 new crossing," in s
    else:
        assert f"{body['crossings']} new crossings" in s


def test_voice_query_recent_crossings(auth_session):
    r = auth_session.get(f"{BASE_URL}/api/voice/query/recent_crossings", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert "count" in body and "items" in body and "summary" in body


def test_voice_query_my_founder_number(auth_session):
    r = auth_session.get(f"{BASE_URL}/api/voice/query/my_founder_number", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert "is_founder" in body
    if not body["is_founder"]:
        assert "not a founder" in body["summary"].lower()


def test_voice_query_founder_count(auth_session):
    r = auth_session.get(f"{BASE_URL}/api/voice/query/founder_count", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert "claimed" in body and "remaining" in body and "summary" in body
    assert body["claimed"] + body["remaining"] >= 60 or body["remaining"] == max(0, 60 - body["claimed"])


def test_voice_query_my_stats(auth_session):
    r = auth_session.get(f"{BASE_URL}/api/voice/query/my_stats", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert "crossings" in body and "posts" in body


def test_voice_query_nonexistent(auth_session):
    r = auth_session.get(f"{BASE_URL}/api/voice/query/nonexistent_query", timeout=15)
    assert r.status_code == 404
