// Unified location API for Hi Again.
//
// On Android (Capacitor native build) we use @capacitor-community/background-
// geolocation, which keeps a foreground service alive and continues delivering
// updates even when the app is backgrounded or the screen is off.
//
// On web / preview we fall back to navigator.geolocation, which only works
// while the tab is in the foreground. That's fine — the Play Store build is
// what matters for true background tracking.

import { Capacitor, registerPlugin } from '@capacitor/core';

const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

export function isNativeAndroid() {
    try {
        return Capacitor.isNativePlatform && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
    } catch {
        return false;
    }
}

// Add a watcher. Returns a Promise<string> that resolves to the watcher id.
// `onUpdate` is called with `(coords)` on each fix or `(null, errorMessage)`
// when permission is denied or the device cannot get a fix.
export async function addLocationWatcher(onUpdate, options = {}) {
    if (isNativeAndroid()) {
        const id = await BackgroundGeolocation.addWatcher(
            {
                backgroundMessage: options.backgroundMessage || 'Hi Again is matching your paths.',
                backgroundTitle: options.backgroundTitle || 'Hi Again — tracking',
                requestPermissions: options.requestPermissions !== false,
                stale: false,
                distanceFilter: options.distanceFilter ?? 50,
            },
            (location, error) => {
                if (error) {
                    onUpdate(null, error.message || error.code || 'location-error');
                    return;
                }
                if (!location) return;
                onUpdate({
                    latitude: location.latitude,
                    longitude: location.longitude,
                    accuracy: location.accuracy ?? null,
                    speed: location.speed ?? null,
                    bearing: location.bearing ?? null,
                    timestamp: location.time || Date.now(),
                });
            },
        );
        return { type: 'native', id };
    }

    if (!navigator.geolocation) {
        onUpdate(null, 'geolocation-unsupported');
        return { type: 'web', id: null };
    }

    const id = navigator.geolocation.watchPosition(
        (pos) => onUpdate({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed,
            bearing: pos.coords.heading,
            timestamp: pos.timestamp,
        }),
        (err) => onUpdate(null, err.message || `code-${err.code}`),
        {
            enableHighAccuracy: true,
            timeout: options.timeout ?? 10000,
            maximumAge: options.maximumAge ?? 30000,
        },
    );
    return { type: 'web', id };
}

export async function removeLocationWatcher(handle) {
    if (!handle) return;
    if (handle.type === 'native' && handle.id) {
        try { await BackgroundGeolocation.removeWatcher({ id: handle.id }); } catch {
            // already removed — non-critical
        }
        return;
    }
    if (handle.type === 'web' && handle.id != null) {
        try { navigator.geolocation.clearWatch(handle.id); } catch {
            // ignore
        }
    }
}

// Open the OS location settings page (native only — useful when the user has
// denied permission and we need to nudge them into Settings).
export async function openLocationSettings() {
    if (isNativeAndroid()) {
        try { await BackgroundGeolocation.openSettings(); } catch {
            // non-critical
        }
    }
}
