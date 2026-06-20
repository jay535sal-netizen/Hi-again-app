# Hi Again — Product Requirements & Status

> **App:** Hi Again
> **Tagline:** Reconnect with the people you actually crossed paths with — by city, event, or GPS.
> **Package:** `com.crowdspulse.hiagain`
> **Domain:** `https://hiagain.xyz`
> **Developer:** Crowdspulse Gsphere LLC
> **Last updated:** Feb 15, 2026

---

## 🎉 SHIPPED — Internal Testing LIVE on Google Play

**Date shipped:** Feb 15, 2026 (overnight session)
**Track:** Internal testing (no Google review required for install)
**Status:** App live as `com.crowdspulse.hiagain (unreviewed)` until public listing review completes (~3–7 days)
**AAB version:** `1.0.1` (versionCode 2)
**Target SDK:** 35 ✅
**Min SDK:** 23

### What's live on the Play Store right now:
- ✅ Production-signed AAB built via GitHub Actions (no local Android SDK needed)
- ✅ Google Play App Signing enrolled
- ✅ App icon (user-designed map pin + Monopoly cityscape, 512×512)
- ✅ Feature graphic (1024×500)
- ✅ 4 polished phone screenshots (Dashboard, Discover, Premium, Achievements — 1080×1920)
- ✅ Short + full description copy
- ✅ Privacy policy at `/privacy`
- ✅ Terms at `/terms`
- ✅ NEW: Account-deletion page at `/delete-account` (Play Store 2025 requirement)
- ✅ Data Safety form completed
- ✅ Content Rating: Teen 13+ (matches TOS)
- ✅ Target audience: 18+ only
- ✅ Contact email: `hiagainxyz@gmail.com`
- ✅ Internal testing email list: `Hi Again Beta Squad` with 1 tester (`hiagainxyz@gmail.com`)

### Pending Google review (3–7 days):
- 🕓 Public listing approval (icon + name visibility on Play Store)
- 🕓 Background location declaration (response template already written in `GOOGLE_PLAY_LISTING.md` Section 7)

---

## 🛠️ Build & deploy pipeline

**Code → GitHub → GitHub Actions → AAB → Play Console**

- Repo: `github.com/jay535sal-netizen/Hi-again-app`
- Cloud build workflow: `.github/workflows/build-android.yml`
- Build time: ~3 minutes (Gradle 8.9 + Android SDK 35)
- Outputs signed `app-release.aab` as a downloadable GitHub artifact
- Keystore: managed via `keystore.properties` (gitignored), stored in GitHub Secrets

### Recent build chain upgrade (Feb 15, 2026):
- Bumped `targetSdkVersion` 34 → 35 (required by Play Store as of Aug 2025)
- Bumped `minSdkVersion` 22 → 23
- Bumped `compileSdkVersion` 34 → 35
- Bumped Android Gradle Plugin 8.2.0 → 8.6.1
- Bumped Gradle wrapper 8.2 → 8.9
- Bumped Google Services 4.3.15 → 4.4.2
- Bumped Firebase Crashlytics Gradle 2.9.9 → 3.0.2
- Bumped AndroidX libraries (appcompat, core, fragment, activity, webkit) to API-35-compatible versions
- Bumped capacitor-cordova-android-plugins fallback SDK 33 → 35
- Bumped `versionCode` 1 → 2, `versionName` 1.0 → 1.0.1

---

## 🗺️ Roadmap

### P0 — Next 1–7 days (post-Internal Testing)
- [ ] **🔥 ARCHITECTURAL: Photos & post media stored as base64 data URIs in MongoDB** — `/api/users/{id}/profile` response is **9.7 MB** on the test account because the photo is embedded as base64. Same for `/api/posts/feed`. This will OOM the backend at scale and is the root cause of "Could not load profile" / "Failed to load feed" toasts on mobile (axios timeout fires before the 10+ MB response finishes downloading on cellular). Fix: migrate user photos + post media to object storage (Emergent's `/api/storage/upload` or S3), return URL strings instead. Backfill existing rows.
- [ ] Install Hi Again on tester phones, gather first-night crash reports via Firebase Crashlytics
- [ ] Verify FCM push works on a real device (cross-paths nudge)
- [ ] Verify background-location foreground service notification renders properly on Android 14+
- [ ] Wait for Google's public listing approval; respond to background-location declaration when prompted

### P1 — Next 2–4 weeks
- [ ] Promote Internal → Closed Testing once 5+ testers have validated core flows
- [ ] Re-integrate Bluetooth (BLE) proximity tracking via `@capacitor-community/bluetooth-le` (upgrade Capacitor 5 → 6)
- [ ] Set up Cloudflare Email Routing so `hello@hiagain.xyz` forwards to the Gmail
- [ ] Swap Play Console contact email from `hiagainxyz@gmail.com` → `hello@hiagain.xyz`

### P2 — Backlog
- [ ] Refactor monolithic `backend/server.py` (~5,400 lines) into `/app/backend/routes/` modules
- [ ] Decompose `Premium.js` and `GPSTracker.js` (frontend mega-components)
- [ ] Add a regular (non-VR) YouTube promo video to the Play Store listing
- [ ] Internationalization: real translations for top 5 markets (currently English-only)

### Future
- [ ] Open Testing → Production rollout
- [ ] Pre-registration campaign
- [ ] iOS App Store submission (separate Apple Developer enrollment required)

---

## 🔑 Credentials & contact

- Test account: `hiagainxyz@gmail.com` / `HiAgain2024!`
- Demo promo: `FRIENDS2026`
- Play Console contact email: `hiagainxyz@gmail.com`
- Domain: `hiagain.xyz`
- Crowdspulse Gsphere LLC

---

## 📌 Important notes for future sessions

1. **Two environments live now**: Preview (`crossed-paths-3.preview.emergentagent.com`) + Production (`hiagain.xyz`). Code changes only land on production when the user clicks **Deploy** in Emergent chat.
2. **All Play Console assets are persisted** in `/app/marketing/play_assets/` and served from `/app/frontend/public/` (icon, feature graphic, phone screenshots).
3. **Internal Testing opt-in URL** is the link users need to install — get it from Play Console → Testing → Internal testing → "How testers join your test".
4. **User's emotional context:** Was fired the day before launch, demoralized by competitor apps with same name, but pushed through and shipped anyway. Treat with empathy and ship-momentum bias.
