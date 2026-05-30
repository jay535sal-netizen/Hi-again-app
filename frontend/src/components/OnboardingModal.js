import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import {
    Sparkles, MapPin, Users, Gift, Check, ArrowRight, X
} from 'lucide-react';
import { authApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const STEPS = [
    {
        icon: Sparkles,
        title: 'Welcome to Hi Again',
        body: 'Find people you\'ve crossed paths with — at events, cafes, or anywhere life takes you. Let\'s get you set up in 30 seconds.',
        accent: 'rose',
        cta: 'Get started',
    },
    {
        icon: MapPin,
        title: 'Add your first place',
        body: 'Log a city, event, or venue you visited. The more you add, the more crossings we can find for you.',
        accent: 'amber',
        cta: 'Continue',
    },
    {
        icon: Users,
        title: 'Discover your crossings',
        body: 'We\'ll match you with people who shared the same places or moments. Tap into your Crossings tab to see them.',
        accent: 'purple',
        cta: 'Continue',
    },
    {
        icon: Gift,
        title: 'Invite a friend, earn rewards',
        body: 'Share your referral code — when friends join, you both unlock perks. Visit Referrals when you\'re ready.',
        accent: 'emerald',
        cta: 'Finish',
    },
];

export default function OnboardingModal({ onDone }) {
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const { updateUser, user } = useAuth();
    const navigate = useNavigate();

    const finish = async (skipNav = false) => {
        if (saving) return;
        setSaving(true);
        try {
            await authApi.completeOnboarding();
            updateUser({ ...user, onboarded: true });
        } catch (err) {
            console.warn('completeOnboarding failed:', err?.message || err);
        } finally {
            setSaving(false);
            if (onDone) onDone();
            if (!skipNav) navigate('/locations');
        }
    };

    const next = () => {
        if (step < STEPS.length - 1) setStep(step + 1);
        else finish();
    };

    const skip = () => finish(true);

    const current = STEPS[step];
    const Icon = current.icon;
    const accent = current.accent;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            data-testid="onboarding-modal"
        >
            <div className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
                {/* Skip button */}
                <button
                    onClick={skip}
                    aria-label="Skip onboarding"
                    data-testid="onboarding-skip"
                    className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Progress bar */}
                <div className="flex gap-1.5 px-6 pt-6">
                    {STEPS.map((s, i) => (
                        <div
                            key={s.title}
                            className={`flex-1 h-1 rounded-full transition-all ${
                                i <= step ? 'bg-rose-500' : 'bg-slate-700'
                            }`}
                        />
                    ))}
                </div>

                {/* Body */}
                <div className="px-8 py-10 text-center">
                    <div
                        className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-6 bg-${accent}-500/15 text-${accent}-400`}
                    >
                        <Icon className="w-8 h-8" />
                    </div>
                    <h2 className="font-heading text-2xl text-white mb-3">{current.title}</h2>
                    <p className="text-slate-400 leading-relaxed mb-8">{current.body}</p>

                    <Button
                        onClick={next}
                        disabled={saving}
                        className="w-full btn-primary"
                        data-testid={`onboarding-cta-${step}`}
                    >
                        {step === STEPS.length - 1 ? (
                            <>
                                <Check className="w-4 h-4 mr-2" />
                                {current.cta}
                            </>
                        ) : (
                            <>
                                {current.cta}
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </>
                        )}
                    </Button>

                    {step === 0 && (
                        <button
                            onClick={skip}
                            className="block mt-4 text-sm text-slate-500 hover:text-slate-300 mx-auto"
                            data-testid="onboarding-skip-link"
                        >
                            Skip for now
                        </button>
                    )}
                </div>

                {/* Quick links footer (final step only) */}
                {step === STEPS.length - 1 && (
                    <div className="px-8 pb-6 grid grid-cols-3 gap-2 text-xs">
                        <Link
                            to="/locations"
                            onClick={() => finish(true)}
                            className="text-center p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                        >
                            <MapPin className="w-4 h-4 mx-auto mb-1 text-rose-400" />
                            Add place
                        </Link>
                        <Link
                            to="/crossings"
                            onClick={() => finish(true)}
                            className="text-center p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                        >
                            <Users className="w-4 h-4 mx-auto mb-1 text-purple-400" />
                            Crossings
                        </Link>
                        <Link
                            to="/referrals"
                            onClick={() => finish(true)}
                            className="text-center p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                        >
                            <Gift className="w-4 h-4 mx-auto mb-1 text-emerald-400" />
                            Invite
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
