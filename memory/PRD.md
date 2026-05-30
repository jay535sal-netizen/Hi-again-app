# Hi Again — Product Requirements Document

## Original Problem Statement
A full-stack social app called **Hi Again** (Crowdspulse Gsphere LLC) that helps users find missed connections via city + event tagging, time-bucket overlap, GPS proximity, Google Timeline JSON imports, and BLE proximity. Includes social feed, "Missed Connection" posts, Private Circle, freemium Stripe model, referrals, achievements, Gatherings/Events. Mobile via Capacitor for Android Play Store.

## Stack
- **Backend**: FastAPI (~4170 lines), MongoDB (Motor), Resend, Stripe, Gemini Vision (via EMERGENT_LLM_KEY)
- **Frontend**: React + Tailwind + shadcn/ui, "Sunset Noir" theme, smart same-origin axios
- **Mobile**: Capacitor Android (`com.crowdspulse.hiagain`)
- **Auth**: JWT in httpOnly cookies only

## Implemented (CHANGELOG)

### May 28, 2026 — Cloud build pipeline (GitHub Actions)
- ☁️ **`.github/workflows/generate-keystore.yml`**: one-time keystore generator
  runs in cloud. User sets `KEYSTORE_PASSWORD` + `KEY_PASSWORD` secrets, runs
  workflow with confirmation phrase, downloads .jks artifact + copies base64
  from run summary into `KEYSTORE_BASE64` secret. Zero Java install needed.
- ☁️ **`.github/workflows/build-android.yml`**: builds signed AAB on every
  push to `main`. Restores keystore + google-services.json from secrets,
  runs `yarn build && npx cap sync android && ./gradlew bundleRelease`,
  uploads AAB as artifact. Validates google-services.json package name
  matches `com.crowdspulse.hiagain` before building.
- 📄 **`/app/CLOUD_BUILD_SETUP.md`**: step-by-step browser-only instructions
  for the entire pipeline (10 min one-time setup, 5 min builds thereafter).
- 🔁 Decision: user (non-engineer founder, no Android Studio installed)
  chose cloud build over local install. Eliminates 2-4 hour Windows setup.

### May 28, 2026 — Pre-commit hooks + 3 real bugs squashed
- 🛠️ **`/app/.pre-commit-config.yaml`**: Ruff (Python) + ESLint (JS/JSX) + gitleaks
  + JSON/YAML check + large-file guard. Setup: `pip install pre-commit && pre-commit install`.
- 🛠️ **`/app/backend/pyproject.toml`**: Ruff config tuned for real bugs only
  (pyflakes + bugbear core), not cosmetic / modernization rules.
- 🛠️ **`/app/frontend/eslint.config.mjs`**: ESLint flat config mirroring craco's
  in-build linting so standalone CLI and pre-commit agree.
- 🛠️ **`/app/DEV_SETUP.md`**: Contributor docs explaining install + why we
  ignore the external "code quality report" tool's false positives.
- 🐛 **Bug fix — `ShareInvite.js`**: compact floating-share button referenced
  removed `shareVia` function → runtime crash when tapped. Now uses `SHARE_URLS`.
- 🐛 **Bug fix — `Premium.js`**: `Infinity` lucide icon shadowed the JS global
  `Infinity`. Renamed import to `InfinityIcon`.
- 🐛 **Bug fix — `command.jsx`**: allowed `cmdk-input-wrapper` DOM attribute
  the cmdk library uses for its CSS selectors.

### May 26, 2026 — Stripe INR pricing + Play Store Location Disclosure
- 🎉 **Currency surfaced post-purchase** — Premium page now shows
  *"You're a Premium Member! · Paid ₹399 • monthly"*; Profile page
  *"Go Premium"* button morphs into emerald *"Premium • ₹399"* for active subscribers.
  Backend `/api/subscription/activate/{session_id}` now returns `amount + currency`.
- 💸 **Stripe INR currency support** — Indian users on `/premium` see a `$ USD / ₹ INR` pill toggle.
  Prices: **₹399 / month**, **₹3,999 / year** (vs $4.99 / $39.99). Stripe US merchant
  charges INR directly on international-enabled Visa/Mastercard/RuPay (UPI not supported).
  Auto-detects Asia/Kolkata timezone to default to INR. Choice persisted in localStorage.
  Backend: `PREMIUM_PLANS` now stores `{prices: {usd, inr}}`, `/api/subscription/checkout`
  accepts optional `currency` field (default usd), rejects unsupported currencies (400).
  Verified end-to-end: both USD and INR checkouts return valid Stripe sessions.
