from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Request, Form, Response, Query, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
import io
import zipfile
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import asyncio
import hashlib
import hmac
import logging
import re
import requests
import secrets
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict
from enum import Enum
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import json
from math import radians, sin, cos, sqrt, atan2
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Object Storage Configuration
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "hiagain"
storage_key = None

# ============================================================
# Email sending (Resend if configured, otherwise log-and-mock)
# ============================================================
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
RESEND_FROM_EMAIL = os.environ.get("RESEND_FROM_EMAIL", "onboarding@resend.dev")
RESEND_FROM_NAME = os.environ.get("RESEND_FROM_NAME", "Hi Again")

if RESEND_API_KEY:
    try:
        import resend
        resend.api_key = RESEND_API_KEY
    except ImportError:
        resend = None
else:
    resend = None

def email_provider_active() -> bool:
    return bool(RESEND_API_KEY and resend)

async def send_email(
    to: str,
    subject: str,
    html: str,
    text: Optional[str] = None,
    headers: Optional[dict] = None,
) -> bool:
    """Send an email via Resend. Returns True on success, False (logged) on failure
    or if not configured. Never raises — verification flow falls back to showing
    the code in-app when this returns False."""
    if not email_provider_active():
        logger.info(f"[email-mock] to={to} subject={subject}")
        return False
    try:
        params = {
            "from": f"{RESEND_FROM_NAME} <{RESEND_FROM_EMAIL}>",
            "to": [to],
            "subject": subject,
            "html": html,
        }
        if text:
            params["text"] = text
        if headers:
            params["headers"] = headers
        # Run sync SDK in thread to keep FastAPI non-blocking
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent to {to}: {subject} (id={result.get('id') if isinstance(result, dict) else 'ok'})")
        return True
    except Exception as e:
        logger.error(f"Email send failed to {to}: {e}")
        return False

# ============================================================
# Push notifications (Firebase Cloud Messaging via firebase-admin)
# ============================================================
FIREBASE_CREDENTIALS_PATH = os.environ.get("FIREBASE_CREDENTIALS_PATH")
FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID")
_firebase_app = None

if FIREBASE_CREDENTIALS_PATH and Path(FIREBASE_CREDENTIALS_PATH).exists():
    try:
        import firebase_admin
        from firebase_admin import credentials as _fb_credentials, messaging as _fb_messaging
        cred = _fb_credentials.Certificate(FIREBASE_CREDENTIALS_PATH)
        _firebase_app = firebase_admin.initialize_app(
            cred,
            {"projectId": FIREBASE_PROJECT_ID} if FIREBASE_PROJECT_ID else None,
            name="hiagain",
        )
    except Exception as _e:
        _firebase_app = None
        _fb_messaging = None
else:
    _fb_messaging = None


def push_provider_active() -> bool:
    return bool(_firebase_app and _fb_messaging)


async def send_push_to_tokens(
    tokens: List[str],
    title: str,
    body: str,
    data: Optional[Dict[str, str]] = None,
) -> int:
    """Send an FCM push to a list of device tokens. Returns count of successful
    deliveries. Silently no-ops when Firebase is not configured. Never raises.
    Auto-prunes invalid/unregistered tokens from the DB."""
    if not push_provider_active() or not tokens:
        return 0
    # FCM caps multicast at 500 tokens per request
    sent_ok = 0
    invalid_tokens: list = []
    try:
        notif = _fb_messaging.Notification(title=title, body=body)
        for chunk_start in range(0, len(tokens), 500):
            batch_tokens = tokens[chunk_start:chunk_start + 500]
            message = _fb_messaging.MulticastMessage(
                tokens=batch_tokens,
                notification=notif,
                data={k: str(v) for k, v in (data or {}).items()},
                android=_fb_messaging.AndroidConfig(
                    priority="high",
                    notification=_fb_messaging.AndroidNotification(
                        channel_id="hiagain_default",
                        color="#F97316",
                    ),
                ),
            )
            response = await asyncio.to_thread(
                _fb_messaging.send_each_for_multicast, message, app=_firebase_app
            )
            for idx, resp in enumerate(response.responses):
                if resp.success:
                    sent_ok += 1
                else:
                    err = resp.exception
                    err_code = getattr(err, "code", "") if err else ""
                    err_str = str(err).lower() if err else ""
                    # Treat any "invalid token / unregistered / mismatch" as
                    # prunable. firebase-admin's error codes vary by version.
                    is_invalid = (
                        err_code in (
                            "registration-token-not-registered",
                            "invalid-argument",
                            "invalid-registration-token",
                            "sender-id-mismatch",
                        )
                        or "invalid" in err_str
                        or "unregistered" in err_str
                        or "not registered" in err_str
                    )
                    if is_invalid:
                        invalid_tokens.append(batch_tokens[idx])
        if invalid_tokens:
            try:
                await db.push_tokens.delete_many({"token": {"$in": invalid_tokens}})
                logger.info(f"FCM: pruned {len(invalid_tokens)} stale tokens")
            except Exception:
                pass
    except Exception as e:
        logger.error(f"FCM send failed: {e}")
    return sent_ok


async def send_push_to_user(
    user_id: str,
    title: str,
    body: str,
    data: Optional[Dict[str, str]] = None,
) -> int:
    """Look up a user's registered device tokens and push to all of them."""
    if not push_provider_active():
        return 0
    docs = await db.push_tokens.find({"user_id": user_id}, {"_id": 0, "token": 1}).to_list(None)
    tokens = [d["token"] for d in docs if d.get("token")]
    if not tokens:
        return 0
    return await send_push_to_tokens(tokens, title, body, data)



async def send_verification_email(email: str, code: str) -> bool:
    subject = "Your Hi Again verification code"
    html = f"""
    <div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #0b0b14; color: #f5f5f5; border-radius: 16px;">
      <h1 style="font-size: 22px; margin: 0 0 12px; color: #fff;">Confirm your email</h1>
      <p style="color: #aaa; margin: 0 0 24px; line-height: 1.55;">
        Welcome to <span style="color: #f43f5e;">Hi Again</span>! Use the code below to verify your email. It expires in 15 minutes.
      </p>
      <div style="background: #1c1c2e; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 24px;">
        <div style="font-family: 'SF Mono', Menlo, monospace; font-size: 32px; letter-spacing: 8px; color: #fbbf24;">{code}</div>
      </div>
      <p style="color: #666; font-size: 12px; margin: 24px 0 0; line-height: 1.5;">
        If you didn't sign up for Hi Again, you can safely ignore this email.
      </p>
    </div>
    """
    text = f"Your Hi Again verification code is: {code}\nThis code expires in 15 minutes."
    return await send_email(email, subject, html, text)


# Public-facing site URL used in email CTAs. Falls back to preview URL for dev.
APP_URL = os.environ.get("APP_PUBLIC_URL", "https://hiagain.xyz")


# ---------- Email preferences & unsubscribe ----------
EMAIL_PREF_TYPES = {"crossings", "marketing", "welcome", "verification"}
DEFAULT_EMAIL_PREFS = {
    "crossings": True,
    "marketing": True,
    "welcome": True,
    # 'verification' is transactional — always sent regardless of toggle.
}


def _make_unsub_token(user_id: str, pref_type: str) -> str:
    """Sign (user_id, pref_type) with the JWT secret. Stateless; no DB lookup
    required to validate. Only valid for this app."""
    secret = os.environ["JWT_SECRET"].encode("utf-8")
    msg = f"{user_id}|{pref_type}".encode("utf-8")
    sig = hmac.new(secret, msg, hashlib.sha256).hexdigest()[:24]
    return f"{user_id}.{pref_type}.{sig}"


def _verify_unsub_token(token: str) -> Optional[tuple]:
    try:
        user_id, pref_type, sig = token.split(".", 2)
    except ValueError:
        return None
    if pref_type not in EMAIL_PREF_TYPES:
        return None
    expected = _make_unsub_token(user_id, pref_type).rsplit(".", 1)[1]
    if not hmac.compare_digest(sig, expected):
        return None
    return user_id, pref_type


async def get_email_prefs(user_id: str) -> dict:
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "email_prefs": 1})
    saved = (user or {}).get("email_prefs") or {}
    return {**DEFAULT_EMAIL_PREFS, **saved}


async def email_pref_enabled(user_id: str, pref_type: str) -> bool:
    if pref_type not in EMAIL_PREF_TYPES:
        return True
    if pref_type == "verification":
        return True  # transactional — never disabled
    prefs = await get_email_prefs(user_id)
    return bool(prefs.get(pref_type, True))


def _unsub_link(user_id: str, pref_type: str) -> str:
    token = _make_unsub_token(user_id, pref_type)
    return f"{APP_URL}/api/email-prefs/unsubscribe?token={token}"


def _email_shell(title: str, body_html: str, unsub_url: Optional[str] = None) -> str:
    """Common dark-themed wrapper for branded transactional emails."""
    unsub_html = ""
    if unsub_url:
        unsub_html = (
            f' · <a href="{unsub_url}" style="color: #888; text-decoration: underline;">Unsubscribe</a>'
        )
    return f"""
    <div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #0b0b14; color: #f5f5f5; border-radius: 16px;">
      <div style="text-align: center; margin: 0 0 24px;">
        <span style="font-family: 'Playfair Display', Georgia, serif; font-size: 26px; color: #fbbf24;">Hi Again</span>
      </div>
      <h1 style="font-size: 22px; margin: 0 0 16px; color: #fff;">{title}</h1>
      {body_html}
      <hr style="border: none; border-top: 1px solid #1f1f2e; margin: 32px 0 16px;" />
      <p style="color: #555; font-size: 11px; margin: 0; line-height: 1.5;">
        You're getting this because you signed up at <a href="{APP_URL}" style="color: #fbbf24; text-decoration: none;">hiagain.xyz</a>.
        <a href="{APP_URL}/profile" style="color: #888;">Manage preferences</a>{unsub_html}.
      </p>
    </div>
    """


async def send_welcome_email(email: str, name: str, user_id: Optional[str] = None) -> bool:
    """Sent right after signup. Friendly intro + 3 next steps."""
    first_name = (name or "there").split()[0]
    subject = f"Hi again, {first_name} 👋"
    body = f"""
      <p style="color: #ddd; margin: 0 0 18px; line-height: 1.6;">
        Welcome — really glad you're here. Hi Again helps you reconnect with the people you've actually crossed paths with: at concerts, bars, trips, work, anywhere.
      </p>
      <p style="color: #aaa; margin: 0 0 12px; line-height: 1.6;">Three things to try first:</p>
      <ol style="color: #ddd; line-height: 1.8; padding-left: 20px; margin: 0 0 24px;">
        <li><strong style="color: #fff;">Add a place</strong> you've been recently — concert, bar, gym, anywhere.</li>
        <li><strong style="color: #fff;">Open Crossings</strong> to see if anyone else was there too.</li>
        <li><strong style="color: #fff;">Check Discover</strong> for people you might know based on your overlap.</li>
      </ol>
      <div style="text-align: center; margin: 24px 0;">
        <a href="{APP_URL}/dashboard" style="display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #f59e0b, #f97316); color: #fff; text-decoration: none; border-radius: 999px; font-weight: 600;">
          Open Hi Again
        </a>
      </div>
      <p style="color: #888; font-size: 13px; margin: 24px 0 0; line-height: 1.55;">
        P.S. If you want a free month of Premium, use code <strong style="color: #fbbf24;">FRIENDS2026</strong> on the Premium page.
      </p>
    """
    text = (
        f"Hi {first_name},\n\n"
        "Welcome to Hi Again! Three things to try first:\n"
        "1. Add a place you've been recently.\n"
        "2. Open Crossings to see who was there too.\n"
        "3. Check Discover for people you might know.\n\n"
        f"Open the app: {APP_URL}/dashboard\n\n"
        "P.S. Code FRIENDS2026 unlocks a free month of Premium."
    )
    headers = None
    unsub_url = None
    if user_id:
        unsub_url = _unsub_link(user_id, "marketing")
        headers = {
            "List-Unsubscribe": f"<{unsub_url}>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }
    return await send_email(
        email,
        subject,
        _email_shell(f"Welcome, {first_name}!", body, unsub_url=unsub_url),
        text,
        headers=headers,
    )


async def send_crossing_email(
    *,
    user_id: str,
    to_email: str,
    to_name: str,
    other_name: str,
    other_photo: Optional[str],
    city: Optional[str],
    event_or_place: Optional[str],
    date_str: Optional[str],
) -> bool:
    """Sent when a NEW path crossing is detected. Soft, never identifies the
    other user beyond first name. Cooldown handled by the caller."""
    first_name = (to_name or "there").split()[0]
    other_first = (other_name or "Someone").split()[0]
    when = f" on {date_str}" if date_str else ""
    where = ""
    if event_or_place and city:
        where = f" at <strong style=\"color: #fff;\">{event_or_place}</strong> in {city}"
    elif event_or_place:
        where = f" at <strong style=\"color: #fff;\">{event_or_place}</strong>"
    elif city:
        where = f" in <strong style=\"color: #fff;\">{city}</strong>"
    photo_html = ""
    if other_photo:
        photo_html = (
            f"<img src=\"{other_photo}\" alt=\"\" "
            f"style=\"width: 56px; height: 56px; border-radius: 999px; object-fit: cover; "
            f"border: 2px solid rgba(251,191,36,.4); margin: 0 auto 12px; display: block;\" />"
        )
    subject = f"You crossed paths with {other_first} 👋"
    body = f"""
      {photo_html}
      <p style="color: #ddd; margin: 0 0 18px; line-height: 1.6;">
        Hey {first_name} — you and <strong style="color: #fff;">{other_first}</strong> were both{where}{when}.
      </p>
      <p style="color: #aaa; margin: 0 0 24px; line-height: 1.6;">
        Open Hi Again to see your shared timeline and say hi.
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="{APP_URL}/crossings" style="display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #f59e0b, #f97316); color: #fff; text-decoration: none; border-radius: 999px; font-weight: 600;">
          See the crossing
        </a>
      </div>
    """
    text = (
        f"Hey {first_name}, you and {other_first} were both"
        f"{(' at ' + event_or_place) if event_or_place else ''}"
        f"{(' in ' + city) if city else ''}"
        f"{when}.\n\nOpen Hi Again to say hi: {APP_URL}/crossings"
    )
    unsub_url = _unsub_link(user_id, "crossings")
    headers = {
        "List-Unsubscribe": f"<{unsub_url}>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    }
    return await send_email(
        to_email,
        subject,
        _email_shell(f"Hi again, {first_name}", body, unsub_url=unsub_url),
        text,
        headers=headers,
    )


# Crossing-email cooldown: don't notify the same user about the same other-user
# more than once every 24 hours, and never more than 3 crossing emails per user
# per 24 hours.
_CROSSING_EMAIL_PAIR_COOLDOWN_HOURS = 24
_CROSSING_EMAIL_DAILY_CAP = 3


async def _should_send_crossing_email(user_id: str, other_user_id: str) -> bool:
    now = datetime.now(timezone.utc)
    pair_cutoff = (now - timedelta(hours=_CROSSING_EMAIL_PAIR_COOLDOWN_HOURS)).isoformat()
    pair_recent = await db.crossing_email_log.find_one(
        {"user_id": user_id, "other_user_id": other_user_id, "sent_at": {"$gte": pair_cutoff}},
        {"_id": 0},
    )
    if pair_recent:
        return False
    daily_cutoff = (now - timedelta(hours=24)).isoformat()
    daily_count = await db.crossing_email_log.count_documents(
        {"user_id": user_id, "sent_at": {"$gte": daily_cutoff}}
    )
    return daily_count < _CROSSING_EMAIL_DAILY_CAP


async def _log_crossing_email(user_id: str, other_user_id: str) -> None:
    await db.crossing_email_log.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "other_user_id": other_user_id,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    })


async def maybe_send_crossing_email(crossing: dict) -> None:
    """Background task: send a crossing-notification email if the recipient
    has email_verified=True, has not already received one for this pair in 24h,
    and is under the daily cap. Never raises."""
    try:
        user_id = crossing.get("user_id")
        other_user_id = crossing.get("other_user_id")
        if not user_id or not other_user_id:
            return
        recipient = await db.users.find_one(
            {"id": user_id},
            {"_id": 0, "email": 1, "name": 1, "email_verified": 1, "ghost_mode": 1},
        )
        if not recipient or not recipient.get("email_verified"):
            return
        if recipient.get("ghost_mode"):
            return
        # Honor user's unsubscribe preference for crossing emails
        if not await email_pref_enabled(user_id, "crossings"):
            return
        if not await _should_send_crossing_email(user_id, other_user_id):
            return
        ok = await send_crossing_email(
            user_id=user_id,
            to_email=recipient["email"],
            to_name=recipient.get("name", ""),
            other_name=crossing.get("other_user_name", "Someone"),
            other_photo=crossing.get("other_user_photo"),
            city=crossing.get("city"),
            event_or_place=crossing.get("event_or_place"),
            date_str=crossing.get("date"),
        )
        if ok:
            await _log_crossing_email(user_id, other_user_id)
    except Exception as e:
        logger.error(f"crossing email task failed: {e}")


async def maybe_send_crossing_push(crossing: dict) -> None:
    """Background task: send an FCM push to the recipient of a new crossing.
    Never raises. Respects ghost_mode but NOT the email unsubscribe (push is a
    separate channel; we'll add per-channel prefs later)."""
    if not push_provider_active():
        return
    try:
        user_id = crossing.get("user_id")
        if not user_id:
            return
        recipient = await db.users.find_one(
            {"id": user_id}, {"_id": 0, "ghost_mode": 1}
        )
        if not recipient or recipient.get("ghost_mode"):
            return
        other_name = crossing.get("other_user_name", "Someone")
        place_bits = []
        if crossing.get("event_or_place"):
            place_bits.append(crossing["event_or_place"])
        if crossing.get("city"):
            place_bits.append(crossing["city"])
        location_str = " · ".join(place_bits) if place_bits else "a place you've both been"
        await send_push_to_user(
            user_id=user_id,
            title=f"You crossed paths with {other_name}",
            body=f"Both of you were at {location_str}. Say hi?",
            data={
                "type": "crossing",
                "other_user_id": str(crossing.get("other_user_id") or ""),
                "crossing_id": str(crossing.get("id") or ""),
            },
        )
    except Exception as e:
        logger.error(f"crossing push task failed: {e}")

