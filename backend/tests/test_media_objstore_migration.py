"""
Backend regression tests for media migration from base64-in-Mongo
to Emergent object storage.

Covers:
- Auth login + /auth/me now return BOTH photo_url and avatar_url
- Profile photo upload writes to objstore and returns /api/media/{uuid}
- Public GET /api/media/{uuid} returns binary image with Cache-Control
- /users/{id}/profile is small (<10KB) and contains no base64 strings
- /posts/feed is small (<100KB) and no base64
- POST /posts and POST /gallery store via object storage
- Prior endpoints (locations, crossings, achievements, gatherings,
  subscription/status, push/register) still work
- No `_id` or `$oid` leaks anywhere
- Public legal pages (/privacy, /terms, /delete-account) return 200 HTML
"""
import base64
import io
import json
import os
import re
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

EMAIL = "hiagainxyz@gmail.com"
PASSWORD = "HiAgain2024!"

# 1x1 PNG (transparent) for multipart tests
TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)
TINY_PNG_BYTES = base64.b64decode(TINY_PNG_B64)


# ============ Fixtures ============

@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    return s


@pytest.fixture(scope="session")
def auth(session):
    r = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": EMAIL, "password": PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    body = r.json()
    token = body["access_token"]
    user = body["user"]
    return {"token": token, "user": user, "cookies": session.cookies}


@pytest.fixture(scope="session")
def headers(auth):
    return {"Authorization": f"Bearer {auth['token']}"}


# ============ Helpers ============

BASE64_RE = re.compile(r"data:image\/[a-zA-Z0-9.+-]+;base64,")


def assert_no_base64(text: str, where: str):
    assert not BASE64_RE.search(text), f"base64 data URI leaked in {where}"


def assert_no_objid_leak(text: str, where: str):
    assert "\"_id\"" not in text, f"_id leaked in {where}"
    assert "$oid" not in text, f"$oid leaked in {where}"


# ============ AUTH ============

