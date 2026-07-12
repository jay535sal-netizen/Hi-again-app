# Hi Again — Test Credentials

## Admin / Primary Test Account
- **Email**: hiagainxyz@gmail.com
- **Password**: HiAgain2024!
- **Role**: Admin (premium tier)
- **State**: `onboarded=True`, `email_verified=True`

## Promo Code (live, tested)
- **Code**: `FRIENDS2026`
- **Grants**: 30 days Premium
- **Uses**: Unlimited (per-user single redemption)
- **Where**: `/premium` page → "Got a promo code?" box
- Case-insensitive

## Email Provider — Resend (live)
- **API Key in `/app/backend/.env`**: `RESEND_API_KEY=re_...`
- **From**: `noreply@hiagain.xyz` (production sender — domain VERIFIED on Resend 2026-05-07)
- **Sender display**: "Hi Again"
- **Provider helper**: `email_provider_active()` returns True when `RESEND_API_KEY` is set and the `resend` SDK is importable
- **Test verified**: real email delivered to hiagainxyz@gmail.com on 2026-05-07 (id `a7da4c79-bde9-4867-bd10-266148d9c820`)
- **Status**: `hiagain.xyz` ✅ VERIFIED on Resend (DKIM, SPF, Domain). Production sender swapped to `noreply@hiagain.xyz`. Test send confirmed (id `75b31883-c469-4e1e-b30f-a6dea463261d`).
- **DNS records to add at GoDaddy**:
  - TXT `resend._domainkey` → DKIM key (long string ending `kQIDAQAB`)
  - MX `send` → `feedback-smtp.us-east-1.amazonses.com` priority 10
  - TXT `send` → `v=spf1 include:amazonses.com ~all`
  - TXT `_dmarc` → `v=DMARC1; p=none;`

## Demo Content Seed (staging "awesome app" feel)
- Script: `/app/backend/seed_demo.py`
- Run: `cd /app/backend && python3 seed_demo.py`
- Wipe: `python3 seed_demo.py --wipe`
- All seeded rows are tagged `is_demo: True` for safe cleanup.
- **12 demo users** (Maya, Jordan, Priya, Sam, Luna, Ethan, Noor, Kai, Avery, Diego, Hana, Marcus) across 12 US cities
- **36 locations**, **16 crossings** with admin, **18 seed posts**, **4 upcoming gatherings**
- Demo password (all demo users): `HiAgainDemo2026!`
- Avatars: randomuser.me (CC0). Post/cover images: picsum.photos (CC0).

## Public Feed Seed (viral missed-connection stories, ghost accounts)
- Admin endpoint: `POST /api/admin/feed/seed` (idempotent)
- Admin endpoint: `POST /api/admin/feed/cleanup_broken` (removes tiny 1×1 test images)
- Requires login as admin (`hiagainxyz@gmail.com`)
- 15 ghost seed users (Maya, Jordan, Ana, Marcus, Sana, Devon, Riley, Emmy, Zoe, Alex, Priya, Kai, Nadia, Sam, Layla)
- Each posts a viral-style story with a legally-licensed Unsplash photo stored in Emergent Object Storage
- Rows tagged `is_seed: True` — ghost_mode users are excluded from crossings/discover/search but **surfaced** on the public feed


## Resetting onboarding/verification flags for testing
```bash
cd /app/backend && python3 -c "
import asyncio, os
from dotenv import load_dotenv; load_dotenv()
from motor.motor_asyncio import AsyncIOMotorClient
async def main():
    c = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = c[os.environ['DB_NAME']]
    await db.users.update_one(
        {'email':'hiagainxyz@gmail.com'},
        {'\$set': {'onboarded': False, 'email_verified': False}}
    )
asyncio.run(main())
"
```

## Environments
- Preview: https://crossed-paths-3.preview.emergentagent.com
- Production: https://hiagain.xyz

## Auth flow
- **Web**: JWT in **httpOnly cookie** named `hiagain_token`. NO localStorage tokens.
- **Native (Capacitor Android/iOS app)**: cookies don't survive the cross-origin webview→hiagain.xyz hop, so the `access_token` is stored in localStorage under key `hiagain.native_token` and sent as `Authorization: Bearer <token>` header on every request. See `/app/frontend/src/lib/api.js` `setNativeToken()` / `getNativeToken()`.
- Endpoints: `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`
- Verification: `POST /api/auth/send-verification`, `POST /api/auth/verify-email`, `POST /api/auth/complete-onboarding`
- `/auth/me` surfaces `ghost_mode`, `email_verified`, `onboarded` on the user response.
- Backend `get_current_user()` checks httpOnly cookie FIRST, falls back to `Authorization: Bearer` header — supports both flows transparently.

## Auth resilience
- 5-second post-login grace period in AuthContext (race-condition fix)
- Global axios 401 interceptor only clears auth state for `/auth/me` (not other endpoints)

## Production CORS / Same-Origin
- Backend uses `allow_origin_regex` (matches `*.hiagain.xyz`, `*.emergentagent.com`, `*.emergent.host`, localhost).
- Frontend auto-detects cross-origin env-var mismatches and falls back to **same-origin** API calls.

## Image Moderation
- Runs on `POST /api/posts` and `POST /api/profile/photo`
- Gemini 2.5 Flash via `EMERGENT_LLM_KEY`
- Fails open on error/timeout (8s)

## Admin Code Export
- `EXPORT_TOKEN` is currently empty (disabled).
