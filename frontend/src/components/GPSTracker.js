import { useState, useEffect, useCallback, useRef } from 'react';
import { gpsApi } from '../lib/api';
import { addLocationWatcher, removeLocationWatcher, isNativeAndroid, openLocationSettings } from '../lib/location';
import { Button } from './ui/button';
import { 
    MapPin, Loader2, Navigation, Users, AlertCircle, 
    CheckCircle, Radio, X, Radar
} from 'lucide-react';
import { toast } from 'sonner';
import LocationDisclosureModal, { hasSeenLocationDisclosure } from './LocationDisclosureModal';

export default function GPSTracker({ onMatchFound, compact = false }) {
    const [tracking, setTracking] = useState(false);
    const [location, setLocation] = useState(null);
    const [nearbyUsers, setNearbyUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [matchesFound, setMatchesFound] = useState(0);
    const [autoResume, setAutoResume] = useState(() => {
        try { return localStorage.getItem('hiagain.gps_auto') === '1'; } catch { return false; }
    });
    const watchIdRef = useRef(null);
    const pingIntervalRef = useRef(null);
    const locationRef = useRef(null);
    const autoStartedRef = useRef(false);
    const [showDisclosure, setShowDisclosure] = useState(false);

    // Keep locationRef in sync with location state
    useEffect(() => {
        locationRef.current = location;
    }, [location]);

    // Define fetchNearbyUsers BEFORE sendPing since sendPing depends on it
    const fetchNearbyUsers = useCallback(async (lat, lon) => {
        try {
            const response = await gpsApi.getNearby(lat, lon, 1000);
            setNearbyUsers(response.data);
        } catch {
            // Nearby users fetch failed - non-critical UI update
        }
    }, []);

    const sendPing = useCallback(async (lat, lon, acc) => {
        try {
            const response = await gpsApi.ping(lat, lon, acc);
            if (response.data.matches_found > 0) {
                setMatchesFound(prev => prev + response.data.matches_found);
                toast.success(`New nearby match found!`);
                onMatchFound?.(response.data.matches_found);
                fetchNearbyUsers(lat, lon);
            }
        } catch {
            // Background ping failed - will retry on next interval
        }
    }, [onMatchFound, fetchNearbyUsers]);

    const stopTracking = useCallback(async () => {
        if (watchIdRef.current) {
            await removeLocationWatcher(watchIdRef.current);
            watchIdRef.current = null;
        }
        if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
        }
        setTracking(false);
        // Forget the opt-in so it doesn't re-resume next visit
        try { localStorage.removeItem('hiagain.gps_auto'); } catch {
            // localStorage unavailable — non-critical
        }
        setAutoResume(false);
        toast.info('GPS tracking stopped');
    }, []);

    const beginTracking = useCallback(async () => {
        setLoading(true);
        setError(null);

        let firstFixDelivered = false;
        try {
            const handle = await addLocationWatcher(async (coords, errMsg) => {
                if (errMsg) {
                    setLoading(false);
                    if (errMsg === 'geolocation-unsupported') {
                        setError('Geolocation is not supported on this device');
                        toast.error('GPS not supported on this device');
                        return;
                    }
                    setError(errMsg);
                    if (errMsg === 'NOT_AUTHORIZED' && isNativeAndroid()) {
                        const ok = window.confirm(
                            'Hi Again needs your location, but does not have permission.\n\nOpen Settings now?'
                        );
                        if (ok) openLocationSettings();
                    } else {
                        toast.error(errMsg);
                    }
                    return;
                }
                if (!coords) return;

                const { latitude, longitude, accuracy } = coords;
                setLocation({ latitude, longitude, accuracy });

                if (!firstFixDelivered) {
                    firstFixDelivered = true;
                    setLoading(false);
                    setTracking(true);
                    toast.success('GPS tracking started');
                    try { localStorage.setItem('hiagain.gps_auto', '1'); } catch {
                        // localStorage unavailable (e.g. private mode) — silent fallback
                    }
                    setAutoResume(true);

                    // Initial ping + nearby fetch
                    try {
                        const response = await gpsApi.ping(latitude, longitude, accuracy);
                        if (response.data.matches_found > 0) {
                            setMatchesFound(prev => prev + response.data.matches_found);
                            toast.success(`Found ${response.data.matches_found} nearby match(es)!`);
                            onMatchFound?.(response.data.matches_found);
                        }
                    } catch {
                        // Initial GPS ping failed — non-critical, will retry on interval
                    }
                    fetchNearbyUsers(latitude, longitude);
                }
            });
            watchIdRef.current = handle;

            // Periodic ping (every 5 min) using the latest cached location
            pingIntervalRef.current = setInterval(() => {
                const currentLoc = locationRef.current;
                if (currentLoc) {
                    sendPing(currentLoc.latitude, currentLoc.longitude, currentLoc.accuracy);
                }
            }, 5 * 60 * 1000);
        } catch (err) {
            setLoading(false);
            const msg = err?.message || 'Failed to start GPS tracking';
            setError(msg);
            toast.error(msg);
        }
    }, [onMatchFound, fetchNearbyUsers, sendPing]);

    // Public starter: shows the Play Store-mandated prominent disclosure
    // BEFORE we ever call navigator.geolocation. If the user has already
    // seen & accepted it, skip straight to beginTracking.
    const startTracking = useCallback(() => {
        if (!hasSeenLocationDisclosure()) {
            setShowDisclosure(true);
            return;
        }
        beginTracking();
    }, [beginTracking]);

    // AUTO-RESUME: If user previously opted in AND browser already granted
    // location permission AND they've seen the prominent disclosure, start
    // tracking silently. Skips auto-resume if disclosure not yet acknowledged
    // (the user must explicitly tap Start to see and accept it first).
    useEffect(() => {
        if (autoStartedRef.current) return;
        if (!autoResume) return;
        if (!hasSeenLocationDisclosure()) return;
        autoStartedRef.current = true;
        // On native Android, the plugin manages its own permission state, so
        // skip the navigator.permissions probe and just resume tracking.
        if (isNativeAndroid()) {
            beginTracking();
            return;
        }
        if (!navigator.geolocation || !navigator.permissions) return;
        (async () => {
            try {
                const status = await navigator.permissions.query({ name: 'geolocation' });
                if (status.state === 'granted') {
                    beginTracking();
                }
            } catch {
                // Permissions API not supported — skip auto-resume
            }
        })();
    }, [autoResume, beginTracking]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (watchIdRef.current) {
                removeLocationWatcher(watchIdRef.current);
                watchIdRef.current = null;
            }
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
                pingIntervalRef.current = null;
            }
        };
    }, []);

    const getProximityColor = (level) => {
        switch (level) {
            case 'venue': return 'text-emerald-400 bg-emerald-500/20';
            case 'nearby': return 'text-amber-400 bg-amber-500/20';
            case 'area': return 'text-blue-400 bg-blue-500/20';
            default: return 'text-slate-400 bg-slate-500/20';
        }
    };

    const getProximityLabel = (level) => {
        switch (level) {
            case 'venue': return 'Same venue';
            case 'nearby': return 'Very close';
            case 'area': return 'Same area';
            default: return 'Nearby';
        }
    };

    // Compact mode - just a toggle button
    if (compact) {
        return (
            <>
                <Button
                    onClick={tracking ? stopTracking : startTracking}
                    disabled={loading}
                    className={tracking 
                        ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30'
                    }
                    data-testid="gps-toggle-compact"
                >
                    {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : tracking ? (
                        <>
                            <Radio className="w-4 h-4 mr-2 animate-pulse" />
                            Tracking
                        </>
                    ) : (
                        <>
                            <Navigation className="w-4 h-4 mr-2" />
                            Enable GPS
                        </>
                    )}
                </Button>
                <LocationDisclosureModal
                    open={showDisclosure}
                    onAllow={() => { setShowDisclosure(false); beginTracking(); }}
                    onDismiss={() => setShowDisclosure(false)}
                />
            </>
        );
    }

    // Full component
    return (
        <div className="glass-card p-6" data-testid="gps-tracker">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        tracking ? 'bg-emerald-500/20' : 'bg-slate-700'
                    }`}>
                        {tracking ? (
                            <Radar className="w-5 h-5 text-emerald-400 animate-pulse" />
                        ) : (
                            <MapPin className="w-5 h-5 text-slate-400" />
                        )}
                    </div>
                    <div>
                        <h3 className="font-heading text-lg text-white">GPS Proximity</h3>
                        <p className="text-xs text-slate-400">
                            {tracking ? 'Scanning for nearby paths' : 'Enable to find nearby matches'}
                        </p>
                    </div>
                </div>

                <Button
                    onClick={tracking ? stopTracking : startTracking}
                    disabled={loading}
                    size="sm"
                    className={tracking 
                        ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
                        : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                    }
                    data-testid="gps-toggle"
                >
                    {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : tracking ? (
                        <>
                            <X className="w-4 h-4 mr-1" />
                            Stop
                        </>
                    ) : (
                        <>
                            <Navigation className="w-4 h-4 mr-1" />
                            Start
                        </>
                    )}
                </Button>
            </div>

            {/* Error State */}
            {error && (
                <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {/* Current Location */}
            {location && tracking && (
                <div className="flex items-center gap-2 p-3 mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <p className="text-emerald-400 text-sm">
                        GPS active • Accuracy: {Math.round(location.accuracy || 0)}m
                    </p>
                </div>
            )}

            {/* Stats */}
            {tracking && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 bg-slate-800/50 rounded-lg text-center">
                        <div className="text-xl font-bold text-amber-400">{matchesFound}</div>
                        <div className="text-xs text-slate-400">Matches Found</div>
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded-lg text-center">
                        <div className="text-xl font-bold text-blue-400">{nearbyUsers.length}</div>
                        <div className="text-xs text-slate-400">People Nearby</div>
                    </div>
                </div>
            )}

            {/* Nearby Users List */}
            {tracking && nearbyUsers.length > 0 && (
                <div>
                    <h4 className="text-sm text-slate-400 mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Nearby Now
                    </h4>
                    <div className="space-y-2">
                        {nearbyUsers.slice(0, 5).map((user) => (
                            <div 
                                key={user.user_id}
                                className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center text-white text-xs font-medium">
                                        {user.user_name?.charAt(0)?.toUpperCase() || '?'}
                                    </div>
                                    <div>
                                        <p className="text-white text-sm font-medium">{user.user_name}</p>
                                        <p className="text-xs text-slate-500">{Math.round(user.distance_meters)}m away</p>
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded-full text-xs ${getProximityColor(user.proximity_level)}`}>
                                    {getProximityLabel(user.proximity_level)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State when tracking but no nearby users */}
            {tracking && nearbyUsers.length === 0 && !loading && (
                <div className="text-center py-6">
                    <Radar className="w-10 h-10 text-slate-600 mx-auto mb-2 animate-pulse" />
                    <p className="text-slate-400 text-sm">Scanning for nearby people...</p>
                    <p className="text-slate-500 text-xs mt-1">We'll notify you when someone is nearby</p>
                </div>
            )}

            <LocationDisclosureModal
                open={showDisclosure}
                onAllow={() => { setShowDisclosure(false); beginTracking(); }}
                onDismiss={() => setShowDisclosure(false)}
            />
        </div>
    );
}
