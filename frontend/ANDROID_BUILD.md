# Hi Again - Android APK Build Guide

## Prerequisites
- Android Studio installed (download: https://developer.android.com/studio)
- Java JDK 17+ installed
- At least 8GB RAM recommended

## Step 1: Open Project in Android Studio

```bash
# From the frontend directory
npx cap open android
```

This will open the Android project in Android Studio.

## Step 2: Configure App Icons

Replace the default icons in:
- `android/app/src/main/res/mipmap-hdpi/` (72x72)
- `android/app/src/main/res/mipmap-mdpi/` (48x48)
- `android/app/src/main/res/mipmap-xhdpi/` (96x96)
- `android/app/src/main/res/mipmap-xxhdpi/` (144x144)
- `android/app/src/main/res/mipmap-xxxhdpi/` (192x192)

Use the Hi Again logo (headphones with heart pin) for all icons.

**Quick icon generation:**
Visit https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html
Upload your logo and download the generated icons.

## Step 3: Configure Splash Screen

Edit `android/app/src/main/res/values/styles.xml`:
```xml
<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
    <item name="android:background">#0A0F1C</item>
</style>
```

## Step 4: Build Debug APK

In Android Studio:
1. Click **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. Wait for build to complete
3. APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

**Or via command line:**
```bash
cd android
./gradlew assembleDebug
```

## Step 5: Build Release APK (for Play Store)

### Generate Signing Key (one-time)
```bash
keytool -genkey -v -keystore hiagain-release.keystore -alias hiagain -keyalg RSA -keysize 2048 -validity 10000
```

### Configure Signing
Create `android/key.properties`:
```
storePassword=YOUR_STORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=hiagain
storeFile=../hiagain-release.keystore
```

### Build Release APK
```bash
cd android
./gradlew assembleRelease
```

APK location: `android/app/build/outputs/apk/release/app-release.apk`

## Step 6: Test on Device

1. Enable "Developer Options" on your Android phone
2. Enable "USB Debugging"
3. Connect phone via USB
4. Run: `npx cap run android`

## Step 7: Upload to Play Store

1. Go to https://play.google.com/console
2. Create new app "Hi Again"
3. Upload AAB file (Build → Build Bundle instead of APK)
4. Fill in store listing (use MARKETING_ASSETS.md)
5. Complete content rating questionnaire
6. Set pricing (Free with in-app purchases)
7. Submit for review

## Updating the App

After making changes to the web app:
```bash
# Build the web app
yarn build

# Sync with Android
npx cap sync android

# Open in Android Studio
npx cap open android
```

## Troubleshooting

**"SDK location not found"**
Create `android/local.properties`:
```
sdk.dir=/path/to/your/Android/Sdk
```

**Build fails with Java version error**
Ensure JAVA_HOME points to JDK 17+:
```bash
export JAVA_HOME=/path/to/jdk-17
```

**White screen on app launch**
Run `npx cap sync android` to copy latest web assets.

---

## App Store Checklist

- [ ] App icon (512x512 PNG for Play Store)
- [ ] Feature graphic (1024x500)
- [ ] Screenshots (phone & tablet)
- [ ] Privacy policy URL: https://hiagain.xyz/privacy
- [ ] Short description (80 chars)
- [ ] Full description
- [ ] Content rating completed
- [ ] Target audience defined (18+)
- [ ] In-app purchases configured (Premium subscription)
