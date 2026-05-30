# Hi Again — Google Play Store Listing Kit

Copy/paste ready. Ordered to match Play Console's forms.

---

## 🚀 START HERE — Submit-to-Play in 10 Steps

> ⚠️ This must run on your local Mac/Windows machine. The Emergent container
> has no Android SDK / JDK / Gradle runtime. Roughly 60-90 min start-to-finish.

### A. One-time tooling setup (~30 min, skip if you've done it before)

1. **Create a Google Play Developer account** at https://play.google.com/console/signup
   — **$25 one-time fee**.
2. **Install Android Studio** from https://developer.android.com/studio
   (includes the SDK + JDK 17). On first launch, accept all default SDK
   downloads.
3. **Verify command-line tools**:
   ```bash
   java -version       # should be 17.x
   adb --version       # included with platform-tools
   ```

### B. Get the code on your machine (~5 min)

4. In the Emergent chat input, click **"Save to GitHub"** (or use the project
   export to download a zip). Clone/extract to `~/hi-again`.
5. Install frontend deps:
   ```bash
   cd ~/hi-again/frontend
   yarn install
   ```

### C. Generate the upload keystore (one-time, ~5 min — DO ONLY ONCE)

6. From `~/hi-again/frontend/android/app/`:
   ```bash
   keytool -genkey -v \
     -keystore hi-again-release.jks \
     -keyalg RSA -keysize 2048 -validity 10000 \
     -alias hi-again
   ```
   - Use a STRONG password.
   - **Save both the `.jks` file and the password in your password manager.**
   - If you lose either, you can NEVER push an update to this app — you'd
     have to publish under a brand-new package name from scratch.

7. Copy the template + fill in real values:
   ```bash
   cp keystore.properties.template keystore.properties
   # then edit keystore.properties with your password & key alias
   ```
   The file is gitignored — it'll never be committed.

### D. Build the signed AAB (~3 min)

8. From `~/hi-again/frontend`:
   ```bash
   yarn build
   npx cap sync android
   cd android
   ./gradlew bundleRelease
   ```
   - Output: `android/app/build/outputs/bundle/release/app-release.aab`
   - File size will be ~5-15 MB.

### E. Submit to Play Console (~30 min, mostly form filling)

9. Go to https://play.google.com/console → **Create app** →
   - Name: **Hi Again**
   - Default language: English (US)
   - Category: **Social**
   - App / Game: **App**
   - Free / Paid: **Free**

10. Upload your AAB:
    - **Production → Releases → Create new release**
    - Drag in `app-release.aab`
    - Release name: `1.0 (1)` (auto-filled from versionCode/versionName)
    - **Release notes**: see Section 6 of this file

11. **Store listing** (left sidebar) — paste in:
    - Short description: see Section 1
    - Full description: see Section 2
    - App icon (512×512 PNG)
    - Feature graphic (1024×500)
    - Screenshots (minimum 2, recommended 6 — phone)

12. **Data Safety form** — use Section 4 of this file (answer-by-answer)

13. **App content** → answer all questionnaires (ads, content rating, target
    audience, government apps, news apps — see Section 5)

14. **Content rating** → fill out the questionnaire honestly. Hi Again will
    likely get rated **Teen** because of user-generated content (the missed
    connection feed).

15. **Privacy Policy URL**: `https://hiagain.xyz/privacy`

16. Click **"Review release"** → **"Start rollout to production"**.
    First review: **3-7 days**. Expect Google to ask follow-up questions
    about background location — see Section 7 for the response template.

### F. Common issues you might hit

- **"You uploaded an unsigned APK"**: `keystore.properties` is missing or
  wrong path. Verify `storeFile` is an ABSOLUTE path.
- **"Background location requires justification"**: Use the response template
  in Section 7. They specifically want to see that you have a prominent
  disclosure (you do — `LocationDisclosureModal`) and that the feature
  works without background location too (it does — foreground-only is the
  current default).
- **"Targets API level X but should target Y"**: Bump `targetSdkVersion` in
  `android/variables.gradle`, then re-sync. As of Feb 2026, Play requires
  targetSdk 34+.

---

## 1. App Details

### App name (30 characters max)
```
Hi Again: Missed Connections
```
*(28 chars)*

