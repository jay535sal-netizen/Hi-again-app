// One-shot initializer that runs once the user is authenticated.
// On native Android only:
//   1. Initialises Crashlytics (sets user id so crashes are attributable)
//   2. Requests POST_NOTIFICATIONS permission (Android 13+)
//   3. Fetches the FCM token and registers it with our backend
//
// On web / preview this is a complete no-op.

import { Capacitor } from '@capacitor/core';
import api from './api';

const REGISTERED_TOKEN_KEY = 'hiagain.fcm_token_registered';

function isNative() {
    try {
        return Capacitor.isNativePlatform && Capacitor.isNativePlatform();
    } catch {
        return false;
    }
}

async function loadMessaging() {
    try {
        const mod = await import('@capacitor-firebase/messaging');
        return mod.FirebaseMessaging;
    } catch {
        return null;
    }
}

async function loadCrashlytics() {
    try {
        const mod = await import('@capacitor-firebase/crashlytics');
        return mod.FirebaseCrashlytics;
    } catch {
        return null;
    }
}

export async function initFirebase(user) {
    if (!isNative()) return;

    const FirebaseCrashlytics = await loadCrashlytics();
    const FirebaseMessaging = await loadMessaging();

    // --- Crashlytics ----------------------------------------------------
    if (FirebaseCrashlytics) {
        try {
            await FirebaseCrashlytics.setEnabled({ enabled: true });
            if (user?.id) {
                await FirebaseCrashlytics.setUserId({ userId: user.id });
            }
        } catch {
            // Crashlytics init failed — non-critical
        }
    }

    // --- Push notifications --------------------------------------------
    if (!FirebaseMessaging) return;
    try {
        const perm = await FirebaseMessaging.checkPermissions();
        if (perm.receive !== 'granted') {
            const req = await FirebaseMessaging.requestPermissions();
            if (req.receive !== 'granted') return; // user denied — stop here
        }

        const { token } = await FirebaseMessaging.getToken();
        if (!token) return;

        // Only re-register if the token has changed since last app start
        const previous = (() => {
            try { return localStorage.getItem(REGISTERED_TOKEN_KEY); } catch { return null; }
        })();
        if (token === previous) return;

        await api.post('/push/register', { token, platform: 'android' });
        try { localStorage.setItem(REGISTERED_TOKEN_KEY, token); } catch {
            // localStorage unavailable — non-critical
        }
    } catch {
        // Permission denied or plugin error — silent fallback
    }
}

// Unregister the current device's push token from the backend. Called on
// logout so an old user's pushes don't follow a new account on the same
// physical device.
export async function clearFirebaseRegistration() {
    if (!isNative()) {
        try { localStorage.removeItem(REGISTERED_TOKEN_KEY); } catch {
            // ignore
        }
        return;
    }
    const FirebaseMessaging = await loadMessaging();
    if (!FirebaseMessaging) return;
    try {
        const { token } = await FirebaseMessaging.getToken();
        if (token) {
            try { await api.delete('/push/register', { data: { token } }); } catch {
                // server might be unreachable on logout — best effort
            }
        }
    } catch {
        // ignore
    }
    try { localStorage.removeItem(REGISTERED_TOKEN_KEY); } catch {
        // ignore
    }
}

// Optional helper: explicit deep-link handler for notification taps. Wire to
// useEffect in App.js if you want notifications to navigate the user.
export function onPushTap(handler) {
    if (!isNative()) return () => {};
    let cleanup = () => {};
    loadMessaging().then((FirebaseMessaging) => {
        if (!FirebaseMessaging) return;
        const sub = FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
            handler(event?.notification?.data || {});
        });
        cleanup = () => { sub.then((s) => s.remove?.()); };
    });
    return () => cleanup();
}