- 🛡️ **Prominent Location Disclosure Modal** (Play Store P0 blocker fixed) —
  `<LocationDisclosureModal>` shown via `createPortal(document.body)` BEFORE any
  `navigator.geolocation` call. Wired into `GPSTracker` (Dashboard) + `AutoTrackCTA`
  (Locations page). Persists `hiagain.location_disclosure_v1` flag so it doesn't
  re-prompt. Auto-resume gated on disclosure being seen. Satisfies Google Play's
  prominent-disclosure requirement for ACCESS_BACKGROUND_LOCATION.
- ↪️ Background geolocation plugin install **deferred to v1.1**. App ships
  foreground-only on Play Store to avoid Google's background-location justification
  review (2–4 week delay). Disclosure copy already says "In the background (optional)".

### May 8, 2026 — Email Unsubscribe (CAN-SPAM)
- 🔓 **One-click unsubscribe** — `GET/POST /api/email-prefs/unsubscribe?token=...` (RFC 8058 / Gmail one-click compliant). Stateless HMAC tokens (signed with `JWT_SECRET`, no DB lookup needed).
- ➕ Added `List-Unsubscribe` and `List-Unsubscribe-Post` headers to crossing & welcome emails (Gmail/Apple Mail show native unsubscribe button).
- 🛡️ `email_pref_enabled()` gate added to `maybe_send_crossing_email`. Verification emails are always sent (transactional).
- 🆕 `GET/PATCH /api/email-prefs` for in-app management. New `<EmailPreferences>` toggle component on Profile page.
- 🌐 Branded HTML success/error page rendered after unsubscribe click (no JSON dump in browser).
- ✅ Verified end-to-end: pref=false → email correctly skipped; pref=true → email correctly sent (Resend ids `99ed86cb...`, `573b7acd...`).

### May 8, 2026 — Welcome + Crossing emails
- ✉️ **Welcome email** — fired async on every `/auth/register`. Branded dark-theme HTML + plain text. CTA to dashboard, surfaces `FRIENDS2026` promo. Uses Resend, never blocks signup.
- 🔔 **Crossing notification email** — sent automatically when `detect_crossings` creates a new crossing (both directions). Soft, friendly copy, links to `/crossings`.
- 🛡️ **Anti-spam guards** for crossing emails:
  - Skip if recipient has `email_verified=False` (avoid bouncing on unverified addresses)
  - Skip if recipient has `ghost_mode=True`
  - 24-hour cooldown per (user, other_user) pair via new `crossing_email_log` collection
  - Daily cap of 3 crossing emails per user per 24h
- 🆕 New `APP_PUBLIC_URL` env var (defaults to `https://hiagain.xyz`)
- Verified end-to-end: real email IDs delivered via Resend (`d309a8c4...`, `f528ece6...`, `84120cd0...`).

### May 7, 2026 (continued — Profile Gallery + Discover)
- 🖼️ **Profile Gallery** — new `<ProfileGallery>` component with Albums tab (uploads via `/api/gallery`) + From Posts tab (auto-pulled). Per-user privacy: `public` / `crossings` / `connections` / `private`. Shown on `/profile` (own) and `/user/:id` (others, with privacy enforcement). Image moderation runs on every upload.
- ✨ **Discover (People You Might Know)** — new `/discover` page. Backend ranks candidates by signals: same city (+50), been to your city (+20), been to your event (+35), mutual connection (+30), attending same Gathering (+40). Excludes self, ghost-mode, already-crossed, already-connected. UI shows reason chips, Say Hi / View / Skip per card.
- 🐛 Fixed pre-existing button-in-button hydration warning on Dashboard (`open-missed-connection-modal`).
- 🌱 Backfilled 5 admin locations (NY, Portland, Boston, LA, SF) so `/discover` returns rich results.
- ✅ Tested: 13/13 backend pytest cases + all frontend Discover/Gallery flows.