### Short description (80 characters max)
```
Reconnect with people you crossed paths with — by city, event, or GPS.
```
*(71 chars)*

### Full description (4000 characters max)
```
Ever made eye contact with someone at a concert, coffee shop, or crowded park — and wished you had a way to find them again?

Hi Again is a missed-connections app that reconnects you with the people who were actually there. Not random swipes. Real overlap.

HOW IT WORKS
━━━━━━━━━━━━
Tell Hi Again the cities, events, and places you've been — concerts, bars, parks, cafes, conferences, sports games. The app quietly matches you with other people who were at the same places. When two paths cross, both of you get a soft "Hi Again" nudge.

You choose if you want to say hello.

FEATURES
━━━━━━━━
• PATH CROSSINGS — Find people who were at the same event, stadium, or neighborhood
• GPS PROXIMITY — Opt-in background tracking builds your timeline automatically
• GOOGLE TIMELINE IMPORT — Backfill years of crossings instantly by dropping in your Google Takeout JSON
• MISSED CONNECTIONS FEED — Post about that stranger you can't forget. Let them find you.
• GATHERINGS — Find or host casual meetups in your city
• PRIVATE CIRCLE — Share your real-time location with only the friends you trust
• GHOST MODE — Instantly hide yourself from views and crossings with one toggle
• VERIFIED PROFILES — Email verification keeps the community real

PRIVACY FIRST
━━━━━━━━━━━━━
• Your location is never public
• Ghost Mode is always one tap away
• You choose who sees what
• No location data is ever sold — we make money only from Premium subscriptions
• Full GDPR + CCPA data export + deletion available anytime

FREE VS PREMIUM
━━━━━━━━━━━━━━━
Free forever includes: profile, location history, basic crossings, feed, gatherings.

Premium (optional, cancel anytime):
• Unlimited locations
• Priority crossing match scoring
• Advanced filters (date ranges, match types)
• Ad-free forever
• Early access to new features

Refer a friend for free Premium days.

WHO IS THIS FOR
━━━━━━━━━━━━━━━
• People who believe in chance encounters
• Concertgoers, sports fans, festival regulars
• Travelers who cross paths with strangers
• Anyone tired of cold swipe-culture dating apps — Hi Again isn't one

We're Crowdspulse Gsphere LLC. Built for serendipity.

👉 Got feedback? hello@hiagain.xyz
👉 Privacy: https://hiagain.xyz/privacy
👉 Terms: https://hiagain.xyz/terms
```
*(~2,050 chars — room to expand with testimonials after launch)*

---

## 2. Categorization

- **Category**: Social  *(alt: Dating — but "Social" dodges the saturated dating-category review friction)*
- **Tags**: Meet People, Social Networking, Local, Events

---

## 3. Contact

- Email: `hello@hiagain.xyz` *(or your `hiagainxyz@gmail.com` until domain inbox is ready)*
- Website: `https://hiagain.xyz`
- Privacy Policy: `https://hiagain.xyz/privacy`

---

## 4. Data Safety Form (Play Console requires this — fill EXACTLY)

### Does your app collect or share any required user data?
**Yes**

### Data collected (check each):

| Data | Collected | Shared | Optional | Purpose |
|---|---|---|---|---|
| Name | ✅ | ❌ | ❌ | Account management, app functionality |
| Email address | ✅ | ❌ | ❌ | Account management |
| User IDs | ✅ | ❌ | ❌ | Account management |
| Photos | ✅ | ❌ | ✅ | User profile, posts |
| Approximate location | ✅ | ❌ | ✅ | App functionality (crossings) |
| Precise location | ✅ | ❌ | ✅ | App functionality (proximity matching) — **only with explicit consent** |
| Other personal info (bio) | ✅ | ❌ | ✅ | App functionality |
| App activity (posts, likes) | ✅ | ❌ | ❌ | Analytics, app functionality |
| Purchase history | ✅ | ❌ | ❌ | Premium subscription management (Stripe) |
| Crash logs | ✅ | ❌ | ❌ | Bug fixing |

### Is all user data encrypted in transit?
**Yes** *(HTTPS + TLS 1.2+)*

### Do you provide a way for users to request that their data be deleted?
**Yes** — `DELETE /api/users/me` endpoint + `hello@hiagain.xyz`

