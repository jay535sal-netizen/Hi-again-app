# ProGuard rules for Hi Again
#
# `minifyEnabled` is currently `false`, so these rules are NOT applied to the
# default release build. They're future-proofed for when shrinking is turned
# on (typically post-launch to reduce APK size 30-40%).
#
# Keep stack-trace line numbers so Crashlytics symbolicates properly:
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Capacitor — JS-bridge classes are loaded reflectively from web code
-keep class com.getcapacitor.** { *; }
-keep class com.getcapacitor.plugin.** { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }

# Cordova-style plugins (still used by some bridged code)
-keep class org.apache.cordova.** { *; }

# Firebase / FCM / Crashlytics
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions

# @capacitor-community/background-geolocation
-keep class com.equimaps.capacitorblobwriter.** { *; }
-keep class com.equimaps.capacitor_background_geolocation.** { *; }

# @capacitor-community/bluetooth-le
-keep class com.capacitorjs.community.plugins.ble.** { *; }

# Generic safety nets used by Stripe/Resend integrations the WebView calls
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