### May 7, 2026 (continued — demo content + Play Store prep)
- 🌱 **Demo seed** (`/app/backend/seed_demo.py`) — 12 realistic users (names, cities, bios, avatars), 36 locations, 16 admin↔demo crossings, 18 feed posts, 4 upcoming gatherings. Tagged `is_demo: True` for wipe-ability. Uses randomuser.me (avatars) + picsum.photos (posts) — both CC0.
- 📄 **Google Play listing kit** (`/app/GOOGLE_PLAY_LISTING.md`) — title/short/long descriptions, Data Safety answers, content rating, prominent-disclosure screen copy, AAB build steps, pre-submission checklist, launch strategy.

### May 7, 2026 (continued — DNS verified + production fixes)
- ✅ **Resend domain `hiagain.xyz` VERIFIED** (DKIM, SPF, Domain). `RESEND_FROM_EMAIL` swapped from `onboarding@resend.dev` → `noreply@hiagain.xyz`. Real test send confirmed (id `75b31883-c469-4e1e-b30f-a6dea463261d`).
- 🐛 **Critical: `/api/locations` 500 fix** — Timeline-imported docs (latitude/longitude/name/timestamp) crashed `LocationResponse` Pydantic validation (missing city/event_or_place/date). Added `_normalize_location_doc()` helper, updated `/locations/import` to write the standard schema fields, backfilled 7 legacy docs in DB.
- 🐛 **Critical: `/api/crossings` 500 fix** — same root cause, 73 crossing docs had `city=None`/`date=None`. Made `CrossingResponse` fields tolerant + backfilled docs (city: 73, date: 73, event_or_place: 16).
- 🚀 **Deployment health check passed** — fixed unquoted `RESEND_FROM_NAME=Hi Again` → `RESEND_FROM_NAME="Hi Again"` (only blocker found by deployment agent).
- ✅ **Resend domain `hiagain.xyz` VERIFIED** (DKIM, SPF, Domain). `RESEND_FROM_EMAIL` swapped from `onboarding@resend.dev` → `noreply@hiagain.xyz`. Real test send confirmed (id `75b31883-c469-4e1e-b30f-a6dea463261d`).
- 🐛 **Critical: `/api/locations` 500 fix** — Timeline-imported docs (latitude/longitude/name/timestamp) crashed `LocationResponse` Pydantic validation (missing city/event_or_place/date). Added `_normalize_location_doc()` helper, updated `/locations/import` to write the standard schema fields, backfilled 7 legacy docs in DB.
- 🐛 **Critical: `/api/crossings` 500 fix** — same root cause, 73 crossing docs had `city=None`/`date=None`. Made `CrossingResponse` fields tolerant + backfilled docs (city: 73, date: 73, event_or_place: 16).

### May 7, 2026 (earlier)
- ✉️ **Resend email integration** — replaced smtplib draft with Resend SDK. Real verification emails now send to verified inbox. Async `send_email()` + `send_verification_email()` helpers. Auto-fallback to in-app code when no provider configured. Test message landed successfully (id `a7da4c79...`).
- 🆕 **Missed Connection modal** — dedicated form (city/place/date/description) replacing the dead-end "/profile" link from quick actions. Tagged as `[Missed Connection]` in description for downstream filtering.
- 🐛 **Add Location error surfacing** — "Failed to add location" now shows the actual server error instead of a generic toast.
- 🐛 **Auth race-condition fix** — Removed global axios 401→redirect interceptor. Added 5s post-login grace period in AuthContext. Fixes "logged in for a split second then bounced" bug.
- 🎟️ **Promo code system** — `POST /api/promo/redeem`. Seeded `FRIENDS2026` (30 days, unlimited uses, single-use-per-user). UI on `/premium`.
- 🐛 **Premium checkout fix** — frontend was reading `response.data.url`; backend returns `checkout_url`. Fixed.
- 🆕 **Google Timeline import UI** — drag-drop on `/locations` with Takeout how-to guide and GPS fallback callout.
- 🎬 **Promo video** in Landing hero — 12MB iPhone video transcoded to 3.7MB H.264 web-optimized, embedded in phone-shaped frame.
- 🆕 **Onboarding flow** — 4-step welcome modal, `users.onboarded` flag.
- 🆕 **Email verification** banner + modal flow.
- 🆕 **Image moderation** — Gemini Vision via emergentintegrations, fails open.
- 🆕 **Ghost Mode** privacy toggle — hides user from views/crossings.
- 🔧 **Production CORS fix** — same-origin auto-fallback in frontend + `allow_origin_regex` backend.
- 🔧 **Code export endpoint** for emergency download (currently disabled via empty EXPORT_TOKEN).