### Third-party data processors (disclose in privacy policy):
- **Stripe** (payments)
- **Resend** (transactional email)
- **MongoDB Atlas** (database — encrypted at rest)
- **Google Cloud Run / Emergent Host** (hosting)

---

## 5. Content Rating Questionnaire

- Category: Social Networking
- User-generated content: **Yes** (posts, profiles, chat)
- Moderation tools: **Yes** (image moderation via Gemini Vision, report/block flows)
- Violence: No
- Sexual content: No (TOS prohibits)
- Profanity: Mild/occasional
- Controlled substances: No
- Gambling: No
- Unrestricted Internet: No
- Location sharing: **Yes** — opt-in only

Expected rating: **Teen (13+)** — matches TOS minimum age.

---

## 6. Prominent Disclosure Screen (REQUIRED for location apps)

Google will reject the submission if you don't show this BEFORE requesting location permission. Build it as a dedicated modal on first location request.

### Copy:

**Title**: `Hi Again uses your location`

**Body**:
```
To find people you've crossed paths with, Hi Again needs access to your device location.

• While using the app: detect your current city/venue for matching
• In the background (optional): automatically build your location timeline so you don't have to log places manually

Your location is:
✅ Never shown publicly
✅ Only matched against other Hi Again users
✅ Disabled instantly when you toggle Ghost Mode
✅ Deletable anytime from Settings

By continuing, you agree to our Privacy Policy.
```

**Buttons**:
- `Allow location access`
- `Not now`

---

## 7. Background Location — Justification Response (READ BEFORE SUBMITTING)

Google **will** push back on `ACCESS_BACKGROUND_LOCATION`. Have this answer
ready in the "Background location declaration" form when you submit:

### Why does your app need background location?

> Hi Again is a missed-connections app whose core, headline value proposition
> is matching users who were at the same physical places at overlapping times
> (concerts, cafés, public events). Without background location, the app can
> only log a location when the user has the app open, which misses the very
> moments — passing someone on the train, sitting in the same coffee shop
> for 20 minutes — that make the app useful.
>
> Background location is used **only** to:
> 1. Quietly create a timeline of cities, venues, and rough GPS clusters
>    where the user has been (NEVER shared publicly).
> 2. Compare that timeline against other consenting users' timelines on
>    our server (using server-side spatial indexing — no peer-to-peer
>    tracking).
> 3. Surface a "you crossed paths with X" notification when a match is found.
>
> Background location is:
> - **Opt-in only**. The Prominent Location Disclosure modal
>   (`LocationDisclosureModal.js`) is shown BEFORE we request runtime
>   permission, and explicitly mentions background use.
> - **Honored via Ghost Mode**, a one-tap toggle that suspends ALL tracking
>   and hides the user from all matching for as long as it's on.
> - **User-deletable**. Each location ping has a delete button; the entire
>   timeline can be wiped via Settings → Delete location history.
> - Surfaced through a **persistent foreground-service notification**
>   ("Hi Again — tracking") whenever background tracking is active, so the
>   user always knows it's running.

### Does the app work without background location?

> Yes. The same matching algorithm runs against any locations the user logs
> manually (city + venue + date) OR imports via Google Timeline Takeout JSON.
> Users who decline background location get a fully functional foreground-
> only experience. The notification engine simply runs less often.

### Video demonstration

Google will likely ask for a 30-60s screen recording showing:
1. Fresh install
2. Disclosure modal appearing BEFORE the OS permission prompt
3. The persistent foreground service notification while tracking
4. The Ghost Mode toggle suspending tracking
5. Manual delete of a location entry

Record this once and attach. It usually unblocks the review in one round.

---

---

## 8. Store Assets (you still need to create/export these)

### Required
- [ ] **App icon**: 512 × 512 PNG, 32-bit with alpha
- [ ] **Feature graphic**: 1024 × 500 PNG/JPG (no transparency)
- [ ] **Phone screenshots**: 2 to 8. Min 320px, max 3840px. 16:9 or 9:16.
- [ ] **Short promo video (optional but recommended)**: YouTube URL

### Screenshot ideas (make 6 of these)
1. **Hero with crossing** — "You crossed paths with Maya at Petco Park" notification
2. **Feed** — missed-connection posts with photos
3. **Gatherings page** — upcoming events with attendee avatars
4. **Timeline import** — Google Takeout drag-and-drop
5. **Ghost Mode toggle** — privacy emphasis
6. **Premium page** — subscription value prop

