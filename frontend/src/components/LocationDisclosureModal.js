import { useState } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Eye, Lock, Bell, Shield, X } from 'lucide-react';
import { Button } from './ui/button';

const STORAGE_KEY = 'hiagain.location_disclosure_v1';

export function hasSeenLocationDisclosure() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

function markSeen() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {
        // localStorage unavailable — non-critical
    }
}

/**
 * Prominent location-permission disclosure required by Google Play for any
 * app that accesses ACCESS_FINE_LOCATION (especially background). MUST be
 * shown BEFORE the browser/OS permission prompt and BEFORE any background
 * location use. Copy aligns with Play Console's "prominent disclosure" rules.
 *
 * Usage:
 *   const [open, setOpen] = useState(!hasSeenLocationDisclosure());
 *   <LocationDisclosureModal open={open} onAllow={...} onDismiss={...} />
 */
export default function LocationDisclosureModal({ open, onAllow, onDismiss }) {
    const [submitting, setSubmitting] = useState(false);
    if (!open) return null;

    const handleAllow = async () => {
        setSubmitting(true);
        markSeen();
        try {
            await onAllow?.();
        } finally {
            setSubmitting(false);
        }
    };
    const handleDismiss = () => {
        markSeen();
        onDismiss?.();
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            data-testid="location-disclosure-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="location-disclosure-title"
        >
            <div className="relative w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
                <button
                    onClick={handleDismiss}
                    className="absolute top-3 right-3 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
                    aria-label="Close"
                    data-testid="location-disclosure-close"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="p-6">
                    <div className="flex justify-center mb-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                            <MapPin className="w-7 h-7 text-white" />
                        </div>
                    </div>
                    <h2
                        id="location-disclosure-title"
                        className="text-xl font-bold text-white text-center mb-2"
                    >
                        Hi Again uses your location
                    </h2>
                    <p className="text-sm text-slate-400 text-center mb-5 leading-relaxed">
                        To find people you've crossed paths with, Hi Again needs access to your device location.
                    </p>

                    <ul className="space-y-3 mb-5">
                        <DisclosureRow
                            icon={MapPin}
                            color="text-amber-400 bg-amber-500/10 border-amber-500/30"
                            title="While using the app"
                            body="Detect your current city/venue for matching."
                        />
                        <DisclosureRow
                            icon={Bell}
                            color="text-rose-300 bg-rose-500/10 border-rose-500/30"
                            title="In the background (optional)"
                            body="Automatically build your location timeline so you don't have to log places manually. You control this in Settings."
                        />
                        <DisclosureRow
                            icon={Eye}
                            color="text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
                            title="Never shown publicly"
                            body="Your location is only matched against other Hi Again users. We never publish it."
                        />
                        <DisclosureRow
                            icon={Lock}
                            color="text-sky-300 bg-sky-500/10 border-sky-500/30"
                            title="Ghost Mode anytime"
                            body="Toggle Ghost Mode to instantly disable matching and hide yourself."
                        />
                        <DisclosureRow
                            icon={Shield}
                            color="text-purple-300 bg-purple-500/10 border-purple-500/30"
                            title="Deletable any time"
                            body="Remove your full location history from Settings → Account → Delete data."
                        />
                    </ul>

                    <p className="text-xs text-slate-500 text-center mb-5 leading-relaxed">
                        By continuing, you agree to our{' '}
                        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">
                            Privacy Policy
                        </a>
                        {' '}and{' '}
                        <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">
                            Terms
                        </a>
                        .
                    </p>

                    <div className="flex flex-col gap-2">
                        <Button
                            onClick={handleAllow}
                            disabled={submitting}
                            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-95 text-white font-semibold py-3"
                            data-testid="location-disclosure-allow"
                        >
                            Allow location access
                        </Button>
                        <Button
                            onClick={handleDismiss}
                            variant="ghost"
                            className="w-full text-slate-400 hover:text-white"
                            data-testid="location-disclosure-deny"
                        >
                            Not now
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

function DisclosureRow({ icon: Icon, color, title, body }) {
    return (
        <li className="flex items-start gap-3">
            <div className={`shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center ${color}`}>
                <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="text-xs text-slate-400 leading-relaxed">{body}</p>
            </div>
        </li>
    );
}
