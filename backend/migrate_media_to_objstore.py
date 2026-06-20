#!/usr/bin/env python3
"""Migrate existing base64 data URIs in MongoDB → Emergent object storage.

Scans:
  • users.photo_url
  • gallery_photos.url
  • posts.media_url

For each base64 data URI it finds, uploads the binary to object storage,
registers it in `media_files`, and replaces the field with `/api/media/{id}`.

Idempotent: rows that already have a non-`data:` URL are skipped.

Run from /app/backend:
    python3 migrate_media_to_objstore.py            # dry-run, prints counts
    python3 migrate_media_to_objstore.py --apply    # actually upload + update
"""
import argparse
import asyncio
import base64
import os
import sys
import uuid
import re
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv

load_dotenv()

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = "hiagain"
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

MIME_EXT = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
}

DATA_URI_RE = re.compile(r"^data:([^;]+);base64,(.+)$", re.DOTALL)

_storage_key = None


def get_storage_key():
    global _storage_key
    if _storage_key:
        return _storage_key
    if not EMERGENT_LLM_KEY:
        raise RuntimeError("EMERGENT_LLM_KEY missing from env")
    r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
    r.raise_for_status()
    _storage_key = r.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = get_storage_key()
    r = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=180,
    )
    r.raise_for_status()
    return r.json()


def parse_data_uri(s: str):
    """Returns (content_type, raw_bytes) for a 'data:...;base64,...' string, else None."""
    if not isinstance(s, str) or not s.startswith("data:"):
        return None
    m = DATA_URI_RE.match(s)
    if not m:
        return None
    content_type = m.group(1).strip().lower()
    b64 = m.group(2).strip()
    try:
        raw = base64.b64decode(b64, validate=False)
    except Exception:
        return None
    return content_type, raw


async def upload_and_register(db, user_id: str, content: bytes, content_type: str, kind: str) -> str:
    """Mirrors server.store_media_blob() so the migrated URL works with /api/media/{id}."""
    ext = MIME_EXT.get(content_type, "bin")
    file_id = str(uuid.uuid4())
    path = f"{APP_NAME}/{kind}/{user_id}/{file_id}.{ext}"
    result = put_object(path, content, content_type)
    record = {
        "id": file_id,
        "user_id": user_id,
        "storage_path": result["path"],
        "original_filename": None,
        "content_type": content_type,
        "size": result.get("size", len(content)),
        "media_type": kind,
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "migrated_from_base64": True,
    }
    await db.media_files.insert_one(record)
    return f"/api/media/{file_id}"


async def migrate_users(db, apply: bool):
    cursor = db.users.find(
        {"photo_url": {"$regex": "^data:"}},
        {"_id": 0, "id": 1, "photo_url": 1, "email": 1},
    )
    count = 0
    converted = 0
    total_bytes = 0
    async for u in cursor:
        count += 1
        parsed = parse_data_uri(u["photo_url"])
        if not parsed:
            print(f"  ⚠️ user {u.get('email')}: unparseable data URI, skip")
            continue
        content_type, raw = parsed
        total_bytes += len(raw)
        print(f"  → user {u.get('email')}: {len(raw):,} bytes ({content_type})")
        if apply:
            url = await upload_and_register(db, u["id"], raw, content_type, "profile")
            await db.users.update_one({"id": u["id"]}, {"$set": {"photo_url": url}})
            converted += 1
    print(f"users.photo_url candidates: {count}, converted: {converted}, total bytes: {total_bytes:,}")
    return count, converted, total_bytes


async def migrate_gallery(db, apply: bool):
    cursor = db.gallery_photos.find(
        {"url": {"$regex": "^data:"}},
        {"_id": 0, "id": 1, "user_id": 1, "url": 1},
    )
    count = 0
    converted = 0
    total_bytes = 0
    async for g in cursor:
        count += 1
        parsed = parse_data_uri(g["url"])
        if not parsed:
            continue
        content_type, raw = parsed
        total_bytes += len(raw)
        print(f"  → gallery {g['id']}: {len(raw):,} bytes ({content_type})")
        if apply:
            url = await upload_and_register(db, g["user_id"], raw, content_type, "gallery")
            await db.gallery_photos.update_one({"id": g["id"]}, {"$set": {"url": url}})
            converted += 1
    print(f"gallery_photos candidates: {count}, converted: {converted}, total bytes: {total_bytes:,}")
    return count, converted, total_bytes


async def migrate_posts(db, apply: bool):
    cursor = db.posts.find(
        {"media_url": {"$regex": "^data:"}},
        {"_id": 0, "id": 1, "user_id": 1, "media_url": 1, "user_photo": 1},
    )
    count = 0
    converted = 0
    total_bytes = 0
    async for p in cursor:
        count += 1
        parsed = parse_data_uri(p["media_url"])
        if not parsed:
            continue
        content_type, raw = parsed
        total_bytes += len(raw)
        print(f"  → post {p['id']}: {len(raw):,} bytes ({content_type})")
        if apply:
            url = await upload_and_register(db, p["user_id"], raw, content_type, "post")
            update = {"media_url": url}
            # Also fix the cached user_photo on the post if it's base64
            up = p.get("user_photo") or ""
            if isinstance(up, str) and up.startswith("data:"):
                update["user_photo"] = None  # Force frontend to use the freshly-migrated user photo_url
            await db.posts.update_one({"id": p["id"]}, {"$set": update})
            converted += 1
    print(f"posts.media_url candidates: {count}, converted: {converted}, total bytes: {total_bytes:,}")
    return count, converted, total_bytes


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="actually upload + update")
    args = parser.parse_args()

    if not MONGO_URL or not DB_NAME:
        print("❌ MONGO_URL / DB_NAME missing in env")
        sys.exit(1)

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"━━━━ Hi Again media migration — {mode} ━━━━")

    if args.apply:
        # Verify storage works before mutating anything
        try:
            get_storage_key()
            print("✅ Storage key OK")
        except Exception as e:
            print(f"❌ Storage init failed: {e}")
            sys.exit(2)

    print("\n--- USERS ---")
    u_c, u_v, u_b = await migrate_users(db, args.apply)
    print("\n--- GALLERY ---")
    g_c, g_v, g_b = await migrate_gallery(db, args.apply)
    print("\n--- POSTS ---")
    p_c, p_v, p_b = await migrate_posts(db, args.apply)

    print("\n━━━━ SUMMARY ━━━━")
    print(f"  users.photo_url:    {u_v}/{u_c} converted   ({u_b:,} bytes)")
    print(f"  gallery_photos.url: {g_v}/{g_c} converted   ({g_b:,} bytes)")
    print(f"  posts.media_url:    {p_v}/{p_c} converted   ({p_b:,} bytes)")
    grand_bytes = u_b + g_b + p_b
    grand_mb = grand_bytes / (1024 * 1024)
    print(f"  total reclaimed:    {grand_bytes:,} bytes (~{grand_mb:.1f} MB)")

    if not args.apply:
        print("\n(Dry-run — re-run with --apply to perform the migration.)")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
