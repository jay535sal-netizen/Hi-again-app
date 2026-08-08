import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mic, MicOff, Loader2, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

// Browser SpeechRecognition (webkit prefix on Chrome/Android WebView)
const SpeechRecognition =
    (typeof window !== 'undefined' &&
        (window.SpeechRecognition || window.webkitSpeechRecognition)) ||
    null;

const speak = (text) => {
    if (!('speechSynthesis' in window) || !text) return;
    try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 1.02;
        utter.pitch = 1.0;
        utter.volume = 1.0;
        // Prefer a friendly English voice if available
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(
            (v) => /en[-_](US|GB)/i.test(v.lang) && /female|samantha|karen|zira|google/i.test(v.name)
        ) || voices.find((v) => /^en/i.test(v.lang));
        if (preferred) utter.voice = preferred;
        window.speechSynthesis.speak(utter);
    } catch (e) {
        // non-critical — audio may be blocked by browser autoplay policy
        console.debug('speak failed', e);
    }
};

/**
 * Floating microphone FAB for hands-free navigation and queries.
 * States: idle → listening → thinking → speaking → idle
 * Tap to start; tap again to stop early. Auto-stops after ~6s of silence.
 */
export default function VoiceAssistant() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();

    const [state, setState] = useState('idle'); // idle | listening | thinking | speaking
    const [lastTranscript, setLastTranscript] = useState('');
    const [lastReply, setLastReply] = useState('');
    const [showHelp, setShowHelp] = useState(false);
    const [showPermPrimer, setShowPermPrimer] = useState(false);
    const recognitionRef = useRef(null);
    const greetedRef = useRef(false);
    const stateRef = useRef('idle');
    stateRef.current = state;

    const unsupported = !SpeechRecognition;

    // Handle intent → side-effect. Called after backend returns.
    const handleIntent = useCallback(
        async (result) => {
            if (!result) return;

            // Speak the reply first so audio feedback feels instant
            setLastReply(result.reply || '');
            setState('speaking');
            speak(result.reply || '');
            // Rough estimate: give TTS a moment before switching back
            setTimeout(() => setState('idle'), Math.min(4000, 1200 + (result.reply || '').length * 40));

            if (result.intent === 'navigate' && result.target) {
                navigate(result.target);
                return;
            }
            if (result.intent === 'action' && result.target) {
                switch (result.target) {
                    case 'logout':
                        setTimeout(() => logout && logout(), 900);
                        return;
                    case 'refresh_feed':
                        window.dispatchEvent(new CustomEvent('voice:refresh'));
                        return;
                    case 'create_post':
                        navigate('/feed');
                        setTimeout(
                            () => window.dispatchEvent(new CustomEvent('voice:create_post')),
                            400,
                        );
                        return;
                    case 'voice_post': {
                        const caption = result.params?.caption || '';
                        navigate('/feed');
                        setTimeout(
                            () =>
                                window.dispatchEvent(
                                    new CustomEvent('voice:create_post', { detail: { caption } }),
                                ),
                            400,
                        );
                        return;
                    }
                    case 'ghost_on':
                    case 'ghost_off': {
                        const ghost = result.target === 'ghost_on';
                        try {
                            await api.patch('/users/me', { ghost_mode: ghost });
                            toast.success(ghost ? 'Ghost mode on' : 'Ghost mode off');
                        } catch (e) {
                            console.error('ghost toggle failed', e);
                            toast.error("Couldn't update ghost mode");
                        }
                        return;
                    }
                    case 'like_current_post':
                    case 'skip_current':
                    case 'undo_last':
                    case 'share_profile':
                    case 'delete_current':
                    case 'save_current':
                    case 'rsvp_yes':
                    case 'rsvp_no':
                        // Broadcast to whichever page is mounted; each page listens for its own.
                        window.dispatchEvent(new CustomEvent(`voice:${result.target}`, { detail: result.params }));
                        return;
                    default:
                        return;
                }
            }
            if (result.intent === 'query' && result.target) {
                try {
                    const res = await api.get(`/voice/query/${result.target}`);
                    const data = res.data || {};
                    if (data.summary) {
                        setLastReply(data.summary);
                        speak(data.summary);
                    }
                    // Optional deep-link to the relevant page for context
                    const jumpMap = {
                        recent_crossings: '/crossings',
                        last_crossing: '/crossings',
                        todays_highlights: '/dashboard',
                        new_messages: '/messages',
                        who_viewed_me: '/who-viewed-me',
                        my_reels: '/feed',
                        my_posts_today: '/profile',
                        my_founder_number: '/founder-invite',
                        founder_count: '/founder-invite',
                        recent_likes: '/notifications',
                        new_notifications: '/notifications',
                        upcoming_gatherings: '/gatherings',
                        my_stats: '/dashboard',
                    };
                    const jump = jumpMap[result.target];
                    if (jump && jump !== location.pathname) {
                        setTimeout(() => navigate(jump), 900);
                    }
                } catch (e) {
                    console.warn('voice query fetch failed', e);
                }
                return;
            }
        },
        [navigate, location.pathname, logout]
    );

    const sendTranscript = useCallback(
        async (transcript) => {
            if (!transcript || !transcript.trim()) {
                setState('idle');
                return;
            }
            setState('thinking');
            setLastTranscript(transcript);
            try {
                const res = await api.post('/voice/intent', {
                    transcript,
                    context_page: location.pathname,
                });
                await handleIntent(res.data);
            } catch (e) {
                console.error('voice intent failed', e);
                setLastReply("I couldn't reach the assistant. Try again.");
                speak("I couldn't reach the assistant. Try again.");
                setState('idle');
            }
        },
        [handleIntent, location.pathname]
    );

    const beginRecognition = useCallback(() => {
        if (unsupported) {
            toast.error('Voice input is not supported in this browser');
            return;
        }
        if (stateRef.current !== 'idle') return;

        // Preload voices so first speak() doesn't fail silently
        if ('speechSynthesis' in window) window.speechSynthesis.getVoices();

        const rec = new SpeechRecognition();
        rec.lang = 'en-US';
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        rec.continuous = false;

        rec.onstart = () => setState('listening');
        rec.onresult = (event) => {
            const t = event.results[0]?.[0]?.transcript || '';
            sendTranscript(t);
        };
        rec.onerror = (event) => {
            console.warn('speech recognition error', event.error);
            if (event.error === 'not-allowed' || event.error === 'permission-denied') {
                toast.error('Microphone permission denied — enable it in your device settings');
                localStorage.removeItem('hiagain.voice_primer_accepted');
            } else if (event.error === 'no-speech') {
                setLastReply("I didn't hear anything.");
            }
            setState('idle');
        };
        rec.onend = () => {
            if (stateRef.current === 'listening') setState('idle');
        };

        try {
            rec.start();
            recognitionRef.current = rec;
        } catch (e) {
            console.error('failed to start recognition', e);
            setState('idle');
        }
    }, [sendTranscript, unsupported]);

    const startListening = useCallback(() => {
        if (unsupported) {
            toast.error('Voice input is not supported in this browser');
            return;
        }
        // First-time users see a friendly primer explaining WHY we need the mic
        // before the raw browser/OS permission dialog fires.
        const seen = localStorage.getItem('hiagain.voice_primer_accepted');
        if (!seen) {
            setShowPermPrimer(true);
            return;
        }
        beginRecognition();
    }, [beginRecognition, unsupported]);

    const acceptPermPrimer = () => {
        localStorage.setItem('hiagain.voice_primer_accepted', '1');
        setShowPermPrimer(false);
        // Give the modal a beat to unmount before requesting mic
        setTimeout(() => beginRecognition(), 250);
    };

    const stopListening = useCallback(() => {
        try {
            recognitionRef.current?.stop();
        } catch (_) {
            // ignore — recognition may already be closed
        }
    }, []);

    const onTap = () => {
        if (state === 'listening') {
            stopListening();
        } else if (state === 'idle') {
            startListening();
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            try {
                recognitionRef.current?.abort();
                window.speechSynthesis?.cancel();
            } catch (_) {
                // no-op
            }
        };
    }, []);

    // Morning greeting — speaks a one-line summary of overnight activity
    // the first time the user opens the app on a new calendar day.
    // Only triggers if the user has already accepted the permission primer
    // AND is on a real authed page (not landing/auth screens).
    useEffect(() => {
        if (!user || greetedRef.current) return;
        const primerAccepted = localStorage.getItem('hiagain.voice_primer_accepted');
        if (!primerAccepted) return;
        const today = new Date().toISOString().slice(0, 10);
        const lastGreeting = localStorage.getItem('hiagain.last_greeting_date');
        if (lastGreeting === today) return;
        // Only greet between 5am and 11am local — avoid startling users mid-day
        const hour = new Date().getHours();
        if (hour < 5 || hour > 11) return;

        greetedRef.current = true;
        localStorage.setItem('hiagain.last_greeting_date', today);

        (async () => {
            try {
                const res = await api.get('/voice/query/todays_highlights');
                const first = (user.name || 'there').split(' ')[0];
                const summary = res.data?.summary || '';
                // Only speak if there's something worth saying
                const anything = ['crossing', 'message', 'view'].some((k) =>
                    summary.toLowerCase().includes(k)
                );
                const line = anything
                    ? `Morning, ${first}. ${summary}`
                    : `Morning, ${first}. Quiet night — good day to start something new.`;
                setLastReply(line);
                setState('speaking');
                speak(line);
                setTimeout(() => setState('idle'), Math.min(5000, 1500 + line.length * 40));
            } catch (err) {
                // Non-critical — silently skip
                console.debug('morning greeting failed', err?.response?.status);
            }
        })();
    }, [user]);

    // Hide entirely on the login/register/landing routes and if user not logged in
    const hiddenRoutes = ['/', '/login', '/register', '/verify-email', '/reset-password'];
    if (!user || hiddenRoutes.includes(location.pathname)) return null;

    const stateColor =
        state === 'listening'
            ? 'from-rose-500 to-orange-500 animate-pulse'
            : state === 'thinking'
              ? 'from-amber-400 to-orange-500'
              : state === 'speaking'
                ? 'from-emerald-500 to-teal-500'
                : 'from-rose-500 to-amber-500';

    return (
        <>
            <div
                className="fixed z-50 bottom-24 right-4 flex flex-col items-end gap-2"
                data-testid="voice-assistant"
            >
                {(lastTranscript || lastReply) && state !== 'idle' && (
                    <div
                        className="max-w-[240px] rounded-2xl bg-black/85 backdrop-blur-md border border-white/10 p-3 text-xs text-white shadow-lg"
                        data-testid="voice-bubble"
                    >
                        {lastTranscript && (
                            <p className="text-white/50 italic mb-1">"{lastTranscript}"</p>
                        )}
                        {lastReply && <p>{lastReply}</p>}
                    </div>
                )}

                <button
                    onClick={onTap}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        setShowHelp(true);
                    }}
                    disabled={state === 'thinking' || state === 'speaking' || unsupported}
                    className={`w-14 h-14 rounded-full bg-gradient-to-br ${stateColor} shadow-xl flex items-center justify-center text-white transition-transform active:scale-95 disabled:opacity-70`}
                    aria-label="Voice assistant"
                    data-testid="voice-fab"
                >
                    {state === 'thinking' ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : state === 'speaking' ? (
                        <Volume2 className="w-6 h-6" />
                    ) : state === 'listening' ? (
                        <Mic className="w-6 h-6" />
                    ) : unsupported ? (
                        <MicOff className="w-6 h-6" />
                    ) : (
                        <Mic className="w-6 h-6" />
                    )}
                </button>
            </div>

            {showPermPrimer && (
                <div
                    className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
                    data-testid="voice-permission-primer"
                >
                    <div className="max-w-md w-full bg-slate-900 border border-white/10 rounded-2xl p-5">
                        <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center mb-4">
                            <Mic className="w-7 h-7 text-white" />
                        </div>
                        <h3 className="text-lg text-white font-medium text-center mb-2">
                            Hey — mind if I listen?
                        </h3>
                        <p className="text-sm text-white/70 text-center mb-5">
                            Hi Again's voice assistant lets you navigate hands-free. Your device will ask for microphone
                            permission next. We only send what you say to the assistant — nothing is recorded or stored.
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowPermPrimer(false)}
                                className="flex-1 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm"
                                data-testid="voice-primer-cancel"
                            >
                                Not now
                            </button>
                            <button
                                onClick={acceptPermPrimer}
                                className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-rose-500 to-amber-500 text-white text-sm font-medium"
                                data-testid="voice-primer-accept"
                            >
                                Enable mic
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showHelp && (
                <div
                    className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
                    onClick={() => setShowHelp(false)}
                    data-testid="voice-help-modal"
                >
                    <div
                        className="max-w-md w-full bg-slate-900 border border-white/10 rounded-2xl p-5 max-h-[80vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg text-white font-medium mb-2">Try saying…</h3>
                        <p className="text-xs text-white/50 mb-4">
                            Tap the mic and speak. Long-press the mic anytime to see this list.
                        </p>
                        <div className="grid grid-cols-1 gap-2 text-sm text-white/80">
                            {[
                                'Take me to my profile',
                                "What are today's highlights",
                                'Show me my missed crossings',
                                'Any new messages',
                                'Show me reels',
                                'Show my posts from today',
                                'Who viewed me today',
                                'What is my founder number',
                                'Turn on ghost mode',
                                'Refresh the feed',
                                'Open discover',
                                'Show upcoming gatherings',
                                'Log me out',
                                'Create a new post',
                                'Show recent likes',
                                'How many crossings do I have',
                            ].map((phrase) => (
                                <div
                                    key={phrase}
                                    className="px-3 py-2 rounded-lg bg-white/5 border border-white/5"
                                >
                                    "{phrase}"
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => setShowHelp(false)}
                            className="mt-4 w-full py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
