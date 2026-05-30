"""
Tests for new Discover (People You Might Know) and Profile Gallery features.

Covers:
- GET /api/discover (ranked candidates with reasons)
- GET /api/gallery/{user_id} (own + privacy locked)
- POST /api/gallery (multipart upload, moderation pass)
- DELETE /api/gallery/{photo_id}
- PATCH /api/gallery/privacy (valid + invalid)
- Regression: /api/auth/me, /api/locations, /api/crossings,
  /api/posts/feed, /api/gatherings
"""
import io
import os
import struct
import zlib
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "hiagainxyz@gmail.com")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "HiAgain2024!")
DEMO_PASSWORD = os.environ.get("DEMO_USER_PASSWORD", "HiAgainDemo2026!")


# ---------------- helpers ----------------
def _login(email: str, password: str) -> requests.Session:
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    body = r.json()
    # Token + cookie should both be set; bearer header is the most reliable across
    # forwarded host scenarios.
    s.headers.update({"Authorization": f"Bearer {body['access_token']}"})
    return s, body["user"]


def _make_png(width: int = 16, height: int = 16) -> bytes:
    """Return a tiny valid PNG (solid blue) without depending on Pillow."""
    sig = b"\x89PNG\r\n\x1a\n"

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)  # 8-bit RGB
    raw = b""
    for _ in range(height):
        raw += b"\x00" + (b"\x33\x66\x99" * width)  # filter byte + pixels
    idat = zlib.compress(raw)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


# ---------------- fixtures ----------------
@pytest.fixture(scope="module")
def admin():
    sess, user = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    return sess, user


@pytest.fixture(scope="module")
def luna():
    # Luna is one of the 12 demo users
    sess, user = _login("luna.demo@hiagain.xyz", DEMO_PASSWORD)
    return sess, user


# ============================================================
# DISCOVER
# ============================================================
class TestDiscover:
    def test_discover_returns_ranked_candidates(self, admin):
        sess, _ = admin
        r = sess.get(f"{BASE_URL}/api/discover")
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1, "Expected at least one Discover candidate for admin"

        # Required fields per candidate
        first = data[0]
        for key in ("user_id", "name", "score", "reasons"):
            assert key in first, f"Missing field {key}: {first}"
        assert isinstance(first["reasons"], list)
        assert isinstance(first["score"], int)

        # Sorted descending by score
        scores = [c["score"] for c in data]
        assert scores == sorted(scores, reverse=True), f"Scores not desc-sorted: {scores}"

        # Expected 3 demo candidates per problem statement (Maya, Luna, Noor)
        names = {c["name"] for c in data}
        expected = {"Maya Chen", "Luna Vasquez", "Noor Hassan"}
        # Allow superset; flag missing
        missing = expected - names
        assert not missing, f"Expected demo candidates missing from /discover: {missing}. Got: {names}"

    def test_discover_excludes_self(self, admin):
        sess, user = admin
        r = sess.get(f"{BASE_URL}/api/discover")
        assert r.status_code == 200
        ids = {c["user_id"] for c in r.json()}
        assert user["id"] not in ids, "Discover must not return the current user"

    def test_discover_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/discover")
        assert r.status_code in (401, 403)


# ============================================================
# GALLERY
# ============================================================
class TestGallery:
    def test_get_own_gallery_unlocked(self, admin):
        sess, user = admin
        r = sess.get(f"{BASE_URL}/api/gallery/{user['id']}")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("locked") is False
        assert "photos" in body and isinstance(body["photos"], list)
        assert "privacy" in body

    def test_upload_then_get_then_delete(self, admin):
        sess, user = admin
        png = _make_png()
        files = {"file": ("test.png", io.BytesIO(png), "image/png")}
        data = {"caption": "TEST_gallery_upload"}
        up = sess.post(f"{BASE_URL}/api/gallery", files=files, data=data)
        assert up.status_code == 200, f"Upload failed: {up.status_code} {up.text}"
        body = up.json()
        assert "photo" in body and body["photo"].get("id")
        photo_id = body["photo"]["id"]
        assert body["photo"]["url"].startswith("data:image/"), "Expected base64 data URL"

        # GET should now contain it
        g = sess.get(f"{BASE_URL}/api/gallery/{user['id']}")
        assert g.status_code == 200
        ids = [p["id"] for p in g.json()["photos"]]
        assert photo_id in ids, "Just-uploaded photo not visible via GET gallery"

        # DELETE
        d = sess.delete(f"{BASE_URL}/api/gallery/{photo_id}")
        assert d.status_code == 200, d.text

        g2 = sess.get(f"{BASE_URL}/api/gallery/{user['id']}")
        ids2 = [p["id"] for p in g2.json()["photos"]]
        assert photo_id not in ids2, "Photo still present after delete"

    def test_patch_privacy_invalid(self, admin):
        sess, _ = admin
        r = sess.patch(f"{BASE_URL}/api/gallery/privacy", json={"privacy": "foo"})
        assert r.status_code == 400, f"Expected 400 for invalid privacy, got {r.status_code}: {r.text}"

    def test_privacy_lock_when_not_connected(self, admin, luna):
        """Set Luna's gallery to 'connections', then admin (not connected) sees locked=true."""
        luna_sess, luna_user = luna
        admin_sess, _ = admin

        # Set Luna's privacy to connections
        try:
            r = luna_sess.patch(
                f"{BASE_URL}/api/gallery/privacy", json={"privacy": "connections"}
            )
            assert r.status_code == 200, f"Privacy update failed: {r.text}"
            assert r.json().get("privacy") == "connections"

            # Admin views Luna's gallery
            g = admin_sess.get(f"{BASE_URL}/api/gallery/{luna_user['id']}")
            assert g.status_code == 200
            body = g.json()
            assert body.get("locked") is True, f"Expected locked=true, got {body}"
            assert body.get("photos") == []
        finally:
            # Restore to public
            luna_sess.patch(
                f"{BASE_URL}/api/gallery/privacy", json={"privacy": "public"}
            )

    def test_patch_privacy_valid_values(self, admin):
        sess, _ = admin
        for val in ("public", "crossings", "connections", "private"):
            r = sess.patch(f"{BASE_URL}/api/gallery/privacy", json={"privacy": val})
            assert r.status_code == 200, f"{val} update failed: {r.text}"
            assert r.json().get("privacy") == val
        # restore default
        sess.patch(f"{BASE_URL}/api/gallery/privacy", json={"privacy": "public"})


# ============================================================
# REGRESSION
# ============================================================
class TestRegression:
    def test_auth_me(self, admin):
        sess, _ = admin
        r = sess.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_locations(self, admin):
        sess, _ = admin
        r = sess.get(f"{BASE_URL}/api/locations")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_crossings(self, admin):
        sess, _ = admin
        r = sess.get(f"{BASE_URL}/api/crossings")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_feed(self, admin):
        sess, _ = admin
        r = sess.get(f"{BASE_URL}/api/posts/feed")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_gatherings(self, admin):
        sess, _ = admin
        r = sess.get(f"{BASE_URL}/api/gatherings")
        # Endpoint may be /api/gatherings or /api/gatherings/upcoming - try main
        assert r.status_code in (200,), f"/api/gatherings failed: {r.status_code} {r.text}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
