# Cloud Build Setup — Hi Again Android AAB

**You need this only to ship an Android update. Web app on hiagain.xyz is independent and already live.**

Builds the signed Android `.aab` file (the format Google Play requires) entirely in the cloud via GitHub Actions. **No Android Studio, JDK, or Gradle needed on your machine.** You'll never touch a terminal.

---

## ONE-TIME setup (~10 minutes, all in browser)

### Step 1 — Push the code to GitHub
In the Emergent chat input bar, click **"Save to GitHub"**. Pick a repo name (e.g. `hi-again`) and make it **Private**. Wait until it says "Saved successfully."

### Step 2 — Create the first two repo secrets
Open your repo on github.com → **Settings → Secrets and variables → Actions → New repository secret** and create each of these:

| Secret name | Value | Notes |
|---|---|---|
| `KEYSTORE_PASSWORD` | A strong password you make up | Save in your password manager. Used to sign every release. |
| `KEY_PASSWORD` | Same as above (recommended) | Same value as `KEYSTORE_PASSWORD` is fine. |

> ⚠️ **CRITICAL**: If you ever lose these passwords, you can NEVER push an update to your app on Play Store again. You'd have to publish under a new package name from scratch. **Save them in 1Password / Bitwarden / iCloud Keychain right now.**

### Step 3 — Generate the keystore
On your GitHub repo → **Actions tab** → left sidebar shows workflows → **"Generate Release Keystore (ONE TIME ONLY)"** → click **"Run workflow"** (top right).

- For the input box, type exactly: **`I UNDERSTAND`** (uppercase, no quotes)
- Click the green **"Run workflow"** button
- Wait ~30 seconds for it to finish (green checkmark)

### Step 4 — Save the keystore from the run output
Click the completed workflow run. You'll see:

- **A "Summary" section at the top** showing a long base64 string. **Select all of it** (triple-click the code block) and copy.
- **An "Artifacts" section at the bottom** with `hi-again-release-keystore`. **Click to download.** Save the `.jks` file inside the zip into your password manager AS A BACKUP (you'll need it if GitHub ever loses your secret).

### Step 5 — Create the third repo secret
Back at **Settings → Secrets → New repository secret**:

| Secret name | Value |
|---|---|
| `KEYSTORE_BASE64` | The long base64 string you copied from the workflow Summary |

### Step 6 — Create the fourth repo secret
Open `frontend/android/app/google-services.json` in your GitHub repo. Click **Raw**, select all, copy.

Back at **Settings → Secrets → New repository secret**:

| Secret name | Value |
|---|---|
| `GOOGLE_SERVICES_JSON` | The full JSON contents you just copied |

---

## Build the AAB (anytime after setup, ~5 min)

1. GitHub repo → **Actions tab** → **"Build Android AAB"** → **"Run workflow"** → green button
2. Wait ~5 min for the green checkmark
3. Click the completed run → scroll to **"Artifacts"** → download **`hi-again-release-aab`**
4. Unzip it → you have `app-release.aab`

That's the file you upload to Google Play Console.

---

## Upload to Play Store

1. https://play.google.com/console → your app (create it if first time)
2. Left sidebar → **Testing → Closed testing → Create new track** (recommended for first launch — gets approved faster than Production)
3. **Releases → Create new release** → drag `app-release.aab` in
4. Release notes: "Initial launch of Hi Again — missed connections by real-world overlap."
5. **Testers** → Create email list → add 5-10 friends' Gmail addresses
6. **Review release → Start rollout to Closed testing**

Approval typically: **24-48 hr** for Closed Testing (vs 3-7 days for Production).

---

## After Closed Testing succeeds

Production rollout is one click:

1. Same app on Play Console → **Production → Create new release → Promote release**
2. Pick the Closed Testing release that's working → Promote
3. Submit for production review

---

## How to ship updates later

1. Make code changes in Emergent
2. Click **"Save to GitHub"** → pushes the new code
3. The "Build Android AAB" workflow auto-triggers on push to `main`
4. Download the new AAB from the Actions tab
5. Upload to Play Console as a new release (bump `versionCode` in `frontend/android/app/build.gradle` first)

---

## Troubleshooting

**Workflow fails on "Verify required secrets"**
→ One of the 4 secrets isn't set. Re-check Settings → Secrets → Actions.

**Workflow fails on "Build signed release AAB"**
→ Click the failed step, scroll to the red `--stacktrace` output, paste it in Emergent chat and I'll diagnose.

**Workflow fails on "Restore google-services.json"**
→ Your `GOOGLE_SERVICES_JSON` secret has a typo. The package name inside must be exactly `com.crowdspulse.hiagain` (all lowercase). Re-paste from `frontend/android/app/google-services.json`.

**Play Console says "AAB is unsigned"**
→ Almost always means `KEYSTORE_BASE64` got corrupted on paste (a newline snuck in). Re-run "Generate Release Keystore" and re-paste the base64 string carefully.

**You lost the keystore password**
→ Generate a new keystore. Your existing app on Play Store is now orphaned — you must publish under a new package name. This is why we beg you to save the password.