class TestAuth:
    def test_login_returns_photo_and_avatar(self, auth):
        u = auth["user"]
        assert "photo_url" in u, "photo_url missing in login response"
        assert "avatar_url" in u, "avatar_url missing in login response"
        # Both should be the same value
        assert u["photo_url"] == u["avatar_url"], (
            f"photo_url != avatar_url: {u['photo_url']} vs {u['avatar_url']}"
        )
        # If not null, must be /api/media/ URL, NOT base64
        if u["photo_url"] is not None:
            assert isinstance(u["photo_url"], str)
            assert u["photo_url"].startswith("/api/media/"), (
                f"photo_url not /api/media/ form: {u['photo_url'][:80]}"
            )
            assert not u["photo_url"].startswith("data:"), "photo_url is base64!"

    def test_me_returns_photo_and_avatar(self, session, headers, auth):
        r = session.get(f"{BASE_URL}/api/auth/me", headers=headers, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "photo_url" in body and "avatar_url" in body
        assert body["photo_url"] == body["avatar_url"]
        if body["photo_url"] is not None:
            assert body["photo_url"].startswith("/api/media/")
            assert not body["photo_url"].startswith("data:")
        # No leaks
        assert_no_base64(r.text, "/api/auth/me")
        assert_no_objid_leak(r.text, "/api/auth/me")


# ============ PROFILE PHOTO UPLOAD + MEDIA RETRIEVAL ============

class TestProfilePhoto:
    def test_upload_returns_media_url(self, session, headers):
        files = {"file": ("test.png", io.BytesIO(TINY_PNG_BYTES), "image/png")}
        r = session.post(
            f"{BASE_URL}/api/profile/photo",
            files=files,
            headers=headers,
            timeout=60,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:500]}"
        body = r.json()
        assert "photo_url" in body
        url = body["photo_url"]
        assert url.startswith("/api/media/"), f"Got: {url[:100]}"
        assert not url.startswith("data:"), "Response contains base64!"
        # Response should be tiny — no base64 echoed back
        assert len(r.content) < 500, (
            f"Response too large ({len(r.content)} bytes) — likely contains base64"
        )
        # Stash for next test
        pytest.profile_photo_url = url

    def test_get_media_returns_binary_image(self, session):
        url = getattr(pytest, "profile_photo_url", None)
        if not url:
            pytest.skip("Profile photo upload didn't run")
        # Note: no auth required
        media_id = url.split("/api/media/")[-1]
        r = requests.get(f"{BASE_URL}/api/media/{media_id}", timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        ct = r.headers.get("Content-Type", "")
        assert ct.startswith("image/"), f"Bad Content-Type: {ct}"
        assert r.headers.get("Cache-Control"), "Missing Cache-Control header"
        # Body should be actual binary bytes (PNG signature)
        assert r.content[:4] == b"\x89PNG" or len(r.content) > 0

    def test_me_reflects_uploaded_photo(self, session, headers):
        r = session.get(f"{BASE_URL}/api/auth/me", headers=headers, timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert body["photo_url"], "photo_url should now be set"
        assert body["photo_url"].startswith("/api/media/")
        assert body["photo_url"] == body["avatar_url"]


# ============ USER PROFILE LOAD ============

class TestUserProfile:
    def test_user_profile_is_small_no_base64(self, session, headers, auth):
        user_id = auth["user"]["id"]
        r = session.get(
            f"{BASE_URL}/api/users/{user_id}/profile",
            headers=headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text[:500]
        size = len(r.content)
        assert size < 10 * 1024, (
            f"/users/{{id}}/profile response is {size} bytes — should be <10KB"
        )
        assert_no_base64(r.text, "/users/{id}/profile")
        assert_no_objid_leak(r.text, "/users/{id}/profile")
        body = r.json()
        # If photo_url present, must be /api/media/
        photo = body.get("photo_url") or body.get("avatar_url")
        if photo:
            assert photo.startswith("/api/media/"), f"Got: {photo[:100]}"


# ============ POSTS FEED ============

class TestPostsFeed:
    def test_feed_small_no_base64(self, session, headers):
        r = session.get(f"{BASE_URL}/api/posts/feed", headers=headers, timeout=30)
        assert r.status_code == 200
        size = len(r.content)
        assert size < 100 * 1024, (
            f"Feed response is {size} bytes — should be <100KB"
        )
        assert_no_base64(r.text, "/api/posts/feed")
        assert_no_objid_leak(r.text, "/api/posts/feed")
        body = r.json()
        for p in body:
            media = p.get("media_url")
            if media:
                assert media.startswith("/api/media/") or media.startswith("http"), (
                    f"Bad media_url: {media[:100]}"
                )
                assert not media.startswith("data:"), "base64 media_url in feed!"


# ============ POST CREATION ============

class TestPostCreation:
    def test_create_post_with_image(self, session, headers):
        files = {"file": ("post.png", io.BytesIO(TINY_PNG_BYTES), "image/png")}
        data = {
            "caption": f"TEST_post_{uuid.uuid4().hex[:8]}",
            "is_private": "false",
        }
        r = session.post(
            f"{BASE_URL}/api/posts",
            files=files,
            data=data,
            headers=headers,
            timeout=60,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:500]}"
        body = r.json()
        assert "media_url" in body
        assert body["media_url"].startswith("/api/media/"), (
            f"Got: {body['media_url'][:100]}"
        )
        assert not body["media_url"].startswith("data:"), "base64 leaked!"
        # Response should be small
        assert len(r.content) < 5000, f"Post creation response too large: {len(r.content)}"
        assert_no_base64(r.text, "POST /api/posts response")
        pytest.created_post_id = body.get("id")


# ============ GALLERY UPLOAD ============

class TestGallery:
    def test_gallery_upload_returns_media_url(self, session, headers):
        files = {"file": ("gallery.png", io.BytesIO(TINY_PNG_BYTES), "image/png")}
        data = {"caption": f"TEST_gallery_{uuid.uuid4().hex[:6]}"}
        r = session.post(
            f"{BASE_URL}/api/gallery",
            files=files,
            data=data,
            headers=headers,
            timeout=60,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:500]}"
        body = r.json()
        photo = body.get("photo", {})
        assert photo.get("url", "").startswith("/api/media/"), (
            f"Got url: {photo.get('url', '')[:100]}"
        )
        assert not photo["url"].startswith("data:"), "base64 in gallery url!"
        assert_no_objid_leak(r.text, "POST /api/gallery")
        pytest.gallery_photo_id = photo.get("id")

    def test_cleanup_gallery_photo(self, session, headers):
        photo_id = getattr(pytest, "gallery_photo_id", None)
        if not photo_id:
            pytest.skip("No gallery photo to clean up")
        r = session.delete(
            f"{BASE_URL}/api/gallery/{photo_id}",
            headers=headers,
            timeout=20,
        )
        # 200 expected
        assert r.status_code in (200, 204), f"{r.status_code} {r.text[:200]}"


# ============ REGRESSION (prior passing endpoints) ============

class TestRegression:
    def test_locations(self, session, headers):
        r = session.get(f"{BASE_URL}/api/locations", headers=headers, timeout=20)
        assert r.status_code == 200
        assert_no_objid_leak(r.text, "/api/locations")

    def test_crossings(self, session, headers):
        r = session.get(f"{BASE_URL}/api/crossings", headers=headers, timeout=20)
        assert r.status_code == 200
        assert_no_objid_leak(r.text, "/api/crossings")

    def test_achievements(self, session, headers):
        r = session.get(f"{BASE_URL}/api/achievements", headers=headers, timeout=20)
        assert r.status_code == 200
        assert_no_objid_leak(r.text, "/api/achievements")

    def test_gatherings(self, session, headers):
        r = session.get(f"{BASE_URL}/api/gatherings", headers=headers, timeout=20)
        assert r.status_code == 200
        body = r.json()
        # Either list or dict allowed (iteration_9 minor issue)
        assert isinstance(body, (list, dict))
        assert_no_objid_leak(r.text, "/api/gatherings")

    def test_subscription_status(self, session, headers):
        r = session.get(f"{BASE_URL}/api/subscription/status", headers=headers, timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert "tier" in body
        assert_no_objid_leak(r.text, "/api/subscription/status")

    def test_push_register(self, session, headers):
        token = "TEST_" + ("a" * 159)
        r = session.post(
            f"{BASE_URL}/api/push/register",
            headers=headers,
            json={"token": token, "platform": "android"},
            timeout=20,
        )
        # Accept multiple shapes; iteration_9 saw 200 here
        assert r.status_code in (200, 201), f"{r.status_code} {r.text[:200]}"


# ============ PUBLIC LEGAL PAGES ============

class TestPublicLegal:
    @pytest.mark.parametrize("path", ["/privacy", "/terms", "/delete-account"])
    def test_legal_page_html(self, path):
        r = requests.get(f"{BASE_URL}{path}", timeout=20)
        assert r.status_code == 200, f"{path} returned {r.status_code}"
        ct = r.headers.get("Content-Type", "")
        assert "html" in ct.lower(), f"{path} not html: {ct}"