def init_storage():
    """Initialize object storage - call once at startup"""
    global storage_key
    if storage_key:
        return storage_key
    if not EMERGENT_LLM_KEY:
        logging.warning("EMERGENT_LLM_KEY not set, storage disabled")
        return None
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        logging.info("Object storage initialized")
        return storage_key
    except Exception as e:
        logging.error(f"Storage init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Upload file to object storage"""
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage not available")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str) -> tuple:
    """Download file from object storage"""
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage not available")
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ============================================================
# Helper: upload a file to object storage AND register it in
# `media_files` so it can be served via `GET /api/media/{id}`.
# Returns the public URL (relative path) to embed in MongoDB.
# Used by profile-photo, gallery, and posts upload endpoints.
# ============================================================
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


async def store_media_blob(
    content: bytes,
    content_type: str,
    user_id: str,
    media_kind: str,  # one of: "profile", "gallery", "post"
) -> str:
    """Upload `content` to object storage, register in `media_files`, return
    the canonical URL ('/api/media/{id}') to persist on the parent document.
    """
    ext = MIME_EXT.get(content_type, "bin")
    file_id = str(uuid.uuid4())
    path = f"{APP_NAME}/{media_kind}/{user_id}/{file_id}.{ext}"
    result = put_object(path, content, content_type)

    record = {
        "id": file_id,
        "user_id": user_id,
        "storage_path": result["path"],
        "original_filename": None,
        "content_type": content_type,
        "size": result.get("size", len(content)),
        "media_type": media_kind,
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.media_files.insert_one(record)
    return f"/api/media/{file_id}"

# ============================================================
# Image Moderation (Gemini Vision via Emergent Universal Key)
# ============================================================
MODERATION_TIMEOUT_SECONDS = 8.0

async def moderate_image(image_bytes: bytes, content_type: str) -> dict:
    """Classify image as safe/unsafe. Fails OPEN on any error (returns is_safe=True)
    so a flaky LLM never blocks legitimate uploads. Caller should check is_safe.
    Returns: {is_safe: bool, reason: str | None}"""
    if not EMERGENT_LLM_KEY:
        return {"is_safe": True, "reason": None}
    # Only run on images we recognize
    if not content_type or not content_type.startswith("image/"):
        return {"is_safe": True, "reason": None}
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        import asyncio
        import base64 as _b64

        b64 = _b64.b64encode(image_bytes).decode('utf-8')
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"mod-{uuid.uuid4()}",
            system_message=(
                "You are an image safety classifier for a family-friendly social app. "
                "Reply with EXACTLY one line: SAFE or UNSAFE:<short reason>. "
                "Mark UNSAFE only for explicit nudity, sexual content, graphic violence, gore, "
                "or hate symbols. Normal photos of people, places, food, animals are SAFE."
            )
        ).with_model("gemini", "gemini-2.5-flash")

        msg = UserMessage(
            text="Classify this image.",
            file_contents=[ImageContent(image_base64=b64)]
        )
        reply = await asyncio.wait_for(chat.send_message(msg), timeout=MODERATION_TIMEOUT_SECONDS)
        text = (reply or "").strip().upper()
        if text.startswith("UNSAFE"):
            reason = text.split(":", 1)[1].strip().lower() if ":" in text else "unsafe content"
            return {"is_safe": False, "reason": reason[:120] or "unsafe content"}
        return {"is_safe": True, "reason": None}
    except Exception as e:
        logging.warning(f"Image moderation failed open: {e}")
        return {"is_safe": True, "reason": None}

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Stripe Settings
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')

# Donation packages (amounts in USD)
DONATION_PACKAGES = {
    "coffee": 5.00,
    "lunch": 10.00,
    "dinner": 25.00,
    "support": 50.00
}

# Create the main app
app = FastAPI(title="Hi Again API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security - auto_error=False allows cookie fallback when no Authorization header
security = HTTPBearer(auto_error=False)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== AUTO-SEED ON STARTUP ====================

import random

SEED_FIRST_NAMES = ["Emma", "Liam", "Olivia", "Noah", "Ava", "Sophia", "Mason", "Isabella", "Lucas", "Mia", "James", "Charlotte"]
SEED_LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis"]
SEED_CITIES = ["Miami", "New York", "Los Angeles", "Austin", "Chicago", "San Francisco", "Denver", "Seattle", "Nashville", "Boston"]
SEED_EVENTS = ["Taylor Swift Eras Tour", "Coldplay Concert", "Art Basel 2026", "Comic Con", "Jazz Festival", "Marathon", "Tech Conference", "Rooftop Bar Night", "Coffee Shop", "Yoga in the Park"]
SEED_CAPTIONS = ["Amazing night! 🎉", "Best event of the year!", "The vibes were immaculate ✨", "Who else was there?", "Unforgettable moment", "Made some amazing connections"]
SEED_BIOS = ["Love meeting new people ✨", "Music lover | Coffee addict", "Always at the best events", "Adventure seeker 🌎"]
AVATAR_COLORS = ["E91E63", "9C27B0", "673AB7", "3F51B5", "2196F3", "00BCD4", "009688", "4CAF50", "FF9800", "FF5722"]

async def seed_database_on_startup():
    """Seed the database with admin account and sample data if empty"""
    try:
        # Check if already seeded
        user_count = await db.users.count_documents({})
        if user_count > 0:
            logger.info(f"Database already has {user_count} users, skipping seed")
            return
        
        logger.info("🌱 Seeding database...")
        
        # 1. Create admin/owner account
        admin_password_hash = bcrypt.hashpw('HiAgain2024!'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        admin_user = {
            "id": str(uuid.uuid4()),
            "email": "hiagainxyz@gmail.com",
            "name": "Jay Sal",
            "password_hash": admin_password_hash,
            "photo_url": "https://ui-avatars.com/api/?name=Jay+Sal&background=E91E63&color=fff&size=200&bold=true",
            "bio": "Founder of Hi Again 🚀",
            "is_premium": True,
            "is_admin": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_user)
        logger.info("✅ Created admin account: hiagainxyz@gmail.com")
        
        # 2. Create sample users
        users = [admin_user]
        for i in range(15):
            first = random.choice(SEED_FIRST_NAMES)
            last = random.choice(SEED_LAST_NAMES)
            name = f"{first} {last}"
            color = random.choice(AVATAR_COLORS)
            
            user = {
                "id": str(uuid.uuid4()),
                "email": f"{first.lower()}{random.randint(100,999)}@gmail.com",
                "name": name,
                "password_hash": bcrypt.hashpw('password123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
                "photo_url": f"https://ui-avatars.com/api/?name={first}+{last}&background={color}&color=fff&size=200&bold=true",
                "bio": random.choice(SEED_BIOS),
                "is_premium": random.random() > 0.7,
                "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 30))).isoformat()
            }
            users.append(user)
        
        await db.users.insert_many(users[1:])  # Skip admin, already inserted
        logger.info(f"✅ Created {len(users)} users")
        
        # 3. Create locations
        locations = []
        for user in users[:10]:
            for _ in range(random.randint(2, 4)):
                days_ago = random.randint(1, 20)
                loc = {
                    "id": str(uuid.uuid4()),
                    "user_id": user['id'],
                    "city": random.choice(SEED_CITIES),
                    "event_or_place": random.choice(SEED_EVENTS),
                    "date": (datetime.now(timezone.utc) - timedelta(days=days_ago)).strftime("%Y-%m-%d"),
                    "created_at": (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()
                }
                locations.append(loc)
        
        await db.locations.insert_many(locations)
        logger.info(f"✅ Created {len(locations)} locations")
        
        # 4. Create crossings
        crossings = []
        used_pairs = set()
        for _ in range(30):
            user1, user2 = random.sample(users[:10], 2)
            pair = tuple(sorted([user1['id'], user2['id']]))
            if pair in used_pairs:
                continue
            used_pairs.add(pair)
            
            city = random.choice(SEED_CITIES)
            event = random.choice(SEED_EVENTS)
            days_ago = random.randint(1, 15)
            
            crossings.append({
                "id": str(uuid.uuid4()),
                "user_id": user1['id'],
                "other_user_id": user2['id'],
                "other_user_name": user2['name'],
                "other_user_email": user2['email'],
                "other_user_photo": user2.get('photo_url'),
                "city": city,
                "event_or_place": event,
                "date": (datetime.now(timezone.utc) - timedelta(days=days_ago)).strftime("%Y-%m-%d"),
                "match_score": random.choice(["high", "medium", "low"]),
                "match_type": random.choice(["moment", "path", "alumni"]),
                "overlap_count": random.randint(1, 3),
                "created_at": (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()
            })
            crossings.append({
                "id": str(uuid.uuid4()),
                "user_id": user2['id'],
                "other_user_id": user1['id'],
                "other_user_name": user1['name'],
                "other_user_email": user1['email'],
                "other_user_photo": user1.get('photo_url'),
                "city": city,
                "event_or_place": event,
                "date": (datetime.now(timezone.utc) - timedelta(days=days_ago)).strftime("%Y-%m-%d"),
                "match_score": random.choice(["high", "medium", "low"]),
                "match_type": random.choice(["moment", "path", "alumni"]),
                "overlap_count": random.randint(1, 3),
                "created_at": (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()
            })
        
        await db.crossings.insert_many(crossings)
        logger.info(f"✅ Created {len(crossings)} crossings")
        
        # 5. Create posts for feed
        posts = []
        for user in users[:8]:
            for _ in range(random.randint(1, 2)):
                days_ago = random.randint(0, 10)
                img_id = random.randint(1, 100)
                posts.append({
                    "id": str(uuid.uuid4()),
                    "user_id": user['id'],
                    "user_name": user['name'],
                    "user_photo": user.get('photo_url'),
                    "is_premium": user.get('is_premium', False),
                    "media_url": f"https://picsum.photos/seed/{img_id}/600/600",
                    "media_type": "image",
                    "caption": random.choice(SEED_CAPTIONS),
                    "location": random.choice(SEED_CITIES),
                    "likes": [u['id'] for u in random.sample(users, random.randint(2, 6))],
                    "likes_count": random.randint(5, 30),
                    "comments_count": random.randint(0, 8),
                    "created_at": (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()
                })
        
        await db.posts.insert_many(posts)
        logger.info(f"✅ Created {len(posts)} posts")
        
        logger.info("🎉 Database seeding complete!")
        
    except Exception as e:
        logger.error(f"Seeding error: {str(e)}")

@app.on_event("startup")
async def startup_event():
    """Run on app startup"""
    await seed_database_on_startup()

# ==================== MODELS ====================

# Signal types for proximity matching
class SignalType(str, Enum):
    MOMENT = "moment"      # Same place, same time
    PATH = "path"          # Same area, close time
    ALUMNI = "alumni"      # Same event/venue history
    NEARBY = "nearby"      # Same location bucket

class ProximitySignal(BaseModel):
    location_bucket: str   # e.g., "LA-Downtown", "NYC-Midtown"
    timestamp: float       # Unix timestamp
    signal_type: SignalType
    event_name: Optional[str] = None
    confidence: float = 1.0

class MatchScore(BaseModel):
    score: str  # "high", "medium", "low"
    overlap_count: int
    signals: List[dict] = []
    match_types: List[str] = []

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    photo_url: Optional[str] = None
    avatar_url: Optional[str] = None  # legacy alias; same value as photo_url
    created_at: str
    ghost_mode: Optional[bool] = False
    email_verified: Optional[bool] = False
    onboarded: Optional[bool] = False
    is_founder: Optional[bool] = False
    founder_number: Optional[int] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class LocationCreate(BaseModel):
    city: str
    event_or_place: str
    date: Optional[str] = None
    description: Optional[str] = None

class LocationResponse(BaseModel):
    id: str
    user_id: str
    city: str
    event_or_place: str
    date: str
    description: Optional[str] = None
    created_at: str

class CrossingResponse(BaseModel):
    id: str
    user_id: str
    other_user_id: str
    other_user_name: str
    other_user_email: str
    other_user_photo: Optional[str] = None
    city: Optional[str] = ""
    event_or_place: Optional[str] = ""
    date: Optional[str] = ""
    match_score: Optional[str] = "low"  # high, medium, low
    match_type: Optional[str] = "path"   # moment, path, alumni, nearby
    overlap_count: Optional[int] = 1
    created_at: str

class ConnectionCreate(BaseModel):
    target_user_id: str
    message: Optional[str] = None

class ConnectionResponse(BaseModel):
    id: str
    requester_id: str
    requester_name: str
    requester_email: str
    target_id: str
    target_name: str
    target_email: str
    status: str  # pending, accepted, rejected
    message: Optional[str] = None
    created_at: str

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    photo_url: Optional[str] = None
    bio: Optional[str] = None
    ghost_mode: Optional[bool] = None

class PostCreate(BaseModel):
    caption: Optional[str] = None
    location: Optional[str] = None
    is_private: bool = False

class PostResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    user_photo: Optional[str] = None
    is_premium: bool = False
    media_url: str
    media_type: str  # "image" or "video"
    caption: Optional[str] = None
    location: Optional[str] = None
    likes_count: int = 0
    comments_count: int = 0
    liked_by_me: bool = False
    is_private: bool = False
    created_at: str


class ReportRequest(BaseModel):
    reason: str = "Inappropriate content"

class CommentCreate(BaseModel):
    text: str

class CommentResponse(BaseModel):
    id: str
    post_id: str
    user_id: str
    user_name: str
    user_photo: Optional[str] = None
    text: str
    created_at: str

class DonationRequest(BaseModel):
    package_id: str
    origin_url: str

class DonationResponse(BaseModel):
    checkout_url: str
    session_id: str

class SubscriptionRequest(BaseModel):
    plan: str  # "monthly" or "yearly"
    origin_url: str
    currency: Optional[str] = "usd"  # "usd" or "inr"

# Premium Plans — priced in two currencies. Stripe US merchant can charge INR
# on cards that have international transactions enabled (covers ~80% of Indian
# Premium-paying users). UPI/RuPay-only cards will fall through to USD.
PREMIUM_PLANS = {
    "monthly": {
        "name": "Premium Monthly",
        "duration_days": 30,
        "prices": {
            "usd": 4.99,
            "inr": 399.0,
        },
    },
    "yearly": {
        "name": "Premium Yearly",
        "duration_days": 365,
        "prices": {
            "usd": 39.99,
            "inr": 3999.0,
        },
    },
}

SUPPORTED_CURRENCIES = {"usd", "inr"}

# Free tier limits
FREE_TIER_LIMITS = {
    "max_locations": 3,
    "max_messages_per_day": 5,
    "can_see_full_profile": False,
    "can_see_who_viewed": False,
    "profile_boost": False
}

# Blocked patterns for contact info
BLOCKED_PATTERNS = [
    r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',  # Phone numbers
    r'\b\d{10,11}\b',  # Long numbers
    r'@\w+\.\w+',  # Emails
    r'\b(instagram|insta|ig|snap|snapchat|whatsapp|telegram|signal|facebook|fb|twitter|tiktok)\b',
    r'\b(dm me|text me|call me|hit me up|hmu)\b',
]

# ==================== HELPERS ====================

# Cookie settings for secure JWT storage
COOKIE_NAME = "hiagain_token"
COOKIE_MAX_AGE = JWT_EXPIRATION_HOURS * 3600  # Convert hours to seconds
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "true").lower() == "true"  # Use secure cookies in production
COOKIE_SAMESITE = "lax"  # Protects against CSRF while allowing normal navigation

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def set_auth_cookie(response: Response, token: str):
    """Set httpOnly cookie with JWT token"""
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/"
    )

def clear_auth_cookie(response: Response):
    """Clear the auth cookie on logout"""
    response.delete_cookie(key=COOKIE_NAME, path="/")

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    """Get current user from either cookie or Authorization header"""
    token = None
    
    # First try httpOnly cookie
    token = request.cookies.get(COOKIE_NAME)
    
    # Fallback to Authorization header for backward compatibility
    if not token and credentials:
        token = credentials.credentials
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two GPS points in meters"""
    R = 6371000  # Earth's radius in meters
    
    lat1_rad = radians(lat1)
    lat2_rad = radians(lat2)
    delta_lat = radians(lat2 - lat1)
    delta_lon = radians(lon2 - lon1)
    
    a = sin(delta_lat/2)**2 + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    
    return R * c

async def is_premium_user(user_id: str) -> bool:
    """Check if user has active premium subscription or is marked as premium"""
    # Check for active subscription first
    subscription = await db.subscriptions.find_one({
        "user_id": user_id,
        "status": "active",
        "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}
    })
    if subscription:
        return True
    
    # Also check if user is marked as premium (e.g., admin/test accounts)
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "is_premium": 1})
    return user.get("is_premium", False) if user else False

async def get_user_tier(user_id: str) -> dict:
    """Get user's subscription tier and limits"""
    if await is_premium_user(user_id):
        return {
            "tier": "premium",
            "max_locations": 999999,
            "max_messages_per_day": 999999,
            "can_see_full_profile": True,
            "can_see_who_viewed": True,
            "profile_boost": True,
            "verified_badge": True
        }
    return {
        "tier": "free",
        **FREE_TIER_LIMITS,
        "verified_badge": False
    }

def filter_contact_info(text: str) -> tuple:
    """Filter out phone numbers, emails, and social media handles. Returns (filtered_text, was_filtered)"""
    if not text:
        return text, False
    
    original = text
    for pattern in BLOCKED_PATTERNS:
        text = re.sub(pattern, '[contact hidden - upgrade to Premium]', text, flags=re.IGNORECASE)
    
    was_filtered = text != original
    return text, was_filtered

def contains_contact_info(text: str) -> bool:
    """Check if text contains contact information"""
    if not text:
        return False
    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return True
    return False

async def detect_crossings(user_id: str, location: dict):
    """Detect path crossings with other users based on city, event, and date"""
    loc_date = location.get('date', '')
    city = location.get('city', '').lower().strip()
    event = location.get('event_or_place', '').lower().strip()
    
    # Find other users' locations with projection (only needed fields)
    other_locations = await db.locations.find(
        {"user_id": {"$ne": user_id}},
        {"_id": 0, "user_id": 1, "city": 1, "event_or_place": 1, "date": 1, "timestamp": 1}
    ).to_list(1000)
    
    # Find potential matches first
    potential_matches = []
    for other_loc in other_locations:
        other_city = other_loc.get('city', '').lower().strip()
        other_event = other_loc.get('event_or_place', '').lower().strip()
        other_date = other_loc.get('date', '')
        
        city_match = city == other_city or city in other_city or other_city in city
        event_match = event == other_event or event in other_event or other_event in event
        date_match = loc_date == other_date
        
        if city_match and (event_match or date_match):
            potential_matches.append(other_loc)
    
    if not potential_matches:
        return []
    
    # Batch fetch user info for all potential matches
    other_user_ids = list(set(m['user_id'] for m in potential_matches))
    users_cursor = await db.users.find(
        {"id": {"$in": other_user_ids}},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "photo_url": 1}
    ).to_list(100)
    users_map = {u['id']: u for u in users_cursor}
    
    # Get current user info once
    current_user = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1, "email": 1, "photo_url": 1})
    
    crossings = []
    for other_loc in potential_matches:
        # Check if crossing already exists
        existing = await db.crossings.find_one({
            "user_id": user_id,
            "other_user_id": other_loc['user_id'],
            "city": location.get('city'),
            "event_or_place": location.get('event_or_place')
        })
        
        if not existing:
            other_user = users_map.get(other_loc['user_id'])
            if other_user:
                # Calculate match score using proximity algorithm
                match_score = calculate_match_score(location, other_loc)
                
                crossing = {
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "other_user_id": other_loc['user_id'],
                    "other_user_name": other_user['name'],
                    "other_user_email": other_user['email'],
                    "other_user_photo": other_user.get('photo_url'),
                    "city": location.get('city'),
                    "event_or_place": location.get('event_or_place') or other_loc.get('event_or_place'),
                    "date": location.get('date'),
                    "match_score": match_score['score'],
                    "match_type": match_score['match_type'],
                    "overlap_count": match_score['overlap_count'],
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.crossings.insert_one(crossing)
                crossings.append(crossing)
                # Notify the user about this fresh crossing (cooldown applies)
                asyncio.create_task(maybe_send_crossing_email(crossing))
                asyncio.create_task(maybe_send_crossing_push(crossing))
                
                # Create reverse crossing for the other user
                reverse_crossing = {
                    "id": str(uuid.uuid4()),
                    "user_id": other_loc['user_id'],
                    "other_user_id": user_id,
                    "other_user_name": current_user['name'],
                    "other_user_email": current_user['email'],
                    "other_user_photo": current_user.get('photo_url'),
                    "city": other_loc.get('city'),
                    "event_or_place": other_loc.get('event_or_place') or location.get('event_or_place'),
                    "date": other_loc.get('date'),
                    "match_score": match_score['score'],
                    "match_type": match_score['match_type'],
                    "overlap_count": match_score['overlap_count'],
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.crossings.insert_one(reverse_crossing)
                # Also notify the other user
                asyncio.create_task(maybe_send_crossing_email(reverse_crossing))
                asyncio.create_task(maybe_send_crossing_push(reverse_crossing))
    
    return crossings


# ==================== PROXIMITY MATCHING ALGORITHM ====================

def generate_location_bucket(city: str, event: str = None) -> str:
    """Generate a location bucket identifier like 'LA-Downtown' or 'NYC-CentralPark'"""
    city_clean = city.strip().title().replace(' ', '')
    if event:
        event_clean = ''.join(word.title() for word in event.split()[:2])
        return f"{city_clean}-{event_clean}"
    return city_clean


def generate_proximity_signals(location: dict) -> List[dict]:
    """Generate proximity signals for a location (like DiscoveryProvider)"""
    signals = []
    city = location.get('city', '')
    event = location.get('event_or_place', '')
    date_str = location.get('date', '')
    
    # Parse timestamp from date or use created_at
    try:
        if date_str:
            timestamp = datetime.strptime(date_str, "%Y-%m-%d").timestamp()
        else:
            timestamp = datetime.now(timezone.utc).timestamp()
    except Exception:
        timestamp = datetime.now(timezone.utc).timestamp()
    
    # Signal 1: Location bucket (area-based)
    if city:
        signals.append({
            "bucket": generate_location_bucket(city),
            "time": timestamp,
            "type": "nearby",
            "confidence": 0.7
        })
    
    # Signal 2: Event/place specific (higher confidence)
    if event:
        signals.append({
            "bucket": generate_location_bucket(city, event),
            "time": timestamp,
            "type": "moment",
            "confidence": 1.0
        })
        
        # Signal 3: Alumni signal for recurring venues
        recurring_venues = ['gym', 'coffee', 'yoga', 'church', 'library', 'park', 'club']
        if any(venue in event.lower() for venue in recurring_venues):
            signals.append({
                "bucket": generate_location_bucket(city, event),
                "time": timestamp,
                "type": "alumni",
                "confidence": 0.9
            })
    
    return signals


def match_proximity_signals(signals_a: List[dict], signals_b: List[dict], time_window: int = 900) -> dict:
    """
    Match two sets of proximity signals (translated from Swift algorithm)
    time_window: seconds (default 15 minutes = 900)
    Returns match result with score
    """
    overlaps = []
    match_types = set()
    
    for a in signals_a:
        for b in signals_b:
            # Check if same bucket and within time window
            if a['bucket'] == b['bucket'] and abs(a['time'] - b['time']) < time_window:
                overlaps.append({
                    "bucket": a['bucket'],
                    "type": a['type'],
                    "confidence": (a['confidence'] + b['confidence']) / 2,
                    "time_diff": abs(a['time'] - b['time'])
                })
                match_types.add(a['type'])
    
    if overlaps:
        # Calculate score based on overlap count and types
        if len(overlaps) >= 3 or 'moment' in match_types:
            score = "high"
        elif len(overlaps) >= 2 or 'alumni' in match_types:
            score = "medium"
        else:
            score = "low"
        
        return {
            "matched": True,
            "score": score,
            "overlap_count": len(overlaps),
            "overlaps": overlaps,
            "match_types": list(match_types)
        }
    
    return {"matched": False, "score": None, "overlap_count": 0, "overlaps": [], "match_types": []}


def calculate_match_score(location_a: dict, location_b: dict) -> dict:
    """Calculate match score between two locations using proximity signals"""
    signals_a = generate_proximity_signals(location_a)
    signals_b = generate_proximity_signals(location_b)
    
    result = match_proximity_signals(signals_a, signals_b)
    
    # Fallback to basic matching if no signal overlap
    if not result['matched']:
        city_a = location_a.get('city', '').lower()
        city_b = location_b.get('city', '').lower()
        event_a = location_a.get('event_or_place', '').lower()
        event_b = location_b.get('event_or_place', '').lower()
        
        if event_a and event_b and (event_a == event_b or event_a in event_b or event_b in event_a):
            return {"score": "high", "match_type": "moment", "overlap_count": 1}
        elif city_a == city_b:
            return {"score": "low", "match_type": "path", "overlap_count": 1}
    
    return {
        "score": result.get('score', 'low'),
        "match_type": result['match_types'][0] if result['match_types'] else 'path',
        "overlap_count": result['overlap_count']
    }


# ==================== ACHIEVEMENTS & BADGES SYSTEM ====================

# Badge definitions with stickers, trophies, and playful titles
ACHIEVEMENT_BADGES = {
    # Posting Achievements
    "first_post": {
        "id": "first_post",
        "name": "First Steps",
        "description": "Posted your first moment",
        "emoji": "🌟",
        "sticker": "✨",
        "category": "posting",
        "tier": "bronze",
        "threshold": 1
    },
    "storyteller": {
        "id": "storyteller",
        "name": "Storyteller",
        "description": "Shared 5 moments with the community",
        "emoji": "📖",
        "sticker": "📸",
        "category": "posting",
        "tier": "silver",
        "threshold": 5
    },
    "content_creator": {
        "id": "content_creator",
        "name": "Content Creator",
        "description": "Posted 15 amazing moments",
        "emoji": "🎬",
        "sticker": "🎥",
        "category": "posting",
        "tier": "gold",
        "threshold": 15
    },
    "influencer": {
        "id": "influencer",
        "name": "Moment Influencer",
        "description": "A posting legend with 30+ moments",
        "emoji": "👑",
        "sticker": "💫",
        "category": "posting",
        "tier": "platinum",
        "threshold": 30
    },
    "viral_sensation": {
        "id": "viral_sensation",
        "name": "Viral Sensation",
        "description": "50+ moments shared! You're unstoppable!",
        "emoji": "🚀",
        "sticker": "🔥",
        "category": "posting",
        "tier": "diamond",
        "threshold": 50
    },
    
    # Connection Achievements  
    "social_butterfly": {
        "id": "social_butterfly",
        "name": "Social Butterfly",
        "description": "Made your first connection",
        "emoji": "🦋",
        "sticker": "💕",
        "category": "connections",
        "tier": "bronze",
        "threshold": 1
    },
    "networker": {
        "id": "networker",
        "name": "Networker",
        "description": "Connected with 5 people",
        "emoji": "🤝",
        "sticker": "🌐",
        "category": "connections",
        "tier": "silver",
        "threshold": 5
    },
    "connector": {
        "id": "connector",
        "name": "Super Connector",
        "description": "Building a network of 15+ connections",
        "emoji": "⭐",
        "sticker": "🌟",
        "category": "connections",
        "tier": "gold",
        "threshold": 15
    },
    "social_icon": {
        "id": "social_icon",
        "name": "Social Icon",
        "description": "30+ connections! Everyone wants to know you",
        "emoji": "🏆",
        "sticker": "👑",
        "category": "connections",
        "tier": "platinum",
        "threshold": 30
    },
    
    # Path Crossing Achievements
    "path_finder": {
        "id": "path_finder",
        "name": "Path Finder",
        "description": "Discovered your first path crossing",
        "emoji": "🔍",
        "sticker": "🎯",
        "category": "crossings",
        "tier": "bronze",
        "threshold": 1
    },
    "destiny_tracker": {
        "id": "destiny_tracker",
        "name": "Destiny Tracker",
        "description": "Found 10 path crossings",
        "emoji": "🌈",
        "sticker": "✨",
        "category": "crossings",
        "tier": "silver",
        "threshold": 10
    },
    "fate_weaver": {
        "id": "fate_weaver",
        "name": "Fate Weaver",
        "description": "25+ path crossings! The universe is speaking",
        "emoji": "🌙",
        "sticker": "🔮",
        "category": "crossings",
        "tier": "gold",
        "threshold": 25
    },
    
    # Location Achievements
    "explorer": {
        "id": "explorer",
        "name": "Explorer",
        "description": "Checked into 3 different locations",
        "emoji": "🗺️",
        "sticker": "📍",
        "category": "locations",
        "tier": "bronze",
        "threshold": 3
    },
    "adventurer": {
        "id": "adventurer",
        "name": "Adventurer",
        "description": "Visited 10 unique places",
        "emoji": "🧭",
        "sticker": "🏔️",
        "category": "locations",
        "tier": "silver",
        "threshold": 10
    },
    "globe_trotter": {
        "id": "globe_trotter",
        "name": "Globe Trotter",
        "description": "25+ locations! You're everywhere!",
        "emoji": "🌍",
        "sticker": "✈️",
        "category": "locations",
        "tier": "gold",
        "threshold": 25
    },
    
    # Engagement Achievements
    "liked": {
        "id": "liked",
        "name": "Crowd Pleaser",
        "description": "Got 10 likes on your posts",
        "emoji": "❤️",
        "sticker": "💖",
        "category": "engagement",
        "tier": "bronze",
        "threshold": 10
    },
    "popular": {
        "id": "popular",
        "name": "Fan Favorite",
        "description": "Received 50 likes total",
        "emoji": "🔥",
        "sticker": "💝",
        "category": "engagement",
        "tier": "silver",
        "threshold": 50
    },
    "superstar": {
        "id": "superstar",
        "name": "Superstar",
        "description": "100+ likes! You're on fire!",
        "emoji": "⭐",
        "sticker": "🌟",
        "category": "engagement",
        "tier": "gold",
        "threshold": 100
    },
    
    # Special Achievements
    "early_adopter": {
        "id": "early_adopter",
        "name": "Early Adopter",
        "description": "Joined Hi Again in the early days",
        "emoji": "🚀",
        "sticker": "🎖️",
        "category": "special",
        "tier": "special",
        "threshold": 0
    },
    "referral_champion": {
        "id": "referral_champion",
        "name": "Referral Champion",
        "description": "Invited 5+ friends to Hi Again",
        "emoji": "🎁",
        "sticker": "🎉",
        "category": "special",
        "tier": "gold",
        "threshold": 5
    },
    "gps_pioneer": {
        "id": "gps_pioneer",
        "name": "GPS Pioneer",
        "description": "Used GPS proximity to find matches",
        "emoji": "📡",
        "sticker": "🛰️",
        "category": "special",
        "tier": "silver",
        "threshold": 1
    }
}

# Playful titles based on overall activity level
USER_TITLES = [
    {"level": 0, "title": "Newcomer", "emoji": "🌱", "min_score": 0},
    {"level": 1, "title": "Explorer", "emoji": "🔍", "min_score": 10},
    {"level": 2, "title": "Regular", "emoji": "⭐", "min_score": 25},
    {"level": 3, "title": "Rising Star", "emoji": "🌟", "min_score": 50},
    {"level": 4, "title": "Social Butterfly", "emoji": "🦋", "min_score": 100},
    {"level": 5, "title": "Connector", "emoji": "🤝", "min_score": 200},
    {"level": 6, "title": "Trendsetter", "emoji": "💫", "min_score": 350},
    {"level": 7, "title": "Influencer", "emoji": "👑", "min_score": 500},
    {"level": 8, "title": "Legend", "emoji": "🏆", "min_score": 750},
    {"level": 9, "title": "Icon", "emoji": "💎", "min_score": 1000},
    {"level": 10, "title": "Hi Again Royalty", "emoji": "🌈", "min_score": 2000}
]

def get_tier_color(tier: str) -> str:
    """Get color for badge tier"""
    colors = {
        "bronze": "#CD7F32",
        "silver": "#C0C0C0", 
        "gold": "#FFD700",
        "platinum": "#E5E4E2",
        "diamond": "#B9F2FF",
        "special": "#FF69B4"
    }
    return colors.get(tier, "#888888")

async def calculate_user_achievements(user_id: str) -> dict:
    """Calculate all achievements for a user based on their activity"""
    
    # Get counts
    post_count = await db.posts.count_documents({"user_id": user_id, "is_deleted": {"$ne": True}})
    connection_count = await db.connections.count_documents({
        "$or": [
            {"requester_id": user_id, "status": "accepted"},
            {"target_id": user_id, "status": "accepted"}
        ]
    })
    crossing_count = await db.crossings.count_documents({"user_id": user_id})
    location_count = await db.locations.count_documents({"user_id": user_id})
    
    # Get total likes received
    user_posts = await db.posts.find({"user_id": user_id}, {"_id": 0, "likes": 1}).to_list(1000)
    total_likes = sum(len(p.get('likes', [])) for p in user_posts)
    
    # Get referral count
    referral_count = await db.referrals.count_documents({"referrer_id": user_id, "status": "completed"})
    
    # Get GPS ping count
    gps_count = await db.gps_pings.count_documents({"user_id": user_id})
    
    # Calculate earned badges
    earned_badges = []
    
    # Check posting achievements
    if post_count >= 1:
        earned_badges.append("first_post")
    if post_count >= 5:
        earned_badges.append("storyteller")
    if post_count >= 15:
        earned_badges.append("content_creator")
    if post_count >= 30:
        earned_badges.append("influencer")
    if post_count >= 50:
        earned_badges.append("viral_sensation")
    
    # Check connection achievements
    if connection_count >= 1:
        earned_badges.append("social_butterfly")
    if connection_count >= 5:
        earned_badges.append("networker")
    if connection_count >= 15:
        earned_badges.append("connector")
    if connection_count >= 30:
        earned_badges.append("social_icon")
    
    # Check crossing achievements
    if crossing_count >= 1:
        earned_badges.append("path_finder")
    if crossing_count >= 10:
        earned_badges.append("destiny_tracker")
    if crossing_count >= 25:
        earned_badges.append("fate_weaver")
    
    # Check location achievements
    if location_count >= 3:
        earned_badges.append("explorer")
    if location_count >= 10:
        earned_badges.append("adventurer")
    if location_count >= 25:
        earned_badges.append("globe_trotter")
    
    # Check engagement achievements
    if total_likes >= 10:
        earned_badges.append("liked")
    if total_likes >= 50:
        earned_badges.append("popular")
    if total_likes >= 100:
        earned_badges.append("superstar")
    
    # Check special achievements
    if referral_count >= 5:
        earned_badges.append("referral_champion")
    if gps_count >= 1:
        earned_badges.append("gps_pioneer")
    
    # Calculate activity score for title
    activity_score = (
        post_count * 5 +
        connection_count * 10 +
        crossing_count * 3 +
        location_count * 2 +
        total_likes * 1 +
        referral_count * 20
    )
    
    # Determine user title
    user_title = USER_TITLES[0]
    for title in USER_TITLES:
        if activity_score >= title['min_score']:
            user_title = title
    
    return {
        "earned_badges": earned_badges,
        "badge_count": len(earned_badges),
        "activity_score": activity_score,
        "user_title": user_title,
        "stats": {
            "posts": post_count,
            "connections": connection_count,
            "crossings": crossing_count,
            "locations": location_count,
            "likes_received": total_likes,
            "referrals": referral_count
        }
    }


class BadgeResponse(BaseModel):
    id: str
    name: str
    description: str
    emoji: str
    sticker: str
    category: str
    tier: str
    tier_color: str
    earned: bool


class AchievementsResponse(BaseModel):
    user_id: str
    user_title: dict
    activity_score: int
    badge_count: int
    total_badges: int
    earned_badges: List[BadgeResponse]
    locked_badges: List[BadgeResponse]
    stats: dict


@api_router.get("/achievements", response_model=AchievementsResponse)
async def get_user_achievements(current_user: dict = Depends(get_current_user)):
    """Get all achievements and badges for the current user"""
    result = await calculate_user_achievements(current_user['id'])
    
    earned_badges = []
    locked_badges = []
    
    for badge_id, badge in ACHIEVEMENT_BADGES.items():
        badge_data = BadgeResponse(
            id=badge['id'],
            name=badge['name'],
            description=badge['description'],
            emoji=badge['emoji'],
            sticker=badge['sticker'],
            category=badge['category'],
            tier=badge['tier'],
            tier_color=get_tier_color(badge['tier']),
            earned=badge_id in result['earned_badges']
        )
        
        if badge_id in result['earned_badges']:
            earned_badges.append(badge_data)
        else:
            locked_badges.append(badge_data)
    
    # Sort earned by tier
    tier_order = {'diamond': 0, 'platinum': 1, 'gold': 2, 'silver': 3, 'bronze': 4, 'special': 5}
    earned_badges.sort(key=lambda x: tier_order.get(x.tier, 99))
    
    return AchievementsResponse(
        user_id=current_user['id'],
        user_title=result['user_title'],
        activity_score=result['activity_score'],
        badge_count=result['badge_count'],
        total_badges=len(ACHIEVEMENT_BADGES),
        earned_badges=earned_badges,
        locked_badges=locked_badges,
        stats=result['stats']
    )


@api_router.get("/achievements/{user_id}/public")
async def get_public_achievements(user_id: str):
    """Get public achievement summary for any user (for profile display)"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    result = await calculate_user_achievements(user_id)
    
    # Return only earned badges for public view
    earned_badges = []
    for badge_id in result['earned_badges']:
        if badge_id in ACHIEVEMENT_BADGES:
            badge = ACHIEVEMENT_BADGES[badge_id]
            earned_badges.append({
                "id": badge['id'],
                "name": badge['name'],
                "emoji": badge['emoji'],
                "sticker": badge['sticker'],
                "tier": badge['tier']
            })
    
    return {
        "user_id": user_id,
        "user_name": user.get('name', 'Unknown'),
        "user_title": result['user_title'],
        "badge_count": result['badge_count'],
        "top_badges": earned_badges[:5]  # Show top 5 badges
    }


@api_router.get("/achievements/leaderboard")
async def get_achievements_leaderboard(limit: int = Query(10, ge=1, le=50)):
    """Get top users by achievement score"""
    # Get all users
    users = await db.users.find({}, {"_id": 0, "id": 1, "name": 1, "photo_url": 1}).to_list(500)
    
    user_scores = []
    for user in users:
        result = await calculate_user_achievements(user['id'])
        user_scores.append({
            "user_id": user['id'],
            "name": user.get('name', 'Unknown'),
            "photo_url": user.get('photo_url'),
            "activity_score": result['activity_score'],
            "badge_count": result['badge_count'],
            "user_title": result['user_title']
        })
    
    # Sort by activity score
    user_scores.sort(key=lambda x: x['activity_score'], reverse=True)
    
    # Add ranks
    for i, user in enumerate(user_scores[:limit]):
        user['rank'] = i + 1
    
    return {"leaderboard": user_scores[:limit]}


# ==================== GPS PROXIMITY SYSTEM (Haversine Formula) ====================

# Note: haversine_distance() function is defined earlier in the file (around line 465)

# Proximity thresholds in meters
PROXIMITY_THRESHOLDS = {
    "venue": 50,       # Same venue (concert, gym, coffee shop)
    "nearby": 200,     # Very close proximity
    "area": 500,       # Same general area
    "neighborhood": 1000  # Same neighborhood
}


class GPSPingRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    accuracy: Optional[float] = None  # GPS accuracy in meters
    timestamp: Optional[str] = None


class GPSLocationResponse(BaseModel):
    id: str
    user_id: str
    latitude: float
    longitude: float
    accuracy: Optional[float]
    timestamp: str
    matches_found: int = 0


class ProximityMatch(BaseModel):
    user_id: str
    user_name: str
    user_photo: Optional[str]
    distance_meters: float
    proximity_level: str  # venue, nearby, area, neighborhood
    last_seen: str
    is_mutual: bool = False


async def find_nearby_users(user_id: str, lat: float, lon: float, max_distance: float = 1000) -> List[dict]:
    """
    Find users who were recently near the given coordinates.
    Uses MongoDB's geospatial queries for efficiency.
    """
    # Get recent GPS pings from other users (last 24 hours)
    time_threshold = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    
    # Query GPS pings collection
    nearby_pings = await db.gps_pings.find({
        "user_id": {"$ne": user_id},
        "timestamp": {"$gte": time_threshold}
    }, {"_id": 0}).to_list(500)
    
    matches = []
    seen_users = set()
    
    for ping in nearby_pings:
        if ping['user_id'] in seen_users:
            continue
            
        ping_lat = ping.get('latitude')
        ping_lon = ping.get('longitude')
        
        if ping_lat is None or ping_lon is None:
            continue
        
        distance = haversine_distance(lat, lon, ping_lat, ping_lon)
        
        if distance <= max_distance:
            seen_users.add(ping['user_id'])
            
            # Determine proximity level
            if distance <= PROXIMITY_THRESHOLDS["venue"]:
                proximity_level = "venue"
            elif distance <= PROXIMITY_THRESHOLDS["nearby"]:
                proximity_level = "nearby"
            elif distance <= PROXIMITY_THRESHOLDS["area"]:
                proximity_level = "area"
            else:
                proximity_level = "neighborhood"
            
            matches.append({
                "user_id": ping['user_id'],
                "distance_meters": round(distance, 1),
                "proximity_level": proximity_level,
                "last_seen": ping.get('timestamp'),
                "latitude": ping_lat,
                "longitude": ping_lon
            })
    
    # Sort by distance
    matches.sort(key=lambda x: x['distance_meters'])
    return matches


@api_router.post("/gps/ping", response_model=GPSLocationResponse)
async def gps_ping(
    data: GPSPingRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Send a GPS ping to update user's current location.
    This is called when using navigator.geolocation.watchPosition() on the frontend.
    Returns nearby matches if found.
    """
    now = datetime.now(timezone.utc).isoformat()
    timestamp = data.timestamp or now
    
    # Store GPS ping
    ping = {
        "id": str(uuid.uuid4()),
        "user_id": current_user['id'],
        "latitude": data.latitude,
        "longitude": data.longitude,
        "accuracy": data.accuracy,
        "timestamp": timestamp,
        "created_at": now
    }
    await db.gps_pings.insert_one(ping)
    
    # Find nearby users
    nearby = await find_nearby_users(
        current_user['id'], 
        data.latitude, 
        data.longitude,
        PROXIMITY_THRESHOLDS["neighborhood"]
    )
    
    # Create proximity crossings for venue-level matches
    matches_created = 0
    for match in nearby:
        if match['proximity_level'] == 'venue':
            # Check if crossing already exists (within last hour)
            hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
            existing = await db.crossings.find_one({
                "user_id": current_user['id'],
                "other_user_id": match['user_id'],
                "created_at": {"$gte": hour_ago},
                "match_type": "gps_proximity"
            })
            
            if not existing:
                # Get other user info
                other_user = await db.users.find_one(
                    {"id": match['user_id']},
                    {"_id": 0, "name": 1, "email": 1, "photo_url": 1}
                )
                
                if other_user:
                    crossing = {
                        "id": str(uuid.uuid4()),
                        "user_id": current_user['id'],
                        "other_user_id": match['user_id'],
                        "other_user_name": other_user['name'],
                        "other_user_email": other_user['email'],
                        "other_user_photo": other_user.get('photo_url'),
                        "city": "GPS Location",
                        "event_or_place": f"Within {int(match['distance_meters'])}m",
                        "date": now.split('T')[0],
                        "match_score": "high",
                        "match_type": "gps_proximity",
                        "overlap_count": 1,
                        "latitude": data.latitude,
                        "longitude": data.longitude,
                        "distance_meters": match['distance_meters'],
                        "created_at": now
                    }
                    await db.crossings.insert_one(crossing)
                    matches_created += 1
    
    return GPSLocationResponse(
        id=ping['id'],
        user_id=current_user['id'],
        latitude=data.latitude,
        longitude=data.longitude,
        accuracy=data.accuracy,
        timestamp=timestamp,
        matches_found=matches_created
    )


@api_router.get("/gps/nearby", response_model=List[ProximityMatch])
async def get_nearby_users(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    max_distance: float = Query(1000, ge=50, le=5000),
    current_user: dict = Depends(get_current_user)
):
    """
    Get users who were recently near the given coordinates.
    """
    nearby = await find_nearby_users(
        current_user['id'],
        latitude,
        longitude,
        max_distance
    )
    
    # Enrich with user info
    results = []
    for match in nearby[:20]:  # Limit to 20
        user = await db.users.find_one(
            {"id": match['user_id']},
            {"_id": 0, "name": 1, "photo_url": 1}
        )
        
        if user:
            results.append(ProximityMatch(
                user_id=match['user_id'],
                user_name=user.get('name', 'Unknown'),
                user_photo=user.get('photo_url'),
                distance_meters=match['distance_meters'],
                proximity_level=match['proximity_level'],
                last_seen=match['last_seen'],
                is_mutual=False
            ))
    
    return results


@api_router.get("/gps/history")
async def get_gps_history(
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user)
):
    """Get user's GPS ping history"""
    pings = await db.gps_pings.find(
        {"user_id": current_user['id']},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return {"pings": pings, "count": len(pings)}


@api_router.delete("/gps/history")
async def clear_gps_history(current_user: dict = Depends(get_current_user)):
    """Clear user's GPS history (privacy feature)"""
    result = await db.gps_pings.delete_many({"user_id": current_user['id']})
    return {"deleted": result.deleted_count}


# ==================== BLUETOOTH PROXIMITY ====================

class BleEncounterRequest(BaseModel):
    other_user_id: str
    rssi: int  # Signal strength (-30 to -100 dBm typically)
    distance_estimate: Optional[float] = None  # Estimated distance in meters

@api_router.post("/ble/encounter")
async def record_ble_encounter(
    data: BleEncounterRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Record a Bluetooth Low Energy encounter between two users.
    This is called when two users' devices detect each other via BLE.
    """
    now = datetime.now(timezone.utc).isoformat()
    
    # Validate other user exists
    other_user = await db.users.find_one({"id": data.other_user_id}, {"_id": 0, "name": 1, "email": 1})
    if not other_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Don't allow self-encounters
    if data.other_user_id == current_user['id']:
        raise HTTPException(status_code=400, detail="Cannot record encounter with yourself")
    
    # Check for existing recent encounter (within last 30 minutes)
    thirty_mins_ago = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    existing = await db.ble_encounters.find_one({
        "user_id": current_user['id'],
        "other_user_id": data.other_user_id,
        "created_at": {"$gte": thirty_mins_ago}
    })
    
    if existing:
        # Update existing encounter with new signal strength
        await db.ble_encounters.update_one(
            {"_id": existing["_id"]},
            {"$set": {"rssi": data.rssi, "updated_at": now}}
        )
        return {"status": "updated", "encounter_id": existing.get("id")}
    
    # Estimate proximity level from RSSI
    if data.rssi >= -50:
        proximity_level = "immediate"  # < 1 meter
    elif data.rssi >= -70:
        proximity_level = "near"  # 1-3 meters
    elif data.rssi >= -85:
        proximity_level = "far"  # 3-10 meters
    else:
        proximity_level = "detected"  # > 10 meters
    
    # Create BLE encounter record
    encounter_id = str(uuid.uuid4())
    encounter = {
        "id": encounter_id,
        "user_id": current_user['id'],
        "other_user_id": data.other_user_id,
        "rssi": data.rssi,
        "distance_estimate": data.distance_estimate,
        "proximity_level": proximity_level,
        "created_at": now
    }
    await db.ble_encounters.insert_one(encounter)
    
    # Also create a crossing record for BLE encounters
    crossing_id = str(uuid.uuid4())
    crossing = {
        "id": crossing_id,
        "user_id": current_user['id'],
        "other_user_id": data.other_user_id,
        "other_user_name": other_user.get('name', 'Unknown'),
        "other_user_email": other_user.get('email', ''),
        "match_type": "bluetooth_proximity",
        "match_score": 100 if proximity_level == "immediate" else 80 if proximity_level == "near" else 60,
        "proximity_level": proximity_level,
        "location_name": "Nearby via Bluetooth",
        "created_at": now
    }
    await db.crossings.insert_one(crossing)
    
    return {
        "status": "created",
        "encounter_id": encounter_id,
        "crossing_id": crossing_id,
        "proximity_level": proximity_level
    }


@api_router.get("/ble/encounters")
async def get_ble_encounters(
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user)
):
    """Get user's Bluetooth encounter history"""
    encounters = await db.ble_encounters.find(
        {"user_id": current_user['id']},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Enrich with user info
    for encounter in encounters:
        other_user = await db.users.find_one(
            {"id": encounter['other_user_id']},
            {"_id": 0, "name": 1, "photo_url": 1}
        )
        if other_user:
            encounter['other_user_name'] = other_user.get('name', 'Unknown')
            encounter['other_user_photo'] = other_user.get('photo_url')
    
    return {"encounters": encounters, "count": len(encounters)}


@api_router.delete("/ble/encounters")
async def clear_ble_encounters(current_user: dict = Depends(get_current_user)):
    """Clear user's Bluetooth encounter history (privacy feature)"""
    result = await db.ble_encounters.delete_many({"user_id": current_user['id']})
    return {"deleted": result.deleted_count}


# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(response: Response, user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    user = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password_hash": hash_password(user_data.password),
        "avatar_url": None,
        "created_at": now,
        "email_verified": False,
        "onboarded": False
    }
    
    await db.users.insert_one(user)

    # Auto-issue an email verification code (logged + returned for now;
    # plug a real email provider later).
    await _issue_email_verification(user_data.email)

    # Fire-and-forget welcome email (never blocks signup)
    asyncio.create_task(send_welcome_email(user_data.email, user_data.name, user_id))
    
    token = create_token(user_id, user_data.email)
    
    # Set httpOnly cookie for secure storage
    set_auth_cookie(response, token)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            name=user_data.name,
            photo_url=None,
            avatar_url=None,
            created_at=now,
            email_verified=False,
            onboarded=False
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(response: Response, credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user['id'], user['email'])
    
    # Set httpOnly cookie for secure storage
    set_auth_cookie(response, token)
    
    photo = user.get('photo_url') or user.get('avatar_url')
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user['id'],
            email=user['email'],
            name=user['name'],
            photo_url=photo,
            avatar_url=photo,
            created_at=user['created_at'],
            email_verified=bool(user.get('email_verified', False)),
            onboarded=bool(user.get('onboarded', False)),
            ghost_mode=bool(user.get('ghost_mode', False)),
            is_founder=bool(user.get('is_founder', False)),
            founder_number=user.get('founder_number'),
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    # The DB stores the value under `photo_url`. Expose it under BOTH
    # `photo_url` (canonical) and `avatar_url` (legacy alias) so old
    # consumers keep working.
    photo = current_user.get('photo_url') or current_user.get('avatar_url')
    return UserResponse(
        id=current_user['id'],
        email=current_user['email'],
        name=current_user['name'],
        photo_url=photo,
        avatar_url=photo,
        created_at=current_user['created_at'],
        ghost_mode=bool(current_user.get('ghost_mode', False)),
        email_verified=bool(current_user.get('email_verified', False)),
        onboarded=bool(current_user.get('onboarded', False)),
        is_founder=bool(current_user.get('is_founder', False)),
        founder_number=current_user.get('founder_number'),
    )

@api_router.post("/auth/logout")
async def logout(response: Response):
    """Logout user by clearing the auth cookie"""
    clear_auth_cookie(response)
    return {"message": "Logged out successfully"}

# ==================== EMAIL VERIFICATION ====================
class VerifyEmailRequest(BaseModel):
    code: str

async def _issue_email_verification(email: str) -> str:
    """Generate a 6-digit verification code, store it (15 min expiry), send via SMTP if configured.
    Returns the code (caller may include it in API response only if SMTP is NOT active)."""
    code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
    record = {
        "email": email,
        "code": code,
        "used": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
    }
    await db.email_verifications.delete_many({"email": email})
    await db.email_verifications.insert_one(record)
    sent = await send_verification_email(email, code)
    if not sent:
        # Log it so dev/admin can grab it from server logs as a fallback
        logger.info(f"Email verification code for {email}: {code}")
    return code

@api_router.post("/auth/send-verification")
async def send_verification(current_user: dict = Depends(get_current_user)):
    """Generate (or refresh) an email verification code for the logged-in user."""
    if current_user.get('email_verified'):
        return {"message": "Email already verified", "already_verified": True}
    code = await _issue_email_verification(current_user['email'])
    payload = {"message": "Verification code sent" if email_provider_active() else "Verification code generated (email provider not configured)"}
    # Only expose the code in the response when there's no real email provider yet.
    if not email_provider_active():
        payload["demo_code"] = code
    return payload

@api_router.post("/auth/verify-email")
async def verify_email(data: VerifyEmailRequest, current_user: dict = Depends(get_current_user)):
    """Validate the 6-digit code and mark the user as verified."""
    if current_user.get('email_verified'):
        return {"message": "Email already verified", "verified": True}
    record = await db.email_verifications.find_one({
        "email": current_user['email'],
        "code": data.code.strip(),
        "used": False
    })
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")
    expires_at = datetime.fromisoformat(record['expires_at'].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Verification code has expired")
    await db.users.update_one(
        {"id": current_user['id']},
        {"$set": {"email_verified": True}}
    )
    await db.email_verifications.update_one(
        {"_id": record['_id']},
        {"$set": {"used": True}}
    )
    return {"message": "Email verified", "verified": True}

# ==================== ONBOARDING ====================
@api_router.post("/auth/complete-onboarding")
async def complete_onboarding(current_user: dict = Depends(get_current_user)):
    """Mark the user as having finished the welcome flow (idempotent)."""
    await db.users.update_one(
        {"id": current_user['id']},
        {"$set": {"onboarded": True}}
    )
    return {"onboarded": True}

# Password Reset Models
class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str

@api_router.post("/auth/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    """Generate a password reset code and store it"""
    user = await db.users.find_one({"email": data.email})
    if not user:
        # Don't reveal if email exists - just return success
        return {"message": "If an account exists, a reset code has been sent"}
    
    # Generate a 6-digit code using cryptographically secure random
    code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
    
    # Store the reset code with expiration (15 minutes)
    reset_record = {
        "email": data.email,
        "code": code,
        "used": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
    }
    
    # Remove any existing reset codes for this email
    await db.password_resets.delete_many({"email": data.email})
    await db.password_resets.insert_one(reset_record)
    
    # In production, you would send this code via email
    # For now, we log it (you can also store it to show in a test mode)
    logger.info(f"Password reset code for {data.email}: {code}")
    
    # For demo/testing purposes, we'll include the code in response
    # REMOVE THIS IN PRODUCTION - should only send via email
    return {
        "message": "Reset code sent to your email",
        "demo_code": code  # REMOVE IN PRODUCTION
    }

@api_router.post("/auth/reset-password")
async def reset_password(data: ResetPasswordRequest):
    """Reset password using the code"""
    # Find the reset record
    reset_record = await db.password_resets.find_one({
        "email": data.email,
        "code": data.code,
        "used": False
    })
    
    if not reset_record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")
    
    # Check if code is expired
    expires_at = datetime.fromisoformat(reset_record['expires_at'].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Reset code has expired")
    
    # Validate new password
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Update the user's password
    new_hash = hash_password(data.new_password)
    result = await db.users.update_one(
        {"email": data.email},
        {"$set": {"password_hash": new_hash}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Mark the reset code as used
    await db.password_resets.update_one(
        {"_id": reset_record['_id']},
        {"$set": {"used": True}}
    )
    
    return {"message": "Password reset successfully"}


# ==================== USER SEARCH ====================

@api_router.get("/users/search")
async def search_users(
    q: str,
    limit: int = 8,
    current_user: dict = Depends(get_current_user),
):
    """Find users by name, city, or bio. Excludes self + ghost-mode users.
    Used by the navbar quick-search popover."""
    query = (q or "").strip()
    if len(query) < 2:
        return []
    # Escape regex specials so user input can't break the query
    safe = re.escape(query)
    regex = {"$regex": safe, "$options": "i"}
    cursor = db.users.find(
        {
            "id": {"$ne": current_user["id"]},
            "ghost_mode": {"$ne": True},
            "$or": [
                {"name": regex},
                {"city": regex},
                {"bio": regex},
            ],
        },
        {"_id": 0, "id": 1, "name": 1, "photo_url": 1, "avatar_url": 1, "city": 1, "is_premium": 1, "bio": 1},
    ).limit(max(1, min(limit, 20)))
    results = []
    async for u in cursor:
        results.append({
            "user_id": u["id"],
            "name": u.get("name", "Unknown"),
            "photo_url": u.get("photo_url") or u.get("avatar_url"),
            "city": u.get("city"),
            "bio": (u.get("bio") or "")[:100],
            "is_premium": bool(u.get("is_premium")),
        })
    return results


# ==================== EMAIL PREFERENCES ====================
class EmailPrefsUpdate(BaseModel):
    crossings: Optional[bool] = None
    marketing: Optional[bool] = None
    welcome: Optional[bool] = None


@api_router.get("/email-prefs")
async def get_my_email_prefs(current_user: dict = Depends(get_current_user)):
    """Return the current user's email preferences (with defaults filled in)."""
    return await get_email_prefs(current_user["id"])


@api_router.patch("/email-prefs")
async def update_my_email_prefs(
    data: EmailPrefsUpdate, current_user: dict = Depends(get_current_user)
):
    """Update one or more email preferences."""
    updates = {k: v for k, v in data.dict().items() if v is not None}
    if not updates:
        return await get_email_prefs(current_user["id"])
    set_doc = {f"email_prefs.{k}": v for k, v in updates.items()}
    await db.users.update_one({"id": current_user["id"]}, {"$set": set_doc})
    return await get_email_prefs(current_user["id"])


# ============================================================
# Push notifications (FCM token registration + test send)
# ============================================================
class PushTokenRequest(BaseModel):
    token: str
    platform: Optional[str] = "android"  # "android" | "ios" | "web"


@api_router.post("/push/register")
async def register_push_token(
    data: PushTokenRequest, current_user: dict = Depends(get_current_user)
):
    """Register (or refresh) an FCM device token for the current user.
    Idempotent — duplicate tokens silently upsert."""
    if not data.token or len(data.token) < 20:
        raise HTTPException(status_code=400, detail="Invalid token")
    now = datetime.now(timezone.utc).isoformat()
    await db.push_tokens.update_one(
        {"token": data.token},
        {
            "$set": {
                "user_id": current_user["id"],
                "platform": data.platform or "android",
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    return {"ok": True, "push_enabled": push_provider_active()}


@api_router.delete("/push/register")
async def unregister_push_token(
    data: PushTokenRequest, current_user: dict = Depends(get_current_user)
):
    """Remove a device token (e.g. on logout)."""
    await db.push_tokens.delete_one(
        {"token": data.token, "user_id": current_user["id"]}
    )
    return {"ok": True}


@api_router.post("/push/test")
async def test_push(current_user: dict = Depends(get_current_user)):
    """Send a test push to all devices registered for the current user.
    Useful for debugging that the FCM pipeline works end-to-end."""
    if not push_provider_active():
        raise HTTPException(status_code=503, detail="Push provider not configured")
    sent = await send_push_to_user(
        current_user["id"],
        title="Hi Again",
        body="Test notification — your push setup works! 🌅",
        data={"type": "test"},
    )
    return {"sent": sent}




@api_router.get("/email-prefs/unsubscribe")
async def unsubscribe_email(token: str, type: Optional[str] = None):
    """One-click unsubscribe target. Public — token is HMAC-signed.
    Honors RFC 8058 (List-Unsubscribe-Post) when called with POST too."""
    parsed = _verify_unsub_token(token)
    if not parsed:
        return Response(
            content=_unsub_page("Invalid or expired link",
                                "This unsubscribe link is no longer valid. "
                                "You can manage email preferences inside the app."),
            media_type="text/html",
            status_code=400,
        )
    user_id, pref_type = parsed
    # Allow ?type=foo override only if it matches the signed type (defense in depth)
    if type and type != pref_type:
        return Response(
            content=_unsub_page("Invalid request", "Token / type mismatch."),
            media_type="text/html",
            status_code=400,
        )
    if pref_type == "verification":
        return Response(
            content=_unsub_page("Cannot unsubscribe",
                                "Verification emails are required for account security."),
            media_type="text/html",
            status_code=400,
        )
    await db.users.update_one(
        {"id": user_id}, {"$set": {f"email_prefs.{pref_type}": False}}
    )
    label = {"crossings": "crossing notifications",
             "marketing": "marketing & welcome emails",
             "welcome": "welcome emails"}.get(pref_type, pref_type)
    return Response(
        content=_unsub_page(
            "You're unsubscribed",
            f"You won't receive {label} from Hi Again anymore. "
            f"You can change this anytime from your <a href=\"{APP_URL}/profile\" "
            f"style=\"color: #fbbf24;\">profile settings</a>.",
        ),
        media_type="text/html",
    )


@api_router.post("/email-prefs/unsubscribe")
async def unsubscribe_email_post(token: str = Form(...), type: Optional[str] = Form(None)):
    """RFC 8058 one-click unsubscribe (Gmail/Apple Mail post the link)."""
    return await unsubscribe_email(token=token, type=type)


def _unsub_page(title: str, message_html: str) -> str:
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>{title} — Hi Again</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body {{ margin: 0; background: #0b0b14; color: #f5f5f5; font-family: -apple-system, 'Segoe UI', sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }}
  .card {{ max-width: 480px; background: #15151f; border: 1px solid #2a2a3a; border-radius: 16px; padding: 40px 32px; text-align: center; }}
  h1 {{ font-size: 24px; margin: 0 0 16px; color: #fff; font-family: 'Playfair Display', Georgia, serif; }}
  p {{ color: #aaa; line-height: 1.6; margin: 0 0 24px; }}
  a.btn {{ display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #f59e0b, #f97316); color: #fff; text-decoration: none; border-radius: 999px; font-weight: 600; }}
  .brand {{ color: #fbbf24; font-family: 'Playfair Display', Georgia, serif; font-size: 18px; margin-bottom: 24px; }}
</style></head>
<body><div class="card">
  <div class="brand">Hi Again</div>
  <h1>{title}</h1>
  <p>{message_html}</p>
  <a class="btn" href="{APP_URL}">Back to Hi Again</a>
</div></body></html>"""


# ==================== LOCATION ROUTES ====================

@api_router.post("/locations", response_model=LocationResponse)
async def add_location(location: LocationCreate, current_user: dict = Depends(get_current_user)):
    # Check tier limits (including earned extra locations from referrals)
    tier = await get_user_tier(current_user['id'])
    user = await db.users.find_one({"id": current_user['id']}, {"_id": 0, "earned_extra_locations": 1})
    extra_locations = user.get('earned_extra_locations', 0) if user else 0
    max_locations = tier['max_locations'] + extra_locations
    
    location_count = await db.locations.count_documents({"user_id": current_user['id']})
    
    if location_count >= max_locations:
        raise HTTPException(
            status_code=403, 
            detail=f"Location limit reached ({max_locations}). Upgrade to Premium or invite friends for more!"
        )
    
    now = datetime.now(timezone.utc).isoformat()
    
    loc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user['id'],
        "city": location.city,
        "event_or_place": location.event_or_place,
        "date": location.date or now.split('T')[0],
        "description": location.description,
        "created_at": now
    }
    
    await db.locations.insert_one(loc)
    
    # Check if this is the user's first location - process referral rewards
    if location_count == 0:
        await process_referral_rewards(current_user['id'])
    
    # Detect crossings
    await detect_crossings(current_user['id'], loc)
    
    return LocationResponse(**loc)

def _normalize_location_doc(loc: dict) -> dict:
    """Normalize legacy/Timeline-imported docs into the LocationResponse schema."""
    if not loc.get('event_or_place'):
        loc['event_or_place'] = loc.get('name') or 'Unknown place'
    if not loc.get('date'):
        ts = loc.get('timestamp') or loc.get('created_at') or ''
        loc['date'] = ts.split('T')[0] if ts else ''
    if not loc.get('city'):
        # Try to derive city from address-like name (e.g. "Cafe X, Brooklyn, NY")
        name = loc.get('name') or ''
        parts = [p.strip() for p in name.split(',') if p.strip()]
        loc['city'] = parts[1] if len(parts) >= 2 else 'Unknown'
    return loc


@api_router.get("/locations", response_model=List[LocationResponse])
async def get_locations(current_user: dict = Depends(get_current_user)):
    locations = await db.locations.find(
        {"user_id": current_user['id']}, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    return [LocationResponse(**_normalize_location_doc(loc)) for loc in locations]

@api_router.delete("/locations/{location_id}")
async def delete_location(location_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.locations.delete_one({
        "id": location_id,
        "user_id": current_user['id']
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Location not found")
    
    return {"message": "Location deleted"}

@api_router.post("/locations/import")
async def import_timeline(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Import location history from Google Timeline JSON export"""
    try:
        content = await file.read()
        data = json.loads(content)
        
        imported_count = 0
        locations_to_insert = []
        
        # Handle different Google Timeline export formats
        timeline_objects = data.get('timelineObjects', [])
        
        for obj in timeline_objects:
            place_visit = obj.get('placeVisit')
            if place_visit:
                location = place_visit.get('location', {})
                lat = location.get('latitudeE7')
                lon = location.get('longitudeE7')
                
                if lat and lon:
                    duration = place_visit.get('duration', {})
                    start_time = duration.get('startTimestamp') or duration.get('startTimestampMs')
                    
                    if start_time:
                        # Convert E7 format to decimal degrees
                        lat_decimal = lat / 1e7
                        lon_decimal = lon / 1e7
                        
                        # Parse timestamp
                        if isinstance(start_time, str):
                            timestamp = start_time
                        else:
                            timestamp = datetime.fromtimestamp(int(start_time) / 1000, tz=timezone.utc).isoformat()
                        
                        place_name = location.get('name') or location.get('address') or 'Unknown place'
                        address = location.get('address') or ''
                        # Try to extract city from address (e.g. "123 Main St, Brooklyn, NY 11201, USA")
                        addr_parts = [p.strip() for p in address.split(',') if p.strip()]
                        city = addr_parts[1] if len(addr_parts) >= 2 else (addr_parts[0] if addr_parts else 'Unknown')
                        date_str = timestamp.split('T')[0] if 'T' in timestamp else timestamp[:10]

                        loc = {
                            "id": str(uuid.uuid4()),
                            "user_id": current_user['id'],
                            "city": city,
                            "event_or_place": place_name,
                            "date": date_str,
                            "description": None,
                            "latitude": lat_decimal,
                            "longitude": lon_decimal,
                            "name": place_name,
                            "timestamp": timestamp,
                            "created_at": datetime.now(timezone.utc).isoformat()
                        }
                        locations_to_insert.append(loc)
                        imported_count += 1
        
        if locations_to_insert:
            await db.locations.insert_many(locations_to_insert)
            
            # Detect crossings for all imported locations
            for loc in locations_to_insert:
                await detect_crossings(current_user['id'], loc)
        
        return {"message": f"Imported {imported_count} locations", "count": imported_count}
    
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")
    except Exception as e:
        logger.error(f"Import error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

# ==================== CROSSING ROUTES ====================

@api_router.get("/crossings", response_model=List[CrossingResponse])
async def get_crossings(current_user: dict = Depends(get_current_user)):
    tier = await get_user_tier(current_user['id'])
    
    crossings = await db.crossings.find(
        {"user_id": current_user['id']},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    # Batch fetch premium status for all other users (fix N+1 query)
    other_user_ids = list(set(c['other_user_id'] for c in crossings))
    premium_subscriptions = await db.subscriptions.find({
        "user_id": {"$in": other_user_ids},
        "status": "active",
        "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}
    }, {"_id": 0, "user_id": 1}).to_list(1000)
    premium_user_ids = set(sub['user_id'] for sub in premium_subscriptions)

    # Ghost Mode: hide users who have ghost mode currently enabled
    ghost_users = await db.users.find(
        {"id": {"$in": other_user_ids}, "ghost_mode": True},
        {"_id": 0, "id": 1}
    ).to_list(1000)
    ghost_user_ids = {u['id'] for u in ghost_users}

    # Enhance crossings with premium status (skip ghosted users)
    enhanced_crossings = []
    for c in crossings:
        if c['other_user_id'] in ghost_user_ids:
            continue
        c['other_is_premium'] = c['other_user_id'] in premium_user_ids
        
        # If current user is free, blur contact info
        if tier['tier'] == 'free':
            c['other_user_email'] = c['other_user_email'][:3] + '***@***.com'
        
        enhanced_crossings.append(c)
    
    # Sort premium users to top
    enhanced_crossings.sort(key=lambda x: (not x.get('other_is_premium', False), x['created_at']), reverse=True)
    
    return [CrossingResponse(**c) for c in enhanced_crossings]

@api_router.get("/crossings/stats")
async def get_crossing_stats(current_user: dict = Depends(get_current_user)):
    total_crossings = await db.crossings.count_documents({"user_id": current_user['id']})
    
    # Count unique people crossed paths with
    pipeline = [
        {"$match": {"user_id": current_user['id']}},
        {"$group": {"_id": "$other_user_id"}},
        {"$count": "unique_people"}
    ]
    result = await db.crossings.aggregate(pipeline).to_list(1)
    unique_people = result[0]['unique_people'] if result else 0
    
    # Get most frequent location
    pipeline = [
        {"$match": {"user_id": current_user['id'], "location_name": {"$ne": None}}},
        {"$group": {"_id": "$location_name", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 1}
    ]
    result = await db.crossings.aggregate(pipeline).to_list(1)
    top_location = result[0]['_id'] if result else None
    
    total_locations = await db.locations.count_documents({"user_id": current_user['id']})
    
    return {
        "total_crossings": total_crossings,
        "unique_people": unique_people,
        "top_location": top_location,
        "total_locations": total_locations
    }

# ==================== SUGGESTED CROSSINGS (People You Might Have Crossed Paths With) ====================

class SuggestedCrossingResponse(BaseModel):
    id: str
    user_id: str
    name: str
    photo_url: Optional[str] = None
    bio: Optional[str] = None
    is_premium: bool = False
    reason: str  # Why they're suggested (e.g., "Both visited Miami", "Both attended concerts")
    shared_locations: List[str] = []
    match_strength: str = "possible"  # "likely", "possible", "maybe"

@api_router.get("/suggestions", response_model=List[SuggestedCrossingResponse])
async def get_suggested_crossings(current_user: dict = Depends(get_current_user)):
    """
    Get people you might have crossed paths with based on location similarities.
    This is FREE for all users - helps everyone discover potential connections.
    """
    # Get current user's locations
    my_locations = await db.locations.find(
        {"user_id": current_user['id']},
        {"_id": 0}
    ).to_list(100)
    
    if not my_locations:
        return []
    
    # Extract cities and events from user's history
    my_cities = set(loc.get('city', '').lower().strip() for loc in my_locations if loc.get('city'))
    my_events = set(loc.get('event_or_place', '').lower().strip() for loc in my_locations if loc.get('event_or_place'))
    my_dates = set(loc.get('date', '') for loc in my_locations if loc.get('date'))
    
    # Get users we've already crossed paths with (to exclude)
    existing_crossings = await db.crossings.find(
        {"user_id": current_user['id']},
        {"_id": 0, "other_user_id": 1}
    ).to_list(1000)
    crossed_user_ids = set(c['other_user_id'] for c in existing_crossings)
    crossed_user_ids.add(current_user['id'])  # Exclude self
    
    # Find other users' locations that match our cities or events
    suggestions = {}
    
    # Query for users in same cities
    for city in my_cities:
        if not city:
            continue
        other_locations = await db.locations.find(
            {
                "user_id": {"$nin": list(crossed_user_ids)},
                "city": {"$regex": f"^{city}$", "$options": "i"}
            },
            {"_id": 0}
        ).to_list(500)
        
        for loc in other_locations:
            user_id = loc['user_id']
            if user_id not in suggestions:
                suggestions[user_id] = {
                    "shared_cities": set(),
                    "shared_events": set(),
                    "same_date_matches": 0
                }
            suggestions[user_id]["shared_cities"].add(loc.get('city', ''))
            
            # Check if same date
            if loc.get('date') in my_dates:
                suggestions[user_id]["same_date_matches"] += 1
    
    # Query for users at same events/places
    for event in my_events:
        if not event or len(event) < 3:
            continue
        other_locations = await db.locations.find(
            {
                "user_id": {"$nin": list(crossed_user_ids)},
                "event_or_place": {"$regex": event, "$options": "i"}
            },
            {"_id": 0}
        ).to_list(500)
        
        for loc in other_locations:
            user_id = loc['user_id']
            if user_id not in suggestions:
                suggestions[user_id] = {
                    "shared_cities": set(),
                    "shared_events": set(),
                    "same_date_matches": 0
                }
            suggestions[user_id]["shared_events"].add(loc.get('event_or_place', ''))
    
    if not suggestions:
        return []
    
    # Get user details for suggestions
    suggested_user_ids = list(suggestions.keys())[:20]  # Limit to top 20
    users = await db.users.find(
        {"id": {"$in": suggested_user_ids}},
        {"_id": 0, "id": 1, "name": 1, "photo_url": 1, "bio": 1, "is_premium": 1}
    ).to_list(20)
    users_map = {u['id']: u for u in users}
    
    # Build response
    results = []
    for user_id, match_data in suggestions.items():
        if user_id not in users_map:
            continue
        
        user = users_map[user_id]
        shared_cities = list(match_data["shared_cities"])
        shared_events = list(match_data["shared_events"])
        same_dates = match_data["same_date_matches"]
        
        # Determine match strength and reason
        if same_dates > 0 and shared_events:
            match_strength = "likely"
            reason = f"Same event on same day: {shared_events[0]}"
        elif shared_events:
            match_strength = "likely"
            if len(shared_events) > 1:
                reason = f"Both visited: {', '.join(shared_events[:2])}"
            else:
                reason = f"Both visited {shared_events[0]}"
        elif same_dates > 0:
            match_strength = "possible"
            reason = f"Same city on same day: {shared_cities[0] if shared_cities else 'unknown'}"
        elif shared_cities:
            match_strength = "maybe"
            if len(shared_cities) > 1:
                reason = f"Both been to: {', '.join(shared_cities[:2])}"
            else:
                reason = f"Both been to {shared_cities[0]}"
        else:
            continue  # Skip if no meaningful match
        
        results.append(SuggestedCrossingResponse(
            id=str(uuid.uuid4()),
            user_id=user_id,
            name=user.get('name', 'Unknown'),
            photo_url=user.get('photo_url'),
            bio=user.get('bio'),
            is_premium=user.get('is_premium', False),
            reason=reason,
            shared_locations=shared_cities[:3] + shared_events[:3],
            match_strength=match_strength
        ))
    
    # Sort by match strength (likely > possible > maybe)
    strength_order = {"likely": 0, "possible": 1, "maybe": 2}
    results.sort(key=lambda x: strength_order.get(x.match_strength, 3))
    
    return results[:15]  # Return top 15 suggestions

# ==================== PROFILE VIEWS (Premium Feature) ====================

@api_router.post("/profile/{user_id}/view")
async def record_profile_view(user_id: str, current_user: dict = Depends(get_current_user)):
    """Record when someone views a profile.
    If the viewer has Ghost Mode enabled, the view is silently NOT recorded —
    the viewer can browse without revealing themselves in 'Who Viewed Me'."""
    if user_id == current_user['id']:
        return {"message": "Self view not recorded"}

    # Ghost Mode: don't record views for invisible browsers
    if current_user.get('ghost_mode'):
        return {"message": "View not recorded (ghost mode)"}

    # Record the view
    view = {
        "id": str(uuid.uuid4()),
        "profile_user_id": user_id,  # Who was viewed
        "viewer_user_id": current_user['id'],  # Who viewed
        "viewer_name": current_user['name'],
        "viewer_photo": current_user.get('photo_url'),
        "viewed_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Upsert - update if viewer already viewed today, otherwise insert
    await db.profile_views.update_one(
        {
            "profile_user_id": user_id,
            "viewer_user_id": current_user['id']
        },
        {"$set": view},
        upsert=True
    )
    
    return {"message": "View recorded"}

@api_router.get("/profile/viewers")
async def get_profile_viewers(current_user: dict = Depends(get_current_user)):
    """Get list of people who viewed your profile (Premium only)"""
    # Check if premium
    is_premium = await is_premium_user(current_user['id'])
    if not is_premium:
        raise HTTPException(
            status_code=403, 
            detail="This is a Premium feature. Upgrade to see who viewed your profile!"
        )
    
    # Get viewers from last 30 days
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    
    views = await db.profile_views.find(
        {
            "profile_user_id": current_user['id'],
            "viewed_at": {"$gte": thirty_days_ago}
        },
        {"_id": 0}
    ).sort("viewed_at", -1).to_list(100)
    
    # Format the response
    from datetime import datetime as dt
    viewers = []
    for view in views:
        viewed_at = view.get('viewed_at', '')
        try:
            viewed_dt = dt.fromisoformat(viewed_at.replace('Z', '+00:00'))
            time_diff = datetime.now(timezone.utc) - viewed_dt
            if time_diff.days > 0:
                time_str = f"{time_diff.days} days ago"
            elif time_diff.seconds > 3600:
                time_str = f"{time_diff.seconds // 3600} hours ago"
            else:
                time_str = f"{time_diff.seconds // 60} minutes ago"
        except (ValueError, TypeError):
            time_str = "recently"
        
        viewers.append({
            "id": view.get('viewer_user_id'),
            "name": view.get('viewer_name'),
            "photo_url": view.get('viewer_photo'),
            "viewed_at": time_str
        })
    
    return viewers

@api_router.get("/profile/viewers/count")
async def get_profile_viewers_count(current_user: dict = Depends(get_current_user)):
    """Get count of profile viewers (visible to all, details only for Premium)"""
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    
    count = await db.profile_views.count_documents({
        "profile_user_id": current_user['id'],
        "viewed_at": {"$gte": thirty_days_ago}
    })
    
    return {"count": count, "is_premium": await is_premium_user(current_user['id'])}


# ==================== PUBLIC USER PROFILE ====================

@api_router.get("/users/{user_id}/profile")
async def get_user_profile(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get a user's public profile - for viewing other users"""
    # Get the user
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check connection status between current user and target
    connection = await db.connections.find_one({
        "$or": [
            {"requester_id": current_user['id'], "target_id": user_id},
            {"requester_id": user_id, "target_id": current_user['id']}
        ]
    }, {"_id": 0})
    
    connection_status = None
    if connection:
        connection_status = connection.get('status')
    
    # Get common places (locations both users have visited)
    user_locations = await db.locations.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    current_user_locations = await db.locations.find({"user_id": current_user['id']}, {"_id": 0}).to_list(100)
    
    # Find overlapping locations
    common_places = []
    for loc in user_locations:
        for my_loc in current_user_locations:
            if loc.get('city') == my_loc.get('city') and loc.get('event') == my_loc.get('event'):
                common_places.append({
                    "city": loc.get('city'),
                    "event": loc.get('event'),
                    "date": loc.get('timestamp', loc.get('created_at')),
                    "overlap_count": 1
                })
                break
    
    # Get location and crossing counts
    location_count = await db.locations.count_documents({"user_id": user_id})
    crossing_count = await db.crossings.count_documents({"user_id": user_id})
    
    # Get recent posts (if any)
    recent_posts = await db.posts.find(
        {"user_id": user_id},
        {"_id": 0, "id": 1, "media_url": 1, "caption": 1, "created_at": 1}
    ).sort("created_at", -1).limit(6).to_list(6)
    
    # Check if target user is premium
    is_premium = await is_premium_user(user_id)
    
    return {
        "id": target_user['id'],
        "name": target_user.get('name', 'Unknown'),
        "email": target_user.get('email', ''),
        "photo_url": target_user.get('photo_url') or target_user.get('avatar_url'),
        "bio": target_user.get('bio'),
        "missed_connection": target_user.get('missed_connection'),
        "is_premium": is_premium,
        "location_count": location_count,
        "crossing_count": crossing_count,
        "created_at": target_user.get('created_at'),
        "connection_status": connection_status,
        "common_places": common_places[:10],  # Limit to 10
        "recent_posts": recent_posts,
        "gallery_privacy": target_user.get("gallery_privacy", "public")
    }


# ==================== CONNECTION ROUTES ====================

@api_router.post("/connections", response_model=ConnectionResponse)
async def create_connection(data: ConnectionCreate, current_user: dict = Depends(get_current_user)):
    # Check daily message limit for free users
    tier = await get_user_tier(current_user['id'])
    
    if tier['tier'] == 'free':
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()
        connections_today = await db.connections.count_documents({
            "requester_id": current_user['id'],
            "created_at": {"$gte": today_start}
        })
        
        if connections_today >= tier['max_messages_per_day']:
            raise HTTPException(
                status_code=403,
                detail=f"Free tier limited to {tier['max_messages_per_day']} connection requests per day. Upgrade to Premium for unlimited!"
            )
    
    # Filter contact info from message if free user
    message = data.message
    if message and tier['tier'] == 'free':
        if contains_contact_info(message):
            raise HTTPException(
                status_code=403,
                detail="Sharing contact information requires Premium. Upgrade to share phone numbers and social media!"
            )
    
    # Check if target user exists
    target_user = await db.users.find_one({"id": data.target_user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if connection already exists
    existing = await db.connections.find_one({
        "$or": [
            {"requester_id": current_user['id'], "target_id": data.target_user_id},
            {"requester_id": data.target_user_id, "target_id": current_user['id']}
        ]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Connection already exists")
    
    connection = {
        "id": str(uuid.uuid4()),
        "requester_id": current_user['id'],
        "requester_name": current_user['name'],
        "requester_email": current_user['email'],
        "requester_is_premium": await is_premium_user(current_user['id']),
        "target_id": data.target_user_id,
        "target_name": target_user['name'],
        "target_email": target_user['email'],
        "status": "pending",
        "message": message,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.connections.insert_one(connection)
    
    return ConnectionResponse(**connection)

@api_router.get("/connections", response_model=List[ConnectionResponse])
async def get_connections(current_user: dict = Depends(get_current_user)):
    connections = await db.connections.find({
        "$or": [
            {"requester_id": current_user['id']},
            {"target_id": current_user['id']}
        ]
    }, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    return [ConnectionResponse(**c) for c in connections]

@api_router.patch("/connections/{connection_id}")
async def update_connection(connection_id: str, status: str, current_user: dict = Depends(get_current_user)):
    if status not in ['accepted', 'rejected']:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    connection = await db.connections.find_one({
        "id": connection_id,
        "target_id": current_user['id'],
        "status": "pending"
    })
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection request not found")
    
    await db.connections.update_one(
        {"id": connection_id},
        {"$set": {"status": status}}
    )
    
    return {"message": f"Connection {status}"}

# ==================== PROFILE ROUTES ====================

@api_router.patch("/profile", response_model=UserResponse)
async def update_profile(data: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {}
    if data.name:
        update_data['name'] = data.name
    if data.avatar_url is not None:
        update_data['avatar_url'] = data.avatar_url
    if data.photo_url is not None:
        update_data['photo_url'] = data.photo_url
    if data.bio is not None:
        update_data['bio'] = data.bio
    if data.ghost_mode is not None:
        update_data['ghost_mode'] = bool(data.ghost_mode)
    
    if update_data:
        await db.users.update_one({"id": current_user['id']}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    photo = updated_user.get('photo_url') or updated_user.get('avatar_url')

    return UserResponse(
        id=updated_user['id'],
        email=updated_user['email'],
        name=updated_user['name'],
        photo_url=photo,
        avatar_url=photo,
        created_at=updated_user['created_at'],
        ghost_mode=bool(updated_user.get('ghost_mode', False))
    )

@api_router.post("/profile/photo")
async def upload_photo(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Upload profile photo - stores in object storage and persists only the URL."""
    try:
        content = await file.read()
        content_type = file.content_type or 'image/jpeg'

        # Image moderation
        verdict = await moderate_image(content, content_type)
        if not verdict["is_safe"]:
            raise HTTPException(
                status_code=400,
                detail=f"Image rejected by moderation: {verdict.get('reason') or 'unsafe content'}"
            )

        photo_url = await store_media_blob(
            content=content,
            content_type=content_type,
            user_id=current_user['id'],
            media_kind="profile",
        )

        await db.users.update_one(
            {"id": current_user['id']},
            {"$set": {"photo_url": photo_url}}
        )

        return {"photo_url": photo_url, "message": "Photo uploaded successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


# ==================== GALLERY (Profile Albums) ====================
# Uploaded photos live in `gallery_photos`. Users can also view auto-pulled
# images from their posts via `recent_posts` on the user profile endpoint.

class GalleryPhoto(BaseModel):
    id: str
    user_id: str
    url: str
    caption: Optional[str] = None
    created_at: str


class GalleryPrivacyUpdate(BaseModel):
    privacy: str  # "public" | "crossings" | "connections" | "private"


VALID_GALLERY_PRIVACIES = {"public", "crossings", "connections", "private"}


async def _can_view_gallery(viewer_id: str, owner_id: str) -> bool:
    """Privacy check: can `viewer_id` see `owner_id`'s gallery?"""
    if viewer_id == owner_id:
        return True
    owner = await db.users.find_one({"id": owner_id}, {"_id": 0, "gallery_privacy": 1})
    privacy = (owner or {}).get("gallery_privacy", "public")
    if privacy == "public":
        return True
    if privacy == "private":
        return False
    if privacy == "connections":
        connection = await db.connections.find_one({
            "$or": [
                {"requester_id": viewer_id, "target_id": owner_id, "status": "accepted"},
                {"requester_id": owner_id, "target_id": viewer_id, "status": "accepted"},
            ]
        }, {"_id": 0})
        return bool(connection)
    if privacy == "crossings":
        crossing = await db.crossings.find_one(
            {"user_id": viewer_id, "other_user_id": owner_id}, {"_id": 0}
        )
        return bool(crossing)
    return False


@api_router.get("/gallery/{user_id}")
async def get_gallery(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get a user's gallery photos. Respects gallery_privacy."""
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "gallery_privacy": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if not await _can_view_gallery(current_user["id"], user_id):
        return {"photos": [], "privacy": target.get("gallery_privacy", "public"), "locked": True}

    photos = await db.gallery_photos.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return {
        "photos": photos,
        "privacy": target.get("gallery_privacy", "public"),
        "locked": False,
    }


@api_router.post("/gallery")
async def upload_gallery_photo(
    file: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    """Upload a photo to the current user's gallery (with image moderation)."""
    try:
        content = await file.read()
        content_type = file.content_type or "image/jpeg"

        verdict = await moderate_image(content, content_type)
        if not verdict["is_safe"]:
            raise HTTPException(
                status_code=400,
                detail=f"Image rejected by moderation: {verdict.get('reason') or 'unsafe content'}",
            )

        url = await store_media_blob(
            content=content,
            content_type=content_type,
            user_id=current_user["id"],
            media_kind="gallery",
        )

        photo = {
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "url": url,
            "caption": caption,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.gallery_photos.insert_one(photo)
        photo.pop("_id", None)
        return {"message": "Photo uploaded", "photo": photo}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Gallery upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@api_router.delete("/gallery/{photo_id}")
async def delete_gallery_photo(photo_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a photo from the current user's gallery."""
    result = await db.gallery_photos.delete_one(
        {"id": photo_id, "user_id": current_user["id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Photo not found")
    return {"message": "Photo deleted"}


@api_router.patch("/gallery/privacy")
async def update_gallery_privacy(
    data: GalleryPrivacyUpdate, current_user: dict = Depends(get_current_user)
):
    """Update the current user's gallery privacy setting."""
    if data.privacy not in VALID_GALLERY_PRIVACIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid privacy. Must be one of: {sorted(VALID_GALLERY_PRIVACIES)}",
        )
    await db.users.update_one(
        {"id": current_user["id"]}, {"$set": {"gallery_privacy": data.privacy}}
    )
    return {"privacy": data.privacy}


# ==================== DISCOVER (People You Might Know) ====================

class DiscoverCandidate(BaseModel):
    user_id: str
    name: str
    photo_url: Optional[str] = None
    photos: List[str] = []  # Additional photos from gallery (excluding photo_url)
    bio: Optional[str] = None
    city: Optional[str] = None
    is_premium: bool = False
    score: int
    reasons: List[str] = []


@api_router.get("/discover", response_model=List[DiscoverCandidate])
async def discover_people(current_user: dict = Depends(get_current_user)):
    """
    People You Might Know — ranked candidates based on:
      • same city as the user
      • mutual connections (friend-of-a-friend)
      • shared upcoming Gathering attendance
    Excludes: self, ghost-mode users, already-connected, already-crossed.
    """
    me_id = current_user["id"]
    me = await db.users.find_one({"id": me_id}, {"_id": 0})
    if not me:
        return []

    # ---- Build exclusion set ----
    exclude = {me_id}
    # already crossed
    async for c in db.crossings.find({"user_id": me_id}, {"_id": 0, "other_user_id": 1}):
        exclude.add(c["other_user_id"])
    # already connected (any state - request, accepted, blocked)
    async for conn in db.connections.find(
        {"$or": [{"requester_id": me_id}, {"target_id": me_id}]},
        {"_id": 0, "requester_id": 1, "target_id": 1},
    ):
        exclude.add(conn.get("requester_id"))
        exclude.add(conn.get("target_id"))

    # ---- Gather "my world" signals ----
    # Cities I've been to
    my_cities = set()
    async for loc in db.locations.find({"user_id": me_id}, {"_id": 0, "city": 1}):
        c = (loc.get("city") or "").strip()
        if c and c.lower() not in ("unknown", ""):
            my_cities.add(c.lower())
    if me.get("city"):
        my_cities.add(me["city"].lower().strip())

    # Friends (accepted connections only) → for friend-of-a-friend
    friend_ids = set()
    async for conn in db.connections.find(
        {"status": "accepted",
         "$or": [{"requester_id": me_id}, {"target_id": me_id}]},
        {"_id": 0, "requester_id": 1, "target_id": 1},
    ):
        friend_ids.add(conn.get("requester_id"))
        friend_ids.add(conn.get("target_id"))
    friend_ids.discard(me_id)

    # Gatherings I'm attending
    my_gathering_ids = []
    my_gathering_titles = {}
    async for g in db.gatherings.find(
        {"attendees": me_id}, {"_id": 0, "id": 1, "title": 1, "attendees": 1}
    ):
        my_gathering_ids.append(g["id"])
        my_gathering_titles[g["id"]] = g.get("title", "a gathering")

    # ---- Score candidates ----
    scores: dict = {}  # user_id → {"score": int, "reasons": [str]}

    def bump(uid, points, reason):
        if uid in exclude:
            return
        s = scores.setdefault(uid, {"score": 0, "reasons": []})
        s["score"] += points
        if reason and reason not in s["reasons"]:
            s["reasons"].append(reason)

    # Signal 1: Same city (no crossing yet)
    if my_cities:
        # Build $or with regex per city (case-insensitive). $in does not accept regex.
        city_or = [{"city": {"$regex": f"^{c}$", "$options": "i"}} for c in my_cities]
        users_in_city = db.users.find(
            {"$or": city_or, "ghost_mode": {"$ne": True}},
            {"_id": 0, "id": 1, "city": 1, "name": 1},
        )
        async for u in users_in_city:
            bump(u["id"], 50, f"Lives in {u.get('city', 'your city')}")
        # Also: anyone with a location in your city (e.g. visitor)
        async for loc in db.locations.find(
            {"$or": city_or, "user_id": {"$nin": list(exclude)}},
            {"_id": 0, "user_id": 1, "city": 1},
        ).limit(500):
            bump(loc["user_id"], 20, f"Been to {loc.get('city', 'your city')}")

    # Signal 1b: Been to the same event/place
    my_events = set()
    async for loc in db.locations.find({"user_id": me_id}, {"_id": 0, "event_or_place": 1}):
        ev = (loc.get("event_or_place") or "").strip()
        if ev and len(ev) > 2 and ev.lower() != "unknown place":
            my_events.add(ev)
    if my_events:
        event_or = [{"event_or_place": {"$regex": f"^{ev}$", "$options": "i"}} for ev in my_events]
        async for loc in db.locations.find(
            {"$or": event_or, "user_id": {"$nin": list(exclude)}},
            {"_id": 0, "user_id": 1, "event_or_place": 1},
        ).limit(500):
            bump(loc["user_id"], 35, f"Been to {loc.get('event_or_place')}")

    # Signal 2: Friend of a friend
    if friend_ids:
        async for conn in db.connections.find(
            {"status": "accepted",
             "$or": [
                 {"requester_id": {"$in": list(friend_ids)}},
                 {"target_id": {"$in": list(friend_ids)}},
             ]},
            {"_id": 0, "requester_id": 1, "target_id": 1},
        ):
            for uid in (conn.get("requester_id"), conn.get("target_id")):
                if uid in friend_ids or uid in exclude:
                    continue
                bump(uid, 30, "Mutual connection")

    # Signal 3: Same upcoming gathering
    if my_gathering_ids:
        async for g in db.gatherings.find(
            {"id": {"$in": my_gathering_ids}}, {"_id": 0, "id": 1, "attendees": 1, "title": 1}
        ):
            for uid in g.get("attendees", []):
                if uid in exclude:
                    continue
                bump(uid, 40, f"Attending {g.get('title', 'a gathering')}")

    if not scores:
        return []

    # Hydrate user info
    cand_ids = list(scores.keys())[:50]
    users_map = {}
    async for u in db.users.find(
        {"id": {"$in": cand_ids}, "ghost_mode": {"$ne": True}},
        {"_id": 0, "id": 1, "name": 1, "photo_url": 1, "bio": 1, "city": 1, "is_premium": 1, "gallery_privacy": 1},
    ):
        users_map[u["id"]] = u

    # Pre-fetch up to 4 public-gallery photos per candidate. Only owners with
    # gallery_privacy = public (or unset) leak gallery photos into Discover.
    public_owners = [
        uid for uid, u in users_map.items()
        if u.get("gallery_privacy") in (None, "public")
    ]
    photos_by_user: dict = {}
    if public_owners:
        async for p in db.gallery_photos.find(
            {"user_id": {"$in": public_owners}},
            {"_id": 0, "user_id": 1, "url": 1, "created_at": 1},
        ).sort("created_at", -1):
            uid = p["user_id"]
            arr = photos_by_user.setdefault(uid, [])
            if len(arr) < 4:
                arr.append(p["url"])

    results = []
    for uid, payload in scores.items():
        u = users_map.get(uid)
        if not u:
            continue
        gallery = photos_by_user.get(uid, [])
        # De-dup: drop any gallery photos identical to the profile photo
        primary = u.get("photo_url")
        extras = [p for p in gallery if p and p != primary][:4]
        results.append(DiscoverCandidate(
            user_id=uid,
            name=u.get("name", "Unknown"),
            photo_url=primary,
            photos=extras,
            bio=u.get("bio"),
            city=u.get("city"),
            is_premium=bool(u.get("is_premium")),
            score=payload["score"],
            reasons=payload["reasons"][:3],
        ))

    results.sort(key=lambda r: r.score, reverse=True)
    return results[:30]


# ==================== GDPR/PRIVACY COMPLIANCE ====================

@api_router.get("/account/export")
async def export_user_data(current_user: dict = Depends(get_current_user)):
    """Export all user data (GDPR Article 20 - Right to Data Portability)"""
    user_id = current_user['id']
    
    # Gather all user data
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    locations = await db.locations.find({"user_id": user_id}, {"_id": 0}).to_list(10000)
    crossings = await db.crossings.find({"user_id": user_id}, {"_id": 0}).to_list(10000)
    connections = await db.connections.find(
        {"$or": [{"requester_id": user_id}, {"target_id": user_id}]}, 
        {"_id": 0}
    ).to_list(10000)
    posts = await db.posts.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    gps_pings = await db.gps_pings.find({"user_id": user_id}, {"_id": 0}).to_list(10000)
    profile_views = await db.profile_views.find({"viewer_id": user_id}, {"_id": 0}).to_list(10000)
    
    export_data = {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "user_profile": user_data,
        "locations": locations,
        "path_crossings": crossings,
        "connections": connections,
        "posts": posts,
        "gps_history": gps_pings,
        "profile_views_made": profile_views
    }
    
    return export_data

@api_router.delete("/account")
async def delete_account(current_user: dict = Depends(get_current_user)):
    """Delete user account and all associated data (GDPR Article 17 - Right to Erasure)"""
    user_id = current_user['id']
    
    # Delete all user data from all collections
    deleted_counts = {
        "locations": (await db.locations.delete_many({"user_id": user_id})).deleted_count,
        "crossings": (await db.crossings.delete_many({"user_id": user_id})).deleted_count,
        "connections": (await db.connections.delete_many(
            {"$or": [{"requester_id": user_id}, {"target_id": user_id}]}
        )).deleted_count,
        "posts": (await db.posts.delete_many({"user_id": user_id})).deleted_count,
        "comments": (await db.comments.delete_many({"user_id": user_id})).deleted_count,
        "gps_pings": (await db.gps_pings.delete_many({"user_id": user_id})).deleted_count,
        "profile_views": (await db.profile_views.delete_many(
            {"$or": [{"viewer_id": user_id}, {"target_id": user_id}]}
        )).deleted_count,
        "subscriptions": (await db.subscriptions.delete_many({"user_id": user_id})).deleted_count,
        "referral_rewards": (await db.referral_rewards.delete_many({"user_id": user_id})).deleted_count,
        "password_resets": (await db.password_resets.delete_many({"email": current_user['email']})).deleted_count,
    }
    
    # Finally delete the user account
    await db.users.delete_one({"id": user_id})
    
    return {
        "message": "Account and all associated data have been permanently deleted",
        "deleted_records": deleted_counts
    }

# ==================== FEED/POST ROUTES ====================

@api_router.post("/posts", response_model=PostResponse)
async def create_post(
    file: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    is_private: bool = Form(False),
    current_user: dict = Depends(get_current_user)
):
    """Create a new post with photo or video"""
    try:
        # Check file size (limit to 10MB for base64)
        content = await file.read()
        max_size = 50 * 1024 * 1024  # 50MB (objstore-backed; larger ok now)

        if len(content) > max_size:
            raise HTTPException(status_code=400, detail="File too large. Maximum size is 50MB.")

        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Empty file uploaded")

        content_type = file.content_type or 'image/jpeg'

        # Validate content type
        allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
        if content_type not in allowed_types:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type}")

        # Determine media type
        media_type = "video" if content_type.startswith("video") else "image"

        # Image moderation (NSFW/violence). Fails open on any error.
        if media_type == "image":
            verdict = await moderate_image(content, content_type)
            if not verdict["is_safe"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Image rejected by moderation: {verdict.get('reason') or 'unsafe content'}"
                )

        media_url = await store_media_blob(
            content=content,
            content_type=content_type,
            user_id=current_user['id'],
            media_kind="post",
        )
        
        now = datetime.now(timezone.utc).isoformat()
        is_premium = await is_premium_user(current_user['id'])
        
        post = {
            "id": str(uuid.uuid4()),
            "user_id": current_user['id'],
            "user_name": current_user['name'],
            "user_photo": current_user.get('photo_url'),
            "is_premium": is_premium,
            "media_url": media_url,
            "media_type": media_type,
            "caption": caption,
            "location": location,
            "is_private": bool(is_private),
            "likes": [],
            "likes_count": 0,
            "comments_count": 0,
            "removed": False,
            "report_count": 0,
            "created_at": now
        }
        
        await db.posts.insert_one(post)
        logger.info(f"Post created: {post['id']} by user {current_user['id']}")
        
        return PostResponse(
            id=post['id'],
            user_id=post['user_id'],
            user_name=post['user_name'],
            user_photo=post['user_photo'],
            is_premium=post['is_premium'],
            media_url=post['media_url'],
            media_type=post['media_type'],
            caption=post['caption'],
            location=post['location'],
            likes_count=post['likes_count'],
            comments_count=post['comments_count'],
            liked_by_me=False,
            is_private=post['is_private'],
            created_at=post['created_at']
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Post creation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create post: {str(e)}")

async def _get_blocked_user_ids(user_id: str) -> set:
    """User ids the current user has blocked (and vice versa, for symmetric hiding)."""
    blocked = set()
    async for b in db.blocks.find(
        {"$or": [{"blocker_id": user_id}, {"blocked_id": user_id}]},
        {"_id": 0, "blocker_id": 1, "blocked_id": 1},
    ):
        blocked.add(b["blocker_id"])
        blocked.add(b["blocked_id"])
    blocked.discard(user_id)
    return blocked


def _post_to_response(post: dict, current_user_id: str) -> PostResponse:
    liked_by_me = current_user_id in (post.get('likes') or [])
    return PostResponse(
        id=post['id'],
        user_id=post['user_id'],
        user_name=post['user_name'],
        user_photo=post.get('user_photo'),
        is_premium=post.get('is_premium', False),
        media_url=post['media_url'],
        media_type=post['media_type'],
        caption=post.get('caption'),
        location=post.get('location'),
        likes_count=post.get('likes_count', 0),
        comments_count=post.get('comments_count', 0),
        liked_by_me=liked_by_me,
        is_private=bool(post.get('is_private')),
        created_at=post['created_at'],
    )


@api_router.get("/posts/feed", response_model=List[PostResponse])
async def get_feed(current_user: dict = Depends(get_current_user)):
    """Connections-only feed: only posts from people you've crossed paths with."""
    crossings = await db.crossings.find(
        {"user_id": current_user['id']}, {"_id": 0, "other_user_id": 1}
    ).to_list(1000)
    crossed_user_ids = [c['other_user_id'] for c in crossings]
    crossed_user_ids.append(current_user['id'])
    blocked = await _get_blocked_user_ids(current_user['id'])
    crossed_user_ids = [uid for uid in crossed_user_ids if uid not in blocked]
    posts = await db.posts.find(
        {"user_id": {"$in": crossed_user_ids}, "removed": {"$ne": True}},
        {"_id": 0},
    ).sort("created_at", -1).to_list(100)
    return [_post_to_response(p, current_user['id']) for p in posts]


@api_router.get("/posts/explore", response_model=List[PostResponse])
async def get_explore_feed(
    current_user: dict = Depends(get_current_user),
    city: Optional[str] = None,
    near_me: bool = False,
    limit: int = 50,
    skip: int = 0,
):
    """Public feed: all posts from all users, EXCEPT:
       • posts marked is_private (visible to author + connections only)
       • posts from users you blocked (or who blocked you)
       • posts removed by admin
       • posts by ghost-mode users (their content stays private)
    Optional filters: city (regex match on post location) or near_me (~50mi
    radius from caller's most recent gps_ping)."""
    limit = max(1, min(limit, 100))
    skip = max(0, skip)
    blocked = await _get_blocked_user_ids(current_user['id'])

    # Ghost-mode users — exclude
    ghost_ids = set()
    async for u in db.users.find({"ghost_mode": True}, {"_id": 0, "id": 1}):
        ghost_ids.add(u["id"])

    excluded_ids = list(blocked | ghost_ids - {current_user['id']})

    query: dict = {
        "removed": {"$ne": True},
        "$or": [
            {"is_private": {"$ne": True}},
            {"user_id": current_user['id']},  # always show own posts
        ],
    }
    if excluded_ids:
        query["user_id"] = {"$nin": excluded_ids}

    # NEAR-ME: find author ids whose most recent gps_ping is within ~50mi of mine
    if near_me:
        me_ping = await db.gps_pings.find_one(
            {"user_id": current_user['id']},
            {"_id": 0, "latitude": 1, "longitude": 1},
            sort=[("timestamp", -1)],
        )
        if not me_ping:
            return []  # caller has no GPS history yet
        # ~50 miles ≈ 0.72° latitude (1° ≈ 69mi); use bounding box for cheap pre-filter
        lat = me_ping["latitude"]
        lon = me_ping["longitude"]
        delta = 0.72
        nearby_user_ids = set()
        async for ping in db.gps_pings.find(
            {
                "user_id": {"$ne": current_user['id']},
                "latitude": {"$gte": lat - delta, "$lte": lat + delta},
                "longitude": {"$gte": lon - delta, "$lte": lon + delta},
            },
            {"_id": 0, "user_id": 1},
        ).limit(500):
            nearby_user_ids.add(ping["user_id"])
        if not nearby_user_ids:
            return []
        # Combine with the $nin exclusion if it exists
        existing_filter = query.get("user_id", {})
        if isinstance(existing_filter, dict) and "$nin" in existing_filter:
            allowed = nearby_user_ids - set(existing_filter["$nin"])
            query["user_id"] = {"$in": list(allowed)}
        else:
            query["user_id"] = {"$in": list(nearby_user_ids)}

    if city:
        # Posts whose location string contains the city (case-insensitive)
        query["location"] = {"$regex": re.escape(city), "$options": "i"}

    posts = await db.posts.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [_post_to_response(p, current_user['id']) for p in posts]


@api_router.get("/posts/public-teaser")
async def get_public_teaser(limit: int = 3):
    """Anonymous-safe preview of recent public posts. No auth required.
    Returns lightly masked posts to encourage signups while previewing the vibe."""
    limit = max(1, min(limit, 10))
    ghost_ids = set()
    async for u in db.users.find({"ghost_mode": True}, {"_id": 0, "id": 1}):
        ghost_ids.add(u["id"])
    query = {"removed": {"$ne": True}, "is_private": {"$ne": True}}
    if ghost_ids:
        query["user_id"] = {"$nin": list(ghost_ids)}
    posts = await db.posts.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    teaser = []
    for p in posts:
        first_name = (p.get("user_name") or "Someone").split()[0]
        teaser.append({
            "id": p["id"],
            "user_first_name": first_name,
            "user_photo": p.get("user_photo"),
            "media_url": p["media_url"],
            "media_type": p["media_type"],
            "caption": p.get("caption"),
            "location": p.get("location"),
            "likes_count": p.get("likes_count", 0),
            "comments_count": p.get("comments_count", 0),
            "created_at": p["created_at"],
        })
    return teaser


# ==================== REPORT & BLOCK ====================

REPORT_AUTO_HIDE_THRESHOLD = 3  # 3 unique reports auto-hides a post pending review


@api_router.post("/posts/{post_id}/report")
async def report_post(
    post_id: str,
    data: ReportRequest,
    current_user: dict = Depends(get_current_user),
):
    """Report a post. 3 unique reports auto-hides it pending admin review."""
    post = await db.posts.find_one({"id": post_id}, {"_id": 0, "user_id": 1})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post["user_id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="You can't report your own post")

    # Dedup reports per (reporter, post)
    existing = await db.reports.find_one(
        {"reporter_id": current_user["id"], "target_type": "post", "target_id": post_id},
        {"_id": 0, "id": 1},
    )
    if existing:
        return {"message": "Already reported. Our team will review."}

    await db.reports.insert_one({
        "id": str(uuid.uuid4()),
        "reporter_id": current_user["id"],
        "target_type": "post",
        "target_id": post_id,
        "target_user_id": post["user_id"],
        "reason": data.reason[:280],
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    # Count unique reporters for this post
    count = await db.reports.count_documents(
        {"target_type": "post", "target_id": post_id}
    )
    update: dict = {"report_count": count}
    if count >= REPORT_AUTO_HIDE_THRESHOLD:
        update["removed"] = True
    await db.posts.update_one({"id": post_id}, {"$set": update})
    return {"message": "Thanks — we'll review this post."}


@api_router.post("/comments/{comment_id}/report")
async def report_comment(
    comment_id: str,
    data: ReportRequest,
    current_user: dict = Depends(get_current_user),
):
    comment = await db.comments.find_one({"id": comment_id}, {"_id": 0, "user_id": 1, "post_id": 1})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment["user_id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="You can't report your own comment")
    existing = await db.reports.find_one(
        {"reporter_id": current_user["id"], "target_type": "comment", "target_id": comment_id},
        {"_id": 0, "id": 1},
    )
    if existing:
        return {"message": "Already reported."}
    await db.reports.insert_one({
        "id": str(uuid.uuid4()),
        "reporter_id": current_user["id"],
        "target_type": "comment",
        "target_id": comment_id,
        "target_user_id": comment["user_id"],
        "post_id": comment.get("post_id"),
        "reason": data.reason[:280],
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"message": "Thanks — we'll review this comment."}


@api_router.post("/users/{user_id}/block")
async def block_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Block another user. Hides their content for you (and yours for them)."""
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="You can't block yourself")
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    existing = await db.blocks.find_one(
        {"blocker_id": current_user["id"], "blocked_id": user_id}, {"_id": 0, "id": 1}
    )
    if existing:
        return {"message": "Already blocked"}
    await db.blocks.insert_one({
        "id": str(uuid.uuid4()),
        "blocker_id": current_user["id"],
        "blocked_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"message": "User blocked"}


@api_router.delete("/users/{user_id}/block")
async def unblock_user(user_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.blocks.delete_one(
        {"blocker_id": current_user["id"], "blocked_id": user_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not blocked")
    return {"message": "User unblocked"}


@api_router.get("/users/blocked")
async def get_blocked_users(current_user: dict = Depends(get_current_user)):
    """List users the current user has blocked."""
    blocks = await db.blocks.find(
        {"blocker_id": current_user["id"]}, {"_id": 0}
    ).to_list(500)
    user_ids = [b["blocked_id"] for b in blocks]
    if not user_ids:
        return []
    users = await db.users.find(
        {"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "name": 1, "photo_url": 1}
    ).to_list(500)
    return users




@api_router.get("/posts/user/{user_id}", response_model=List[PostResponse])
async def get_user_posts(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get posts from a specific user"""
    posts = await db.posts.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    result = []
    for post in posts:
        liked_by_me = current_user['id'] in post.get('likes', [])
        result.append(PostResponse(
            id=post['id'],
            user_id=post['user_id'],
            user_name=post['user_name'],
            user_photo=post.get('user_photo'),
            is_premium=post.get('is_premium', False),
            media_url=post['media_url'],
            media_type=post['media_type'],
            caption=post.get('caption'),
            location=post.get('location'),
            likes_count=post.get('likes_count', 0),
            comments_count=post.get('comments_count', 0),
            liked_by_me=liked_by_me,
            created_at=post['created_at']
        ))
    
    return result

@api_router.post("/posts/{post_id}/like")
async def like_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Like or unlike a post"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    likes = post.get('likes', [])
    
    if current_user['id'] in likes:
        # Unlike
        likes.remove(current_user['id'])
        action = "unliked"
    else:
        # Like
        likes.append(current_user['id'])
        action = "liked"
    
    await db.posts.update_one(
        {"id": post_id},
        {"$set": {"likes": likes, "likes_count": len(likes)}}
    )
    
    return {"action": action, "likes_count": len(likes)}

@api_router.post("/posts/{post_id}/comments", response_model=CommentResponse)
async def create_comment(post_id: str, data: CommentCreate, current_user: dict = Depends(get_current_user)):
    """Add a comment to a post"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    comment = {
        "id": str(uuid.uuid4()),
        "post_id": post_id,
        "user_id": current_user['id'],
        "user_name": current_user['name'],
        "user_photo": current_user.get('photo_url'),
        "text": data.text,
        "created_at": now
    }
    
    await db.comments.insert_one(comment)
    
    # Update comment count
    await db.posts.update_one(
        {"id": post_id},
        {"$inc": {"comments_count": 1}}
    )
    
    return CommentResponse(**comment)

@api_router.get("/posts/{post_id}/comments", response_model=List[CommentResponse])
async def get_comments(post_id: str, current_user: dict = Depends(get_current_user)):
    """Get comments for a post"""
    comments = await db.comments.find(
        {"post_id": post_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return [CommentResponse(**c) for c in comments]

@api_router.delete("/posts/{post_id}")
async def delete_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a post"""
    result = await db.posts.delete_one({
        "id": post_id,
        "user_id": current_user['id']
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Post not found or not authorized")
    
    # Also delete comments
    await db.comments.delete_many({"post_id": post_id})
    
    return {"message": "Post deleted"}

# ==================== HEALTH CHECK ====================

@api_router.get("/")
async def root():
    return {"message": "Hi Again API", "status": "running"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# ==================== DONATION ROUTES ====================

@api_router.get("/donations/packages")
async def get_donation_packages():
    """Get available donation packages"""
    return {
        "packages": [
            {"id": "coffee", "name": "Buy me a coffee", "amount": 5.00, "emoji": "☕"},
            {"id": "lunch", "name": "Buy me lunch", "amount": 10.00, "emoji": "🍕"},
            {"id": "dinner", "name": "Buy me dinner", "amount": 25.00, "emoji": "🍽️"},
            {"id": "support", "name": "Super supporter", "amount": 50.00, "emoji": "💖"},
        ]
    }

# ==================== SUBSCRIPTION ROUTES ====================

@api_router.get("/subscription/plans")
async def get_subscription_plans():
    """Get available subscription plans (with USD + INR pricing)."""
    return {
        "plans": [
            {
                "id": "monthly",
                "name": "Premium Monthly",
                "price": PREMIUM_PLANS["monthly"]["prices"]["usd"],
                "prices": PREMIUM_PLANS["monthly"]["prices"],
                "duration": "month",
                "features": [
                    "Unlimited locations",
                    "See full profiles & contact info",
                    "Unlimited messages",
                    "See who viewed your profile",
                    "Verified badge ✓",
                    "Priority in search results",
                    "Profile boost"
                ]
            },
            {
                "id": "yearly",
                "name": "Premium Yearly",
                "price": PREMIUM_PLANS["yearly"]["prices"]["usd"],
                "prices": PREMIUM_PLANS["yearly"]["prices"],
                "duration": "year",
                "save_percent": 33,
                "features": [
                    "All monthly features",
                    "Save 33% vs monthly",
                    "Priority support",
                    "Early access to new features"
                ]
            }
        ],
        "currencies": sorted(SUPPORTED_CURRENCIES),
        "free_limits": {
            "max_locations": 3,
            "max_messages_per_day": 5,
            "contact_info": "Hidden until premium"
        }
    }

@api_router.get("/subscription/status")
async def get_subscription_status(current_user: dict = Depends(get_current_user)):
    """Get current user's subscription status"""
    tier = await get_user_tier(current_user['id'])
    
    subscription = await db.subscriptions.find_one({
        "user_id": current_user['id'],
        "status": "active"
    }, {"_id": 0})
    
    # Count today's messages
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()
    messages_today = await db.messages.count_documents({
        "sender_id": current_user['id'],
        "created_at": {"$gte": today_start}
    })
    
    # Count locations
    location_count = await db.locations.count_documents({"user_id": current_user['id']})
    
    return {
        **tier,
        "subscription": subscription,
        "usage": {
            "locations_used": location_count,
            "messages_today": messages_today
        }
    }

@api_router.post("/subscription/checkout")
async def create_subscription_checkout(request: Request, data: SubscriptionRequest, current_user: dict = Depends(get_current_user)):
    """Create a Stripe checkout session for subscription (USD or INR)."""
    if data.plan not in PREMIUM_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")

    currency = (data.currency or "usd").lower()
    if currency not in SUPPORTED_CURRENCIES:
        raise HTTPException(status_code=400, detail="Unsupported currency")

    plan = PREMIUM_PLANS[data.plan]
    amount = plan["prices"].get(currency)
    if amount is None:
        raise HTTPException(status_code=400, detail="Plan not priced in requested currency")

    try:
        success_url = f"{data.origin_url}/subscription/success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{data.origin_url}/premium"
        
        host_url = str(request.base_url).rstrip('/')
        webhook_url = f"{host_url}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        checkout_request = CheckoutSessionRequest(
            amount=amount,
            currency=currency,
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "user_id": current_user['id'],
                "plan": data.plan,
                "type": "subscription",
                "currency": currency,
            }
        )
        
        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Store pending subscription
        await db.pending_subscriptions.insert_one({
            "session_id": session.session_id,
            "user_id": current_user['id'],
            "plan": data.plan,
            "amount": amount,
            "currency": currency,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {"checkout_url": session.url, "session_id": session.session_id}
    
    except Exception as e:
        logger.error(f"Subscription error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Payment error: {str(e)}")

@api_router.get("/subscription/activate/{session_id}")
async def activate_subscription(session_id: str, current_user: dict = Depends(get_current_user)):
    """Activate subscription after successful payment"""
    try:
        # Check pending subscription
        pending = await db.pending_subscriptions.find_one({
            "session_id": session_id,
            "user_id": current_user['id']
        })
        
        if not pending:
            raise HTTPException(status_code=404, detail="Subscription not found")
        
        plan = PREMIUM_PLANS.get(pending['plan'])
        if not plan:
            raise HTTPException(status_code=400, detail="Invalid plan")
        
        # Create active subscription
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=plan['duration_days'])
        
        subscription = {
            "id": str(uuid.uuid4()),
            "user_id": current_user['id'],
            "plan": pending['plan'],
            "status": "active",
            "amount": pending.get('amount'),
            "currency": pending.get('currency', 'usd'),
            "started_at": now.isoformat(),
            "expires_at": expires_at.isoformat(),
            "session_id": session_id
        }
        
        # Deactivate old subscriptions
        await db.subscriptions.update_many(
            {"user_id": current_user['id'], "status": "active"},
            {"$set": {"status": "replaced"}}
        )
        
        await db.subscriptions.insert_one(subscription)
        
        # Update user with verified badge
        await db.users.update_one(
            {"id": current_user['id']},
            {"$set": {"is_premium": True, "verified_badge": True}}
        )
        
        # Remove pending
        await db.pending_subscriptions.delete_one({"session_id": session_id})
        
        return {
            "message": "Subscription activated!",
            "expires_at": expires_at.isoformat(),
            "amount": subscription.get("amount"),
            "currency": subscription.get("currency", "usd"),
            "plan": pending['plan'],
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Activation error: {str(e)}")
        raise HTTPException(status_code=500, detail="Activation failed")

# ============================================================
# Promo Codes (free Premium for friends / beta testers)
# ============================================================
class PromoRedeemRequest(BaseModel):
    code: str

DEFAULT_PROMO_DAYS = 30

async def _ensure_seed_promos():
    """Make sure at least one share-ready code exists."""
    existing = await db.promo_codes.find_one({"code": "FRIENDS2026"})
    if existing:
        return
    await db.promo_codes.insert_one({
        "code": "FRIENDS2026",
        "days": DEFAULT_PROMO_DAYS,
        "max_uses": 0,
        "uses": 0,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

@api_router.post("/promo/redeem")
async def redeem_promo(data: PromoRedeemRequest, current_user: dict = Depends(get_current_user)):
    """Redeem a promo code for free Premium. One redemption per user per code."""
    await _ensure_seed_promos()
    raw = (data.code or "").strip().upper()
    if not raw:
        raise HTTPException(status_code=400, detail="Enter a code")

    promo = await db.promo_codes.find_one({"code": raw, "active": True})
    if not promo:
        raise HTTPException(status_code=404, detail="Invalid or inactive code")

    if promo.get("max_uses") and promo["max_uses"] > 0 and promo.get("uses", 0) >= promo["max_uses"]:
        raise HTTPException(status_code=400, detail="This code is fully redeemed")

    already = await db.promo_redemptions.find_one({
        "user_id": current_user["id"], "code": raw
    })
    if already:
        raise HTTPException(status_code=400, detail="You already used this code")

    days = int(promo.get("days") or DEFAULT_PROMO_DAYS)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=days)

    await db.subscriptions.update_many(
        {"user_id": current_user["id"], "status": "active"},
        {"$set": {"status": "replaced"}}
    )
    await db.subscriptions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "plan": "promo",
        "status": "active",
        "amount": 0,
        "started_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "promo_code": raw,
    })
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"is_premium": True, "verified_badge": True}}
    )
    await db.promo_redemptions.insert_one({
        "user_id": current_user["id"],
        "code": raw,
        "redeemed_at": now.isoformat(),
    })
    await db.promo_codes.update_one({"code": raw}, {"$inc": {"uses": 1}})

    return {
        "message": f"Success! Premium unlocked for {days} days",
        "expires_at": expires_at.isoformat(),
        "days": days,
    }

@api_router.post("/donations/checkout", response_model=DonationResponse)
async def create_donation_checkout(request: Request, data: DonationRequest):
    """Create a Stripe checkout session for donation"""
    if data.package_id not in DONATION_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package")
    
    amount = DONATION_PACKAGES[data.package_id]
    
    try:
        # Build URLs
        success_url = f"{data.origin_url}/donate/success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{data.origin_url}/donate"
        
        # Initialize Stripe
        host_url = str(request.base_url).rstrip('/')
        webhook_url = f"{host_url}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        # Create checkout session
        checkout_request = CheckoutSessionRequest(
            amount=amount,
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "package_id": data.package_id,
                "type": "donation"
            }
        )
        
        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Store transaction in database
        transaction = {
            "id": str(uuid.uuid4()),
            "session_id": session.session_id,
            "amount": amount,
            "currency": "usd",
            "package_id": data.package_id,
            "status": "pending",
            "payment_status": "initiated",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_transactions.insert_one(transaction)
        
        return DonationResponse(checkout_url=session.url, session_id=session.session_id)
    
    except Exception as e:
        logger.error(f"Stripe error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Payment error: {str(e)}")

@api_router.get("/donations/status/{session_id}")
async def get_donation_status(request: Request, session_id: str):
    """Get the status of a donation"""
    try:
        host_url = str(request.base_url).rstrip('/')
        webhook_url = f"{host_url}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
        
        # Update transaction in database
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "status": status.status,
                "payment_status": status.payment_status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {
            "status": status.status,
            "payment_status": status.payment_status,
            "amount": status.amount_total / 100,  # Convert from cents
            "currency": status.currency
        }
    except Exception as e:
        logger.error(f"Status check error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to check status")

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        
        host_url = str(request.base_url).rstrip('/')
        webhook_url = f"{host_url}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        # Update transaction based on webhook
        if webhook_response.session_id:
            await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {"$set": {
                    "status": webhook_response.payment_status,
                    "payment_status": webhook_response.payment_status,
                    "event_type": webhook_response.event_type,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        
        return {"status": "received"}
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        return {"status": "error"}


# ==================== GATHERINGS/EVENTS ====================

class GatheringCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str = "party"
    location: str
    city: str
    date: str
    time: str
    max_attendees: int = 20
    is_private: bool = False
    cover_image: Optional[str] = None

class RSVPRequest(BaseModel):
    attending: bool

@api_router.post("/gatherings")
async def create_gathering(data: GatheringCreate, current_user: dict = Depends(get_current_user)):
    """Create a new gathering/event"""
    now = datetime.now(timezone.utc).isoformat()
    gathering_id = str(uuid.uuid4())
    
    gathering = {
        "id": gathering_id,
        "host_id": current_user['id'],
        "host_name": current_user.get('name', 'Unknown'),
        "host_photo": current_user.get('photo_url'),
        "title": data.title,
        "description": data.description,
        "category": data.category,
        "location": data.location,
        "city": data.city,
        "date": data.date,
        "time": data.time,
        "max_attendees": data.max_attendees,
        "is_private": data.is_private,
        "cover_image": data.cover_image,
        "attendees": [current_user['id']],  # Host auto-attends
        "created_at": now
    }
    
    await db.gatherings.insert_one(gathering)
    
    return {"id": gathering_id, "message": "Gathering created successfully"}


@api_router.get("/gatherings")
async def get_gatherings(current_user: dict = Depends(get_current_user)):
    """Get all upcoming gatherings and user's own gatherings"""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    user_id = current_user['id']
    
    # Get user's connections for private events
    connections = await db.connections.find({
        "$or": [
            {"requester_id": user_id, "status": "accepted"},
            {"target_id": user_id, "status": "accepted"}
        ]
    }, {"_id": 0}).to_list(1000)
    
    connected_ids = set()
    for conn in connections:
        connected_ids.add(conn.get('requester_id'))
        connected_ids.add(conn.get('target_id'))
    connected_ids.discard(user_id)
    
    # Get upcoming public gatherings + private gatherings from connections
    all_gatherings = await db.gatherings.find({
        "date": {"$gte": now},
        "$or": [
            {"is_private": False},
            {"is_private": True, "host_id": {"$in": list(connected_ids)}},
            {"host_id": user_id}
        ]
    }, {"_id": 0}).sort("date", 1).to_list(50)
    
    # Enrich with attendee info and user status
    enriched = []
    for g in all_gatherings:
        attendee_ids = g.get('attendees', [])
        attendees_info = []
        for aid in attendee_ids[:5]:  # Limit to 5 for preview
            attendee = await db.users.find_one({"id": aid}, {"_id": 0, "name": 1, "photo_url": 1})
            if attendee:
                attendees_info.append(attendee)
        
        enriched.append({
            **g,
            "attendees": attendees_info,
            "attendee_count": len(attendee_ids),
            "is_attending": user_id in attendee_ids,
            "is_host": g.get('host_id') == user_id
        })
    
    # Get user's hosted gatherings
    my_gatherings = [g for g in enriched if g.get('is_host')]
    
    return {
        "upcoming": enriched,
        "my_gatherings": my_gatherings
    }


@api_router.get("/gatherings/{gathering_id}")
async def get_gathering(gathering_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific gathering"""
    gathering = await db.gatherings.find_one({"id": gathering_id}, {"_id": 0})
    if not gathering:
        raise HTTPException(status_code=404, detail="Gathering not found")
    
    # Check if user can view (private event check)
    if gathering.get('is_private') and gathering.get('host_id') != current_user['id']:
        # Check if connected
        connection = await db.connections.find_one({
            "$or": [
                {"requester_id": current_user['id'], "target_id": gathering['host_id'], "status": "accepted"},
                {"requester_id": gathering['host_id'], "target_id": current_user['id'], "status": "accepted"}
            ]
        })
        if not connection:
            raise HTTPException(status_code=403, detail="This is a private event")
    
    # Enrich with attendee info
    attendee_ids = gathering.get('attendees', [])
    attendees_info = []
    for aid in attendee_ids:
        attendee = await db.users.find_one({"id": aid}, {"_id": 0, "id": 1, "name": 1, "photo_url": 1})
        if attendee:
            attendees_info.append(attendee)
    
    return {
        **gathering,
        "attendees": attendees_info,
        "attendee_count": len(attendee_ids),
        "is_attending": current_user['id'] in attendee_ids,
        "is_host": gathering.get('host_id') == current_user['id']
    }


@api_router.post("/gatherings/{gathering_id}/rsvp")
async def rsvp_gathering(gathering_id: str, data: RSVPRequest, current_user: dict = Depends(get_current_user)):
    """RSVP to a gathering"""
    gathering = await db.gatherings.find_one({"id": gathering_id}, {"_id": 0})
    if not gathering:
        raise HTTPException(status_code=404, detail="Gathering not found")
    
    attendees = gathering.get('attendees', [])
    user_id = current_user['id']
    
    if data.attending:
        # Check if already attending
        if user_id in attendees:
            return {"status": "already_attending"}
        
        # Check if full
        if len(attendees) >= gathering.get('max_attendees', 20):
            raise HTTPException(status_code=400, detail="Event is full")
        
        # Add to attendees
        await db.gatherings.update_one(
            {"id": gathering_id},
            {"$addToSet": {"attendees": user_id}}
        )
        return {"status": "attending"}
    else:
        # Remove from attendees (can't remove host)
        if user_id == gathering.get('host_id'):
            raise HTTPException(status_code=400, detail="Host cannot un-RSVP")
        
        await db.gatherings.update_one(
            {"id": gathering_id},
            {"$pull": {"attendees": user_id}}
        )
        return {"status": "removed"}


@api_router.delete("/gatherings/{gathering_id}")
async def delete_gathering(gathering_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a gathering (host only)"""
    gathering = await db.gatherings.find_one({"id": gathering_id}, {"_id": 0})
    if not gathering:
        raise HTTPException(status_code=404, detail="Gathering not found")
    
    if gathering.get('host_id') != current_user['id']:
        raise HTTPException(status_code=403, detail="Only the host can delete this event")
    
    await db.gatherings.delete_one({"id": gathering_id})
    return {"status": "deleted"}

# ==================== PRIVATE CIRCLE ROUTES ====================

class CircleContactAdd(BaseModel):
    contacts: List[dict]  # [{name: str, phone_hash: str}]

class CircleContact(BaseModel):
    id: str
    user_id: str
    name: str
    phone_hash: str
    matched_user_id: Optional[str] = None
    created_at: str

@api_router.post("/circle/add")
async def add_to_circle(data: CircleContactAdd, current_user: dict = Depends(get_current_user)):
    """Add contacts to private circle (phone numbers already hashed client-side)"""
    added = []
    for contact in data.contacts:
        # Check if already in circle
        existing = await db.circle_contacts.find_one({
            "user_id": current_user['id'],
            "phone_hash": contact['phone_hash']
        })
        
        if not existing:
            circle_contact = {
                "id": str(uuid.uuid4()),
                "user_id": current_user['id'],
                "name": contact['name'],
                "phone_hash": contact['phone_hash'],
                "matched_user_id": None,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Check if any existing user has this phone hash
            matched_user = await db.users.find_one({"phone_hash": contact['phone_hash']})
            if matched_user:
                circle_contact['matched_user_id'] = matched_user['id']
            
            await db.circle_contacts.insert_one(circle_contact)
            added.append(circle_contact)
    
    return {"added": len(added), "message": f"Added {len(added)} contacts to your circle"}

@api_router.get("/circle", response_model=List[dict])
async def get_circle(current_user: dict = Depends(get_current_user)):
    """Get all contacts in user's private circle"""
    contacts = await db.circle_contacts.find(
        {"user_id": current_user['id']},
        {"_id": 0}
    ).to_list(100)
    
    # Enhance with matched user info
    enhanced = []
    for contact in contacts:
        if contact.get('matched_user_id'):
            matched = await db.users.find_one(
                {"id": contact['matched_user_id']},
                {"_id": 0, "name": 1, "photo_url": 1}
            )
            if matched:
                contact['matched_user_name'] = matched.get('name')
                contact['matched_user_photo'] = matched.get('photo_url')
        enhanced.append(contact)
    
    return enhanced

@api_router.delete("/circle/{contact_id}")
async def remove_from_circle(contact_id: str, current_user: dict = Depends(get_current_user)):
    """Remove a contact from private circle"""
    result = await db.circle_contacts.delete_one({
        "id": contact_id,
        "user_id": current_user['id']
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    return {"message": "Contact removed from circle"}

# ==================== MEDIA UPLOAD ROUTES ====================

ALLOWED_MEDIA_TYPES = {
    "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp",
    "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm"
}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

@api_router.post("/media/upload")
async def upload_media(
    file: UploadFile = File(...),
    media_type: str = Form("promo"),  # promo, profile, post
    current_user: dict = Depends(get_current_user)
):
    """Upload media file to object storage (videos up to 50MB)"""
    # Validate content type
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_MEDIA_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type}")
    
    # Read file
    data = await file.read()
    
    # Validate size
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")
    
    # Generate storage path
    ext = ALLOWED_MEDIA_TYPES[content_type]
    file_id = str(uuid.uuid4())
    path = f"{APP_NAME}/{media_type}/{current_user['id']}/{file_id}.{ext}"
    
    try:
        # Upload to object storage
        result = put_object(path, data, content_type)
        
        # Store reference in database
        media_record = {
            "id": file_id,
            "user_id": current_user['id'],
            "storage_path": result["path"],
            "original_filename": file.filename,
            "content_type": content_type,
            "size": result["size"],
            "media_type": media_type,
            "is_deleted": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.media_files.insert_one(media_record)
        
        return {
            "id": file_id,
            "path": result["path"],
            "size": result["size"],
            "url": f"/api/media/{file_id}"
        }
    except Exception as e:
        logger.error(f"Upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@api_router.get("/media/{media_id}")
async def get_media(
    media_id: str,
    authorization: str = Header(None),
    auth: str = Query(None)
):
    """Retrieve media file by ID"""
    # Find media record
    record = await db.media_files.find_one({
        "id": media_id,
        "is_deleted": False
    })
    
    if not record:
        raise HTTPException(status_code=404, detail="Media not found")
    
    try:
        data, content_type = get_object(record["storage_path"])
        return Response(
            content=data,
            media_type=record.get("content_type", content_type),
            headers={"Cache-Control": "public, max-age=86400"}  # Cache for 1 day
        )
    except Exception as e:
        logger.error(f"Media retrieval failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve media")

@api_router.get("/media/promo/video")
async def get_promo_video():
    """Get the main promo video for landing page"""
    record = await db.media_files.find_one({
        "media_type": "promo",
        "is_deleted": False
    }, sort=[("created_at", -1)])
    
    if not record:
        return {"video_url": None}
    
    return {"video_url": f"/api/media/{record['id']}"}

# ==================== REFERRAL SYSTEM ====================

def generate_referral_code(name: str) -> str:
    """Generate a unique referral code based on user's name"""
    # Take first 4 chars of name (uppercase) + 4 random chars
    name_part = ''.join(c for c in name.upper() if c.isalpha())[:4]
    if len(name_part) < 4:
        name_part = name_part.ljust(4, 'X')
    random_part = secrets.token_hex(2).upper()
    return f"{name_part}{random_part}"

# Referral reward tiers
REFERRAL_REWARDS = {
    1: {"premium_days": 3, "extra_locations": 3, "badge": None},
    3: {"premium_days": 7, "extra_locations": 5, "badge": None},
    5: {"premium_days": 30, "extra_locations": 10, "badge": "verified"},
    10: {"premium_days": 90, "extra_locations": 20, "badge": "super_referrer"}
}

class ReferralStatsResponse(BaseModel):
    referral_code: str
    total_referrals: int
    successful_referrals: int
    pending_referrals: int
    earned_premium_days: int
    earned_extra_locations: int
    has_verified_badge: bool
    next_tier: Optional[dict] = None
    share_url: str

class ReferralHistoryItem(BaseModel):
    id: str
    referred_name: str
    status: str  # 'pending', 'completed'
    reward_claimed: bool
    created_at: str
    completed_at: Optional[str] = None

@api_router.get("/referrals/stats", response_model=ReferralStatsResponse)
async def get_referral_stats(current_user: dict = Depends(get_current_user)):
    """Get user's referral statistics and code"""
    user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    
    # Get or create referral code
    referral_code = user.get('referral_code')
    if not referral_code:
        referral_code = generate_referral_code(user.get('name', 'USER'))
        # Ensure uniqueness
        while await db.users.find_one({"referral_code": referral_code}):
            referral_code = generate_referral_code(user.get('name', 'USER'))
        await db.users.update_one(
            {"id": current_user['id']},
            {"$set": {"referral_code": referral_code}}
        )
    
    # Count referrals
    total_referrals = await db.referrals.count_documents({"referrer_id": current_user['id']})
    successful_referrals = await db.referrals.count_documents({
        "referrer_id": current_user['id'],
        "status": "completed"
    })
    pending_referrals = total_referrals - successful_referrals
    
    # Calculate earned rewards
    earned_premium_days = user.get('earned_premium_days', 0)
    earned_extra_locations = user.get('earned_extra_locations', 0)
    has_verified_badge = user.get('referral_badge') in ['verified', 'super_referrer']
    
    # Determine next tier
    next_tier = None
    for threshold, rewards in sorted(REFERRAL_REWARDS.items()):
        if successful_referrals < threshold:
            referrals_needed = threshold - successful_referrals
            next_tier = {
                "referrals_needed": referrals_needed,
                "reward": rewards
            }
            break
    
    return ReferralStatsResponse(
        referral_code=referral_code,
        total_referrals=total_referrals,
        successful_referrals=successful_referrals,
        pending_referrals=pending_referrals,
        earned_premium_days=earned_premium_days,
        earned_extra_locations=earned_extra_locations,
        has_verified_badge=has_verified_badge,
        next_tier=next_tier,
        share_url=f"https://hiagain.xyz/r/{referral_code}"
    )

@api_router.get("/referrals/history", response_model=List[ReferralHistoryItem])
async def get_referral_history(current_user: dict = Depends(get_current_user)):
    """Get user's referral history"""
    referrals = await db.referrals.find(
        {"referrer_id": current_user['id']},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    history = []
    for ref in referrals:
        # Get referred user's name
        referred_user = await db.users.find_one(
            {"id": ref['referred_id']},
            {"_id": 0, "name": 1}
        )
        history.append(ReferralHistoryItem(
            id=ref['id'],
            referred_name=referred_user.get('name', 'Unknown') if referred_user else 'Unknown',
            status=ref['status'],
            reward_claimed=ref.get('reward_claimed', False),
            created_at=ref['created_at'],
            completed_at=ref.get('completed_at')
        ))
    
    return history

class ValidateReferralRequest(BaseModel):
    referral_code: str

@api_router.post("/referrals/validate")
async def validate_referral_code(data: ValidateReferralRequest):
    """Validate a referral code (public endpoint for registration)"""
    referrer = await db.users.find_one(
        {"referral_code": data.referral_code.upper()},
        {"_id": 0, "id": 1, "name": 1}
    )
    
    if not referrer:
        return {"valid": False, "message": "Invalid referral code"}
    
    return {
        "valid": True,
        "referrer_name": referrer.get('name', 'A friend'),
        "bonus": "You'll both get rewards when you log your first location!"
    }

class ApplyReferralRequest(BaseModel):
    referral_code: str

@api_router.post("/referrals/apply")
async def apply_referral_code(
    data: ApplyReferralRequest,
    current_user: dict = Depends(get_current_user)
):
    """Apply a referral code to current user's account"""
    # Check if user already used a referral code
    existing = await db.referrals.find_one({"referred_id": current_user['id']})
    if existing:
        raise HTTPException(status_code=400, detail="You've already used a referral code")
    
    # Find referrer
    referrer = await db.users.find_one(
        {"referral_code": data.referral_code.upper()},
        {"_id": 0, "id": 1, "name": 1}
    )
    
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    
    if referrer['id'] == current_user['id']:
        raise HTTPException(status_code=400, detail="You cannot use your own referral code")
    
    # Create referral record (pending until first location)
    referral = {
        "id": str(uuid.uuid4()),
        "referrer_id": referrer['id'],
        "referred_id": current_user['id'],
        "referral_code": data.referral_code.upper(),
        "status": "pending",
        "reward_claimed": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.referrals.insert_one(referral)
    
    # Mark user as referred
    await db.users.update_one(
        {"id": current_user['id']},
        {"$set": {"referred_by": referrer['id'], "referral_code_used": data.referral_code.upper()}}
    )
    
    return {
        "success": True,
        "message": f"Referral from {referrer.get('name', 'a friend')} applied! Log your first location to unlock rewards for both of you."
    }

async def process_referral_rewards(user_id: str):
    """Process referral rewards when a referred user logs their first location"""
    # Find pending referral for this user
    referral = await db.referrals.find_one({
        "referred_id": user_id,
        "status": "pending"
    })
    
    if not referral:
        return
    
    # Mark as completed
    await db.referrals.update_one(
        {"id": referral['id']},
        {"$set": {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Count referrer's total successful referrals
    referrer_id = referral['referrer_id']
    successful_count = await db.referrals.count_documents({
        "referrer_id": referrer_id,
        "status": "completed"
    })
    
    # Determine rewards based on milestones
    reward_premium_days = 0
    reward_extra_locations = 0
    reward_badge = None
    
    for threshold, rewards in sorted(REFERRAL_REWARDS.items()):
        if successful_count >= threshold:
            reward_premium_days = rewards["premium_days"]
            reward_extra_locations = rewards["extra_locations"]
            if rewards["badge"]:
                reward_badge = rewards["badge"]
    
    # Apply rewards to referrer
    update_data = {
        "$inc": {
            "earned_premium_days": reward_premium_days,
            "earned_extra_locations": reward_extra_locations
        }
    }
    if reward_badge:
        update_data["$set"] = {"referral_badge": reward_badge}
    
    await db.users.update_one({"id": referrer_id}, update_data)
    
    # Also give bonus to the referred user (3 days premium + 2 extra locations)
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"earned_premium_days": 3, "earned_extra_locations": 2}}
    )
    
    # Mark reward as claimed
    await db.referrals.update_one(
        {"id": referral['id']},
        {"$set": {"reward_claimed": True}}
    )

@api_router.get("/referrals/leaderboard")
async def get_referral_leaderboard():
    """Get top referrers (public)"""
    pipeline = [
        {"$match": {"status": "completed"}},
        {"$group": {"_id": "$referrer_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    top_referrers = await db.referrals.aggregate(pipeline).to_list(10)
    
    leaderboard = []
    for i, item in enumerate(top_referrers):
        user = await db.users.find_one(
            {"id": item['_id']},
            {"_id": 0, "name": 1, "referral_badge": 1}
        )
        if user:
            # Anonymize name (first name + last initial)
            name_parts = user.get('name', 'Anonymous').split()
            display_name = name_parts[0] if name_parts else 'Anonymous'
            if len(name_parts) > 1:
                display_name += f" {name_parts[-1][0]}."
            
            leaderboard.append({
                "rank": i + 1,
                "name": display_name,
                "referrals": item['count'],
                "badge": user.get('referral_badge')
            })
    
    return {"leaderboard": leaderboard}

# Route to handle referral link landing
@api_router.get("/r/{referral_code}")
async def referral_landing(referral_code: str):
    """Handle referral link - redirect to register with code"""
    referrer = await db.users.find_one(
        {"referral_code": referral_code.upper()},
        {"_id": 0, "name": 1}
    )
    
    if referrer:
        return {
            "valid": True,
            "referrer_name": referrer.get('name', 'A friend'),
            "redirect": f"/register?ref={referral_code.upper()}"
        }
    
    return {"valid": False, "redirect": "/register"}


# ==================== FOUNDERS 60 ====================
# A controlled invite system for early-bird seeding. The first 60 redeemed
# codes grant: 12 months free Premium + permanent "Founding Member" badge
# (`is_founder: True` + `founder_number: <int>`).
#
# Codes are single-use. The owner generates a code via /admin/founders/codes
# (admin-only), then shares the URL `https://hiagain.xyz/invite/{code}` with
# the recruited person via DM/text. They click → see the founder pitch →
# sign up → automatic premium + badge applied.

FOUNDERS_LIMIT = 60
FOUNDER_PREMIUM_DAYS = 365


class FounderInviteResponse(BaseModel):
    code: str
    valid: bool
    redeemed: bool = False
    founder_number_if_redeemed: Optional[int] = None
    founders_taken: int
    founders_total: int = FOUNDERS_LIMIT
    invited_by: Optional[str] = None  # display name only
    pitch: str  # the marketing copy to show on the landing page


_FOUNDER_PITCH = (
    "You've been hand-picked as one of the first 60 founding members of Hi Again. "
    "Founders get a permanent gold badge on their profile, 12 months of Premium "
    "for free, and a say in the next features we build. We're only opening this "
    "to 60 people on day one. Reserve your slot below."
)


async def _founders_taken_count() -> int:
    return await db.users.count_documents({"is_founder": True})


@api_router.get("/founders/stats")
async def get_founders_stats():
    """Public counter for the landing page. Reveals how many founder slots
    have been claimed (no PII)."""
    taken = await _founders_taken_count()
    # Top cities by founder count (best effort — based on user's most recent
    # location). Used to render a `127 founders across NYC, LA, Austin` strap.
    pipeline = [
        {"$match": {"is_founder": True}},
        {"$lookup": {
            "from": "locations",
            "localField": "id",
            "foreignField": "user_id",
            "as": "locs",
        }},
        {"$unwind": {"path": "$locs", "preserveNullAndEmptyArrays": True}},
        {"$group": {"_id": "$locs.city", "count": {"$sum": 1}}},
        {"$match": {"_id": {"$ne": None}}},
        {"$sort": {"count": -1}},
        {"$limit": 5},
    ]
    cities = []
    try:
        async for row in db.users.aggregate(pipeline):
            cities.append({"city": row["_id"], "count": row["count"]})
    except Exception:
        cities = []
    return {
        "taken": taken,
        "total": FOUNDERS_LIMIT,
        "remaining": max(0, FOUNDERS_LIMIT - taken),
        "top_cities": cities,
    }


@api_router.get("/founders/invite/{code}", response_model=FounderInviteResponse)
async def lookup_founder_invite(code: str):
    """Public lookup for the /invite/{code} landing page.
    Returns whether the code is valid + the founder pitch."""
    code = code.upper().strip()
    invite = await db.founder_invites.find_one({"code": code}, {"_id": 0})
    taken = await _founders_taken_count()
    if not invite:
        return FounderInviteResponse(
            code=code, valid=False, founders_taken=taken,
            pitch=_FOUNDER_PITCH,
        )
    invited_by = None
    if invite.get("invited_by_user_id"):
        u = await db.users.find_one({"id": invite["invited_by_user_id"]},
                                    {"_id": 0, "name": 1})
        if u:
            invited_by = u.get("name")
    return FounderInviteResponse(
        code=code,
        valid=True,
        redeemed=bool(invite.get("redeemed_by_user_id")),
        founder_number_if_redeemed=invite.get("founder_number"),
        founders_taken=taken,
        invited_by=invited_by,
        pitch=_FOUNDER_PITCH,
    )


class FounderRedeemRequest(BaseModel):
    code: str


@api_router.post("/founders/redeem")
async def redeem_founder_invite(
    req: FounderRedeemRequest,
    current_user: dict = Depends(get_current_user),
):
    """Redeem a founder invite code on the currently-logged-in account.
    Atomically: validates the code, claims the next founder number, sets
    is_founder + founder_number + premium expiry on the user."""
    code = req.code.upper().strip()
    invite = await db.founder_invites.find_one({"code": code}, {"_id": 0})
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    if invite.get("redeemed_by_user_id"):
        if invite["redeemed_by_user_id"] == current_user["id"]:
            # idempotent
            return {
                "message": "Already redeemed by you",
                "founder_number": invite.get("founder_number"),
            }
        raise HTTPException(status_code=400, detail="This code has already been redeemed")

    # Check user isn't already a founder via a different code
    existing = await db.users.find_one(
        {"id": current_user["id"], "is_founder": True},
        {"_id": 0, "founder_number": 1},
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"You're already a founding member (#{existing.get('founder_number')})",
        )

    # Atomically claim the next founder number
    taken = await _founders_taken_count()
    if taken >= FOUNDERS_LIMIT:
        raise HTTPException(status_code=400, detail="All 60 founder slots have been claimed")
    founder_number = taken + 1
    now = datetime.now(timezone.utc)
    expiry = now + timedelta(days=FOUNDER_PREMIUM_DAYS)

    # Update user
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "is_founder": True,
            "founder_number": founder_number,
            "founder_redeemed_at": now.isoformat(),
            "subscription_tier": "premium",
            "subscription_source": "founder",
            "subscription_expires_at": expiry.isoformat(),
        }},
    )

    # Mark the invite as redeemed
    await db.founder_invites.update_one(
        {"code": code},
        {"$set": {
            "redeemed_by_user_id": current_user["id"],
            "redeemed_at": now.isoformat(),
            "founder_number": founder_number,
        }},
    )

    return {
        "message": "Welcome, founding member!",
        "founder_number": founder_number,
        "premium_expires_at": expiry.isoformat(),
    }


# Admin-only: list founder invite codes + generate new ones
@api_router.get("/admin/founders/codes")
async def list_founder_codes(current_user: dict = Depends(get_current_user)):
    if current_user.get("email") not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Admin only")
    cursor = db.founder_invites.find({}, {"_id": 0}).sort("code", 1)
    codes = []
    async for inv in cursor:
        # Resolve redeemer name if any
        name = None
        if inv.get("redeemed_by_user_id"):
            u = await db.users.find_one(
                {"id": inv["redeemed_by_user_id"]},
                {"_id": 0, "name": 1, "email": 1},
            )
            if u:
                name = u.get("name") or u.get("email")
        codes.append({
            "code": inv["code"],
            "redeemed": bool(inv.get("redeemed_by_user_id")),
            "redeemed_by_name": name,
            "redeemed_at": inv.get("redeemed_at"),
            "founder_number": inv.get("founder_number"),
            "share_url": f"https://hiagain.xyz/invite/{inv['code']}",
        })
    return {"codes": codes, "total": len(codes)}


@api_router.post("/admin/founders/seed")
async def seed_founder_codes(current_user: dict = Depends(get_current_user)):
    """Idempotent seeder: ensures FOUNDER01..FOUNDER60 exist in the DB."""
    if current_user.get("email") not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Admin only")
    created = 0
    for i in range(1, FOUNDERS_LIMIT + 1):
        code = f"FOUNDER{i:02d}"
        existing = await db.founder_invites.find_one({"code": code}, {"_id": 0})
        if existing:
            continue
        await db.founder_invites.insert_one({
            "code": code,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "invited_by_user_id": current_user["id"],
            "redeemed_by_user_id": None,
            "redeemed_at": None,
            "founder_number": None,
        })
        created += 1
    total = await db.founder_invites.count_documents({})
    return {"message": "Seeded", "created": created, "total_in_db": total}


# ============================================================
# Admin: Secure Code Export (Plan B for blocked GitHub pushes)
# ============================================================
ADMIN_EMAILS = {"hiagainxyz@gmail.com"}
EXPORT_TOKEN = os.environ.get("EXPORT_TOKEN", "")

EXCLUDED_DIRS = {
    "node_modules", "venv", ".venv", "__pycache__", ".git", ".next",
    "build", "dist", ".cache", ".idea", ".vscode", ".gradle",
    "captures", ".externalNativeBuild", ".cxx",
}
EXCLUDED_FILE_NAMES = {".env", ".env.local", ".env.production", ".env.development"}
EXCLUDED_EXTS = {".pyc", ".pyo", ".log", ".keystore", ".jks", ".aab", ".apk"}
INCLUDE_ANDROID_BUILD = False  # skip heavy build artifacts
MAX_FILE_BYTES = 25 * 1024 * 1024  # 25MB per-file safety cap


def _should_skip(rel_path: str, fname: str) -> bool:
    parts = set(rel_path.split(os.sep))
    if parts & EXCLUDED_DIRS:
        return True
    if fname in EXCLUDED_FILE_NAMES:
        return True
    ext = os.path.splitext(fname)[1].lower()
    if ext in EXCLUDED_EXTS:
        return True
    # Skip android build outputs but keep source
    if not INCLUDE_ANDROID_BUILD and "android" in parts and ("build" in parts or "intermediates" in parts):
        return True
    return False


@api_router.get("/admin/export-code")
async def export_code(
    request: Request,
    token: str = Query(..., description="Export token for additional protection"),
):
    """Stream a zip of /app source code. Plan B for blocked GitHub pushes.
    Gated by a strong secret token so it works from any browser without login."""
    if not EXPORT_TOKEN or not secrets.compare_digest(token, EXPORT_TOKEN):
        raise HTTPException(status_code=403, detail="Invalid export token")

    root = "/app"

    def iter_zip():
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
            for dirpath, dirnames, filenames in os.walk(root):
                # Prune excluded dirs in-place for performance
                dirnames[:] = [d for d in dirnames if d not in EXCLUDED_DIRS]
                rel_dir = os.path.relpath(dirpath, root)
                for fname in filenames:
                    if _should_skip(rel_dir, fname):
                        continue
                    full = os.path.join(dirpath, fname)
                    try:
                        if os.path.getsize(full) > MAX_FILE_BYTES:
                            continue
                        arcname = os.path.join("hi-again", os.path.relpath(full, root))
                        zf.write(full, arcname)
                    except (OSError, ValueError):
                        continue
        # Stream the complete zip in chunks
        buffer.seek(0)
        chunk = buffer.read(1024 * 256)
        while chunk:
            yield chunk
            chunk = buffer.read(1024 * 256)

    headers = {
        "Content-Disposition": 'attachment; filename="hi-again-source.zip"',
        "Cache-Control": "no-store",
    }
    return StreamingResponse(iter_zip(), media_type="application/zip", headers=headers)

# Include the router in the main app (must be after all route definitions)
app.include_router(api_router)

# CORS configuration:
# Browsers FORBID Access-Control-Allow-Origin: "*" when credentials are sent.
# We use allow_origin_regex so FastAPI always echoes a specific origin back —
# even if CORS_ORIGINS env var is missing or set to "*" by the deploy platform.
_DEFAULT_CORS_REGEX = (
    r"https://(.*\.)?hiagain\.xyz"
    r"|https://(.*\.)?emergentagent\.com"
    r"|https://(.*\.)?emergent\.host"
    r"|http://localhost(:\d+)?"
    r"|https://localhost(:\d+)?"
    r"|capacitor://localhost"
    r"|ionic://localhost"
)
_cors_regex = os.environ.get('CORS_ORIGIN_REGEX') or _DEFAULT_CORS_REGEX

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=_cors_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
