import { useEffect, useState, useCallback } from 'react';
import { Button } from './ui/button';
import { Radio, Loader2, CheckCircle2, MapPin, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { gpsApi } from '../lib/api';
import LocationDisclosureModal, { hasSeenLocationDisclosure } from './LocationDisclosureModal';

// Recommended path: one-click auto location tracking. Sets localStorage flag
// so GPSTracker auto-resumes on subsequent visits.
export default function AutoTrackCTA() {
    const [enabled, setEnabled] = useState(() => {
        try { return localStorage.getItem('hiagain.gps_auto') === '1'; } catch { return false; }
    });
    const [busy, setBusy] = useState(false);
    const [permState, setPermState] = useState('prompt');
    const [showDisclosure, setShowDisclosure] = useState(false);

    useEffect(() => {
        if (!navigator.permissions) return;
        navigator.permissions
            .query({ name: 'geolocation' })
            .then((status) => setPermState(status.state))
            .catch(() => setPermState('prompt'));
    }, []);

    const beginEnable = useCallback(() => {
        if (!navigator.geolocation) {
            toast.error('GPS is not supported on this device');
            return;
        }
        setBusy(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude, accuracy } = pos.coords;
                try {
                    await gpsApi.ping(latitude, longitude, accuracy);
                    try { localStorage.setItem('hiagain.gps_auto', '1'); } catch {
                        // localStorage unavailable — non-critical
                    }
                    setEnabled(true);
                    setPermState('granted');
                    toast.success("You're auto-tracking now — every place you go gets logged");
                } catch {
                    toast.error('Could not enable auto-tracking');
                } finally {
                    setBusy(false);
                }
            },
            (err) => {
                setBusy(false);
                if (err.code === err.PERMISSION_DENIED) {
                    toast.error('Location permission denied. Enable it in your browser settings.');
                } else {
                    toast.error('Could not get your location');
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }, []);

    // Public click handler: show the Play Store-mandated prominent disclosure
    // FIRST. Only after the user taps "Allow" do we trigger the OS prompt.
    const enableAuto = useCallback(() => {
        if (!hasSeenLocationDisclosure()) {
            setShowDisclosure(true);
            return;
        }
        beginEnable();
    }, [beginEnable]);

    const disableAuto = useCallback(() => {
        try { localStorage.removeItem('hiagain.gps_auto'); } catch {
            // localStorage unavailable — non-critical
        }
        setEnabled(false);
        toast.info('Auto-tracking turned off');
    }, []);

    if (enabled) {
        return (
            <>
                <div
                    className="flex items-center gap-3 rounded-2xl px-4 py-3 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30"
                    data-testid="auto-track-active"
                >
                    <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">Auto-tracking is on</p>
                        <p className="text-xs text-emerald-200/80">
                            Locations log automatically while Hi Again is open. Your timeline builds itself.
                        </p>
                    </div>
                    <Button
                        onClick={disableAuto}
                        variant="outline"
                        size="sm"
                        className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                        data-testid="auto-track-disable"
                    >
                        Turn off
                    </Button>
                </div>
                <LocationDisclosureModal
                    open={showDisclosure}
                    onAllow={() => { setShowDisclosure(false); beginEnable(); }}
                    onDismiss={() => setShowDisclosure(false)}
                />
            </>
        );
    }

    return (
        <>
            <div
                className="rounded-2xl p-5 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-rose-500/10 border border-amber-500/30"
                data-testid="auto-track-cta"
            >
            <div className="flex items-start gap-4">
                <div className="w-11 h-11 shrink-0 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-amber-300" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-white mb-1">
                        Auto-track my places
                    </h3>
                    <p className="text-sm text-white/70 mb-3 leading-relaxed">
                        One tap and Hi Again logs every place you visit while the app is open — no
                        Google Takeout, no manual entry. Your timeline builds itself.
                    </p>
                    <div className="flex flex-wrap gap-3 items-center">
                        <Button
                            onClick={enableAuto}
                            disabled={busy || permState === 'denied'}
                            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-95 text-white font-semibold"
                            data-testid="auto-track-enable"
                        >
                            {busy ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Asking permission…
                                </>
                            ) : (
                                <>
                                    <MapPin className="w-4 h-4 mr-2" />
                                    Turn on auto-tracking
                                </>
                            )}
                        </Button>
                        {permState === 'denied' ? (
                            <span className="text-xs text-rose-300">
                                Location is blocked in your browser. Enable it in site settings to use auto-track.
                            </span>
                        ) : (
                            <span className="text-xs text-white/50 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                Private — only matched against other users, never shown publicly
                            </span>
                        )}
                    </div>
                </div>
            </div>
            </div>
            <LocationDisclosureModal
                open={showDisclosure}
                onAllow={() => { setShowDisclosure(false); beginEnable(); }}
                onDismiss={() => setShowDisclosure(false)}
            />
        </>
    );
}