### Prior sessions
- Cookie-based JWT auth migration. Privacy Policy + Terms + GDPR endpoints. Capacitor Android wrapper. BLE Tracker, GPS Tracker, Crossings, Gatherings, Posts/Feed, Referrals, Achievements, Stripe checkout, Object storage. Production deploy to https://hiagain.xyz.

## Test Credentials
See `/app/memory/test_credentials.md`.

## Roadmap (Prioritized)

### P0 (Blocking)
- ✅ Login resilience (race-condition fix)
- ✅ Email provider (Resend live, mocked-mode fallback)
- ✅ Premium checkout, promo codes, Timeline import, video, onboarding, verification, Ghost Mode, image moderation

### P1 (waiting on user action)
- 🔴 **REDEPLOY needed** to push today's work (Stripe INR + Location Disclosure Modal)
  to hiagain.xyz. Click **Deploy** in the Emergent chat input.
- 🟢 Capacitor Background Geolocation plugin (`@capacitor-community/background-geolocation`,
  MIT-licensed, free) — deferred to v1.1. Adds true background tracking on Android.
  Will require Play Store background-location justification review.
- 🟢 Build signed AAB and submit to Play Console. Use `GOOGLE_PLAY_LISTING.md`
  for listing copy + Data Safety answers.
- 🟢 Photo-EXIF import with privacy protections (waiting for user to pick protection combo)
- 🟢 Firebase Cloud Messaging push notifications (waiting on service account JSON + VAPID key)
- 🟢 Firebase Crashlytics (waiting on `google-services.json`)
- 🟡 Resend domain verification for hiagain.xyz — DONE (verified May 7).

### P2 (Polish & growth)
- "Resend code" 60s cooldown + clearer error states on verification modal
- Production env health check at startup
- Admin promo-code management page
- "Invite a friend → 1 month VIP" auto-grant

### Backlog / Tech Debt
- Refactor `backend/server.py` (4170 lines) into modules
- Extract large React components

## Key API Endpoints
- `POST /api/auth/{login,register,logout,forgot-password,reset-password,send-verification,verify-email,complete-onboarding}`
- `GET /api/auth/me`
- `PATCH /api/profile` — name/bio/photo/ghost_mode
- `POST /api/posts`, `POST /api/profile/photo` — image moderation runs inline
- `GET /api/users/{user_id}/profile`
- `GET /api/crossings`, `/api/crossings/stats`, `/api/suggestions`
- `POST /api/locations`, `POST /api/locations/import`
- `POST /api/gps/ping`, `GET /api/gps/nearby`
- `POST /api/ble/encounter`, `GET /api/ble/encounters`
- `GET /api/gatherings`, `POST /api/gatherings`, `POST /api/gatherings/{id}/rsvp`
- `GET /api/posts/feed`, `GET /api/posts/explore`
- `GET /api/subscription/plans`, `POST /api/subscription/checkout`
- `POST /api/promo/redeem`
- `GET /api/referrals/stats`, `POST /api/referrals/validate`, `POST /api/referrals/apply`
- `GET /api/achievements`, `GET /api/achievements/leaderboard`

## Critical Files
- `backend/server.py` — monolithic FastAPI app (now includes Resend integration)
- `backend/.env` — secrets, CORS_ORIGINS, JWT_SECRET, STRIPE_API_KEY, EMERGENT_LLM_KEY, RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_FROM_NAME, EXPORT_TOKEN
- `backend/requirements.txt` — includes `resend==2.30.0`
- `frontend/src/lib/api.js` — axios with smart same-origin fallback; `/auth/me`-only 401 interceptor
- `frontend/src/context/AuthContext.js` — cookie-only auth + 5s post-login grace period
- `frontend/src/components/{OnboardingModal, EmailVerificationBanner, TimelineImport, MissedConnectionModal}.js`
- `frontend/src/pages/Premium.js` — promo + Stripe checkout
- `frontend/src/pages/Profile.js` — Ghost Mode toggle
- `frontend/src/pages/Landing.js` — promo video hero
- `frontend/public/media/hero-loop.mp4` + `hero-poster.jpg`
- `frontend/android/` — Capacitor (package: `com.crowdspulse.hiagain`)

## Environments
- **Preview**: `https://crossed-paths-3.preview.emergentagent.com`
- **Production**: `https://hiagain.xyz` (deployed; needs redeploy after each feature)