### Icon design brief
- "Sunset Noir" palette: sunset orange `#FF6B35` on deep navy `#0B1220`
- Mark suggestion: two path lines meeting at a point, forming a soft "H"
- Avoid text — Play Store strips it at small sizes

### Required
- [ ] **App icon**: 512 × 512 PNG, 32-bit with alpha
- [ ] **Feature graphic**: 1024 × 500 PNG/JPG (no transparency)
- [ ] **Phone screenshots**: 2 to 8. Min 320px, max 3840px. 16:9 or 9:16.
- [ ] **Short promo video (optional but recommended)**: YouTube URL

### Screenshot ideas (make 6 of these)
1. **Hero with crossing** — "You crossed paths with Maya at Petco Park" notification
2. **Feed** — missed-connection posts with photos
3. **Gatherings page** — upcoming events with attendee avatars
4. **Timeline import** — Google Takeout drag-and-drop
5. **Ghost Mode toggle** — privacy emphasis
6. **Premium page** — subscription value prop

### Icon design brief
- "Sunset Noir" palette: sunset orange `#FF6B35` on deep navy `#0B1220`
- Mark suggestion: two path lines meeting at a point, forming a soft "H"
- Avoid text — Play Store strips it at small sizes

---

## 9. Technical Requirements for the AAB

| Requirement | Target |
|---|---|
| Target SDK | **34** (Android 14) |
| Min SDK | **23** (Android 6) |
| Package name | `com.crowdspulse.hiagain` |
| Version code | increment every upload |
| Version name | e.g. `1.0.0` |
| Signing | Play App Signing (let Google manage the upload key) |
| Format | **AAB** (Android App Bundle) — `.apk` uploads rejected |

### Capacitor build command
```bash
cd /app/frontend
yarn build
npx cap sync android
cd android
./gradlew bundleRelease
# AAB output: android/app/build/outputs/bundle/release/app-release.aab
```

---

## 10. Pre-submission Checklist

- [x] DNS verified ✅ (done May 7)
- [x] Prominent disclosure screen built & shown before location prompt ✅ (May 26)
- [x] Privacy Policy URL accessible without login ✅ (`/privacy`)
- [x] Terms URL accessible without login ✅ (`/terms`)
- [x] CAN-SPAM compliant unsubscribe in all emails ✅ (May 8)
- [x] Firebase Crashlytics wired (Gradle plugin + Capacitor plugin) ✅ (May 28)
- [x] FCM push notifications wired (backend + frontend) ✅ (May 28)
- [x] Background geolocation plugin installed ✅ (May 28)
- [x] AndroidManifest has FOREGROUND_SERVICE_LOCATION, POST_NOTIFICATIONS ✅
- [x] Gradle signing config ready (just needs your `keystore.properties`) ✅
- [x] ProGuard rules for Capacitor + Firebase + plugins ✅
- [ ] Generate the release keystore locally and fill `keystore.properties`
- [ ] 5-10 real beta testers have signed up and not hit bugs
- [ ] Stripe live mode tested with real card + refund flow
- [ ] Email deliverability tested across Gmail / Outlook / Yahoo / iCloud
- [ ] App icon exported 512×512
- [ ] 6 phone screenshots exported
- [ ] Feature graphic 1024×500 exported
- [ ] Play Developer account paid ($25 one-time)
- [ ] Background location demo video recorded (30-60s) — see Section 7

---

## 11. Launch Strategy

**Internal testing → Closed testing → Open testing → Production.** Don't skip.

1. **Week 1**: Internal test (yourself + 2-3 devices). Fix crashes.
2. **Week 2**: Closed test with 20 friends (your `FRIENDS2026` promo pool). Collect feedback.
3. **Week 3**: Open test (public opt-in). Play Store visibility starts.
4. **Week 4+**: Promote to Production.

First Open Test rejection is normal. Common Google rejections for location apps:
- Missing prominent disclosure → build the screen in Section 6
- Background location without justification → be explicit it's for crossings
- Privacy policy doesn't mention third parties → list Stripe, Resend, etc.

Good luck! 🎉
