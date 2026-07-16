"""
Test the missed-connection feed seed + explore feed image bug fix.
Covers:
- /api/posts/explore returns seed storyteller posts (Maya, Jordan, ...)
- Each seed media_url returns real image bytes (> 5000 bytes)
- Uploaded post appears in feed with retrievable media
- POST /api/admin/feed/seed idempotent + admin-only
- POST /api/admin/feed/cleanup_broken admin
- /api/posts/public-teaser (no auth)
- Ghost seed users hidden from /api/discover and /api/users/search
"""
import io
import os
import time
import uuid
import requests
import pytest
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://crossed-paths-3.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "hiagainxyz@gmail.com")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "HiAgain2024!")

SEED_NAMES = {"Maya", "Jordan", "Ana", "Marcus", "Sana", "Devon", "Riley",
              "Emmy", "Zoe", "Alex", "Priya", "Kai", "Nadia", "Sam", "Layla"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:200]}"
    tok = r.json().get("access_token")
    assert tok, "No access_token"
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def _make_jpg(size_px=400):
    img = Image.new("RGB", (size_px, size_px), color=(120, 60, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80)
    buf.seek(0)
    return buf.getvalue()


# ---- Explore feed ---------------------------------------------------------

def test_explore_returns_seed_storyteller_posts(admin_headers):
    r = requests.get(f"{BASE_URL}/api/posts/explore", headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text[:400]
    posts = r.json()
    assert isinstance(posts, list), f"expected list got {type(posts)}"
    assert len(posts) >= 15, f"expected >=15 posts, got {len(posts)}"

    # Collect user_names from all posts
    names_seen = set()
    seed_posts = []
    for p in posts:
        name = (p.get("user_name") or "").split()[0] if p.get("user_name") else ""
        if name in SEED_NAMES:
            names_seen.add(name)
            seed_posts.append(p)
    assert len(names_seen) >= 15, f"expected 15 seed names, got {len(names_seen)}: {names_seen}"

    # Each seed post has non-empty media_url starting with /api/media/ and non-empty caption
    for p in seed_posts:
        mu = p.get("media_url") or ""
        assert mu.startswith("/api/media/") or mu.startswith("http"), f"bad media_url {mu} on {p.get('user_name')}"
        assert p.get("caption"), f"empty caption on seed post {p.get('id')} by {p.get('user_name')}"


def test_seed_media_returns_real_image_bytes(admin_headers):
    r = requests.get(f"{BASE_URL}/api/posts/explore", headers=admin_headers, timeout=30)
    posts = r.json()
    seed_posts = [p for p in posts if (p.get("user_name") or "").split()[0] in SEED_NAMES][:5]
    assert seed_posts, "no seed posts found to fetch media"
    for p in seed_posts:
        mu = p["media_url"]
        url = mu if mu.startswith("http") else f"{BASE_URL}{mu}"
        rr = requests.get(url, timeout=30)
        assert rr.status_code == 200, f"media fetch failed for {url}: {rr.status_code}"
        assert len(rr.content) > 5000, f"media too small ({len(rr.content)} bytes) at {url} — 1×1 placeholder?"


# ---- Upload + feed integration -------------------------------------------

def test_upload_post_appears_in_feed(admin_headers):
    caption = f"TEST_feed_upload_{uuid.uuid4().hex[:8]}"
    files = {"file": ("test.jpg", _make_jpg(), "image/jpeg")}
    data = {"caption": caption, "location": "TestVille"}
    r = requests.post(f"{BASE_URL}/api/posts", headers=admin_headers, files=files, data=data, timeout=60)
    assert r.status_code in (200, 201), f"post create failed {r.status_code} {r.text[:400]}"
    body = r.json()
    mu = body.get("media_url") or ""
    assert mu, "no media_url in created post"
    post_id = body.get("id")

    # Poll explore for the new post
    found = None
    for _ in range(5):
        rr = requests.get(f"{BASE_URL}/api/posts/explore", headers=admin_headers, timeout=30)
        for p in rr.json():
            if p.get("id") == post_id or p.get("caption") == caption:
                found = p
                break
        if found:
            break
        time.sleep(1)
    assert found, f"uploaded post {post_id} not visible in explore feed"

    # Media fetch
    url = mu if mu.startswith("http") else f"{BASE_URL}{mu}"
    rr = requests.get(url, timeout=30)
    assert rr.status_code == 200
    assert len(rr.content) > 1000, f"uploaded media too small: {len(rr.content)}"


# ---- Admin seed endpoints ------------------------------------------------

def test_admin_seed_feed_idempotent(admin_headers):
    r1 = requests.post(f"{BASE_URL}/api/admin/feed/seed", headers=admin_headers, timeout=120)
    assert r1.status_code == 200, f"seed 1st call: {r1.status_code} {r1.text[:400]}"
    b1 = r1.json()
    assert isinstance(b1, dict)

    r2 = requests.post(f"{BASE_URL}/api/admin/feed/seed", headers=admin_headers, timeout=120)
    assert r2.status_code == 200, f"seed 2nd call: {r2.status_code} {r2.text[:400]}"
    b2 = r2.json()
    # idempotency: any of these fields indicates a skip counter
    skipped = (
        b2.get("skipped_already_complete")
        or b2.get("skipped")
        or b2.get("already_seeded")
        or 0
    )
    # Also acceptable: created_users == 0 on second call
    created_users = b2.get("created_users") or b2.get("users_created") or 0
    assert (isinstance(skipped, int) and skipped >= 15) or created_users == 0, \
        f"seed not idempotent: {b2}"


def test_admin_seed_feed_forbidden_for_non_admin():
    # Create a temporary non-admin user
    email = f"test_nonadmin_{uuid.uuid4().hex[:8]}@example.com"
    password = f"TestPass_{uuid.uuid4().hex[:12]}!"
    reg = requests.post(f"{BASE_URL}/api/auth/register",
                        json={"email": email, "password": password, "name": "NonAdmin Test"},
                        timeout=30)
    if reg.status_code not in (200, 201):
        pytest.skip(f"cannot register test user: {reg.status_code} {reg.text[:200]}")
    tok = reg.json().get("access_token")
    if not tok:
        # try login
        lg = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
        tok = lg.json().get("access_token") if lg.status_code == 200 else None
    if not tok:
        pytest.skip("no non-admin token acquired")

    r = requests.post(f"{BASE_URL}/api/admin/feed/seed",
                      headers={"Authorization": f"Bearer {tok}"}, timeout=30)
    assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text[:200]}"


def test_admin_cleanup_broken(admin_headers):
    r = requests.post(f"{BASE_URL}/api/admin/feed/cleanup_broken", headers=admin_headers, timeout=60)
    assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
    assert isinstance(r.json(), dict)


# ---- Public teaser (no auth) ---------------------------------------------

def test_public_teaser_no_auth():
    r = requests.get(f"{BASE_URL}/api/posts/public-teaser", timeout=30)
    assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
    body = r.json()
    posts = body if isinstance(body, list) else body.get("posts") or body.get("items") or []
    assert len(posts) >= 3, f"expected >=3 teaser posts, got {len(posts)}"
    for p in posts[:3]:
        assert p.get("media_url"), f"missing media_url in {p}"
        assert p.get("caption"), f"missing caption in {p}"


# ---- Ghost seed users hidden from discover/search ------------------------

def test_ghost_seed_users_hidden_from_discover_and_search(admin_headers):
    r = requests.get(f"{BASE_URL}/api/discover", headers=admin_headers, timeout=30)
    if r.status_code == 200:
        body = r.json()
        users = body if isinstance(body, list) else body.get("users") or body.get("results") or []
        names = {(u.get("name") or "").split()[0] for u in users}
        # None of the seed storyteller names should appear
        leaked = names & SEED_NAMES
        assert not leaked, f"ghost seed users leaked into /api/discover: {leaked}"

    # Search for each seed name — should not surface ghost seed accounts
    for name in ["Maya", "Jordan", "Ana"]:
        rr = requests.get(f"{BASE_URL}/api/users/search",
                          headers=admin_headers, params={"q": name}, timeout=30)
        if rr.status_code != 200:
            continue
        body = rr.json()
        users = body if isinstance(body, list) else body.get("users") or body.get("results") or []
        for u in users:
            # if it's a seed ghost, it should not be here — flag it
            assert not u.get("is_seed"), f"seed ghost user surfaced in /api/users/search?q={name}: {u.get('name')}"
