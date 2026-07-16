import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { discoverApi, connectionsApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import {
    Sparkles, Users, MapPin, Calendar, Loader2, Crown, Eye, Heart, X as XIcon, Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import { getInitials } from '../lib/utils';

const REASON_ICON = {
    Lives: MapPin,
    'Been to': MapPin,
    Mutual: Users,
    Attending: Calendar,
};

function reasonIcon(reason = '') {
    const key = Object.keys(REASON_ICON).find((k) => reason.startsWith(k));
    return REASON_ICON[key] || Sparkles;
}

const SWIPE_THRESHOLD = 110; // px before a swipe commits

export default function Discover() {
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [index, setIndex] = useState(0);
    const [history, setHistory] = useState([]); // for Undo
    const [sending, setSending] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await discoverApi.getCandidates();
            setCandidates(res.data || []);
            setIndex(0);
            setHistory([]);
        } catch (err) {
            console.error('Discover load failed', err);
            toast.error('Could not load suggestions');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const sayHi = useCallback(async (candidate) => {
        if (!candidate) return;
        setSending(true);
        try {
            await connectionsApi.create({ target_id: candidate.user_id });
            toast.success(`Hi sent to ${candidate.name.split(' ')[0]} 👋`);
        } catch (err) {
            const detail = err?.response?.data?.detail || 'Could not send request';
            toast.error(detail);
        } finally {
            setSending(false);
        }
    }, []);

    const handleDecision = useCallback(
        async (decision) => {
            const current = candidates[index];
            if (!current) return;
            setHistory((h) => [...h, { index, decision }]);
            if (decision === 'hi') {
                await sayHi(current);
            }
            setIndex((i) => i + 1);
        },
        [candidates, index, sayHi]
    );

    const handleUndo = useCallback(() => {
        setHistory((h) => {
            if (!h.length) return h;
            const last = h[h.length - 1];
            setIndex(last.index);
            return h.slice(0, -1);
        });
    }, []);

    const visibleCards = useMemo(
        () => candidates.slice(index, index + 3).reverse(),
        [candidates, index]
    );

    if (loading) {
        return (
            <div
                className="min-h-[70vh] flex items-center justify-center"
                data-testid="discover-loading"
            >
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            </div>
        );
    }

    const done = index >= candidates.length;

    return (
        <div
            className="max-w-md mx-auto px-4 py-8 flex flex-col"
            style={{ minHeight: 'calc(100vh - 80px)' }}
            data-testid="discover-page"
        >
            <header className="mb-6">
                <h1
                    className="text-3xl sm:text-4xl font-serif text-white"
                    data-testid="discover-title"
                >
                    Discover
                </h1>
                <p className="text-sm text-white/50 mt-1">
                    Swipe right to say hi · Left to pass
                </p>
            </header>

            {done || candidates.length === 0 ? (
                <EmptyState onReload={load} />
            ) : (
                <>
                    <div
                        className="relative w-full aspect-[3/4] mb-5"
                        data-testid="swipe-stack"
                    >
                        {visibleCards.map((c, idx) => {
                            const isTop = idx === visibleCards.length - 1;
                            const stackPos = visibleCards.length - 1 - idx; // 0 top, 1 mid, 2 back
                            return (
                                <SwipeCard
                                    key={c.user_id}
                                    candidate={c}
                                    isTop={isTop}
                                    stackPos={stackPos}
                                    sending={sending}
                                    onDecide={handleDecision}
                                />
                            );
                        })}
                    </div>

                    <ActionBar
                        canUndo={history.length > 0}
                        onUndo={handleUndo}
                        onPass={() => handleDecision('pass')}
                        onHi={() => handleDecision('hi')}
                        sending={sending}
                        candidate={candidates[index]}
                    />
                </>
            )}
        </div>
    );
}

function SwipeCard({ candidate, isTop, stackPos, sending, onDecide }) {
    const [drag, setDrag] = useState({ x: 0, y: 0, dragging: false });
    const [exiting, setExiting] = useState(null); // 'left' | 'right' | null
    const [photoIdx, setPhotoIdx] = useState(0);
    const startRef = useRef({ x: 0, y: 0, t: 0 });

    // Build a photo array: primary first, then gallery extras
    const allPhotos = useMemo(() => {
        const arr = [];
        if (candidate.photo_url) arr.push(candidate.photo_url);
        for (const p of candidate.photos || []) arr.push(p);
        return arr;
    }, [candidate]);
    const totalPhotos = allPhotos.length;
    const currentPhoto = totalPhotos > 0 ? allPhotos[photoIdx] : null;

    const reset = () => setDrag({ x: 0, y: 0, dragging: false });

    const commit = (direction) => {
        setExiting(direction);
        // Wait for fly-off animation, then bubble up
        setTimeout(() => {
            onDecide(direction === 'right' ? 'hi' : 'pass');
        }, 220);
    };

    const onPointerDown = (e) => {
        if (!isTop || exiting || sending) return;
        // Don't start drag on links/buttons or photo-tap zones
        if (e.target.closest('a, button, [data-photo-tap]')) return;
        startRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
        setDrag({ x: 0, y: 0, dragging: true });
        e.currentTarget.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e) => {
        if (!drag.dragging) return;
        const x = e.clientX - startRef.current.x;
        const y = e.clientY - startRef.current.y;
        setDrag({ x, y, dragging: true });
    };
    const onPointerUp = () => {
        if (!drag.dragging) return;
        const { x } = drag;
        if (x > SWIPE_THRESHOLD) commit('right');
        else if (x < -SWIPE_THRESHOLD) commit('left');
        else reset();
    };

    // Compute transform
    let transform = '';
    let transition = drag.dragging
        ? 'none'
        : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease';
    if (exiting) {
        const off = exiting === 'right' ? window.innerWidth + 200 : -(window.innerWidth + 200);
        transform = `translate3d(${off}px, ${drag.y}px, 0) rotate(${exiting === 'right' ? 22 : -22}deg)`;
    } else if (drag.dragging || drag.x !== 0) {
        const rot = drag.x * 0.06;
        transform = `translate3d(${drag.x}px, ${drag.y}px, 0) rotate(${rot}deg)`;
    } else {
        // Stack offset for non-top cards
        const yOffset = stackPos * 8;
        const scale = 1 - stackPos * 0.04;
        transform = `translate3d(0, ${yOffset}px, 0) scale(${scale})`;
        transition = 'transform 250ms ease';
    }

    const yesOpacity = Math.max(0, Math.min(1, drag.x / 90));
    const noOpacity = Math.max(0, Math.min(1, -drag.x / 90));

    const showPrev = (e) => {
        e.stopPropagation();
        setPhotoIdx((i) => (i - 1 + totalPhotos) % totalPhotos);
    };
    const showNext = (e) => {
        e.stopPropagation();
        setPhotoIdx((i) => (i + 1) % totalPhotos);
    };

    return (
        <div
            className="absolute inset-0 select-none"
            style={{
                transform,
                transition,
                zIndex: isTop ? 10 : 10 - stackPos,
                opacity: exiting ? 0 : 1 - stackPos * 0.06,
                touchAction: 'none',
                cursor: isTop ? (drag.dragging ? 'grabbing' : 'grab') : 'default',
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            data-testid={isTop ? `swipe-card-top-${candidate.user_id}` : undefined}
        >
            <div className="relative w-full h-full rounded-3xl overflow-hidden bg-slate-900 border border-white/10 shadow-2xl">
                {/* Photo or gradient fallback */}
                {currentPhoto ? (
                    <img
                        src={currentPhoto}
                        alt={candidate.name}
                        draggable={false}
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-500/20 to-rose-500/30">
                        <Avatar className="w-32 h-32 ring-4 ring-amber-500/30">
                            <AvatarFallback className="bg-amber-500/20 text-amber-200 text-4xl font-bold">
                                {getInitials(candidate.name)}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                )}

                {/* Photo dots indicator (top, like Tinder/Hinge) */}
                {totalPhotos > 1 ? (
                    <div
                        className="absolute top-3 left-3 right-3 flex gap-1 z-20 pointer-events-none"
                        data-testid={`swipe-photo-dots-${candidate.user_id}`}
                    >
                        {allPhotos.map((photo, i) => (
                            <div
                                key={`${candidate.user_id}-dot-${i}`}
                                className={`flex-1 h-1 rounded-full transition-colors ${
                                    i === photoIdx ? 'bg-white' : 'bg-white/30'
                                }`}
                            />
                        ))}
                    </div>
                ) : null}

                {/* Tap zones for cycling photos (Tinder-style) — left half = prev, right half = next */}
                {isTop && totalPhotos > 1 ? (
                    <>
                        <button
                            type="button"
                            data-photo-tap
                            onClick={showPrev}
                            aria-label="Previous photo"
                            className="absolute top-0 left-0 w-1/3 h-3/4 z-10 cursor-pointer focus:outline-none"
                            style={{ background: 'transparent' }}
                            data-testid={`swipe-photo-prev-${candidate.user_id}`}
                        />
                        <button
                            type="button"
                            data-photo-tap
                            onClick={showNext}
                            aria-label="Next photo"
                            className="absolute top-0 right-0 w-1/3 h-3/4 z-10 cursor-pointer focus:outline-none"
                            style={{ background: 'transparent' }}
                            data-testid={`swipe-photo-next-${candidate.user_id}`}
                        />
                    </>
                ) : null}

                {/* Bottom gradient + info */}
                <div className="absolute inset-x-0 bottom-0 p-5 pb-6 bg-gradient-to-t from-black/95 via-black/70 to-transparent z-20">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-3xl font-bold text-white">{candidate.name}</h3>
                        {candidate.is_premium ? (
                            <Crown className="w-5 h-5 text-amber-400" />
                        ) : null}
                    </div>
                    {candidate.city ? (
                        <p className="text-sm text-white/80 flex items-center gap-1 mb-3">
                            <MapPin className="w-3.5 h-3.5" /> {candidate.city}
                        </p>
                    ) : null}
                    {candidate.bio ? (
                        <p className="text-sm text-white/85 line-clamp-2 mb-3">
                            {candidate.bio}
                        </p>
                    ) : null}
                    <div className="flex flex-wrap gap-1.5">
                        {(candidate.reasons || []).slice(0, 3).map((reason) => {
                            const Icon = reasonIcon(reason);
                            return (
                                <Badge
                                    key={reason}
                                    variant="outline"
                                    className="bg-amber-500/20 backdrop-blur-sm border-amber-400/50 text-amber-50 text-[11px] gap-1"
                                >
                                    <Icon className="w-3 h-3" /> {reason}
                                </Badge>
                            );
                        })}
                    </div>
                </div>

                {/* View profile pill — top right, always above tap zones */}
                <Link
                    to={`/user/${candidate.user_id}`}
                    className="absolute top-7 right-3 z-30 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white text-xs font-medium hover:bg-black/80 transition"
                    data-testid={`swipe-view-${candidate.user_id}`}
                >
                    <Eye className="w-3 h-3 inline mr-1" /> View
                </Link>

                {/* Swipe overlays */}
                <div
                    className="absolute top-12 left-6 px-4 py-1.5 rounded-md border-4 border-emerald-400 text-emerald-300 font-bold text-2xl tracking-widest -rotate-12 pointer-events-none z-30"
                    style={{ opacity: yesOpacity }}
                >
                    HI 👋
                </div>
                <div
                    className="absolute top-12 right-6 px-4 py-1.5 rounded-md border-4 border-rose-400 text-rose-300 font-bold text-2xl tracking-widest rotate-12 pointer-events-none z-30"
                    style={{ opacity: noOpacity }}
                >
                    PASS
                </div>
            </div>
        </div>
    );
}

function ActionBar({ canUndo, onUndo, onPass, onHi, sending, candidate }) {
    const disabled = !candidate || sending;
    return (
        <div className="flex items-center justify-center gap-5" data-testid="discover-actions">
            <Button
                onClick={onUndo}
                disabled={!canUndo}
                size="icon"
                variant="outline"
                className="w-12 h-12 rounded-full border-white/20 bg-white/[0.03] text-amber-300 hover:bg-amber-500/10 disabled:opacity-30"
                data-testid="action-undo"
                aria-label="Undo last decision"
            >
                <Undo2 className="w-5 h-5" />
            </Button>
            <Button
                onClick={onPass}
                disabled={disabled}
                size="icon"
                className="w-16 h-16 rounded-full bg-white/[0.05] hover:bg-rose-500/20 border border-rose-500/40 text-rose-400 disabled:opacity-50"
                data-testid="action-pass"
                aria-label="Pass"
            >
                <XIcon className="w-7 h-7" />
            </Button>
            <Button
                onClick={onHi}
                disabled={disabled}
                size="icon"
                className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 hover:opacity-90 text-white disabled:opacity-50 shadow-lg shadow-emerald-500/30"
                data-testid="action-hi"
                aria-label="Say Hi"
            >
                {sending ? (
                    <Loader2 className="w-7 h-7 animate-spin" />
                ) : (
                    <Heart className="w-7 h-7" fill="currentColor" />
                )}
            </Button>
        </div>
    );
}

function EmptyState({ onReload }) {
    return (
        <div
            className="flex-1 flex flex-col items-center justify-center text-center"
            data-testid="discover-empty"
        >
            <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4">
                <Sparkles className="w-9 h-9 text-amber-400" />
            </div>
            <h2 className="text-2xl text-white font-medium mb-2">All caught up!</h2>
            <p className="text-sm text-white/50 max-w-sm mx-auto mb-6">
                You've seen everyone we surfaced. Add more locations or RSVP to a Gathering and we'll find fresh people you haven't met yet.
            </p>
            <div className="flex gap-3">
                <Link to="/locations">
                    <Button variant="outline" data-testid="discover-cta-locations">
                        Add a place
                    </Button>
                </Link>
                <Link to="/gatherings">
                    <Button
                        className="bg-gradient-to-r from-amber-500 to-orange-600"
                        data-testid="discover-cta-gatherings"
                    >
                        Browse Gatherings
                    </Button>
                </Link>
            </div>
            <button
                onClick={onReload}
                className="mt-6 text-xs text-white/40 hover:text-white/70 underline"
                data-testid="discover-reload"
            >
                Reload suggestions
            </button>
        </div>
    );
}
