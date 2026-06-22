import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { foundersApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import FoundingMemberBadge from '../components/FoundingMemberBadge';
import { Crown, Sparkles, Lock, Check, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';

export default function FounderInvite() {
    const { code } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [invite, setInvite] = useState(null);
    const [stats, setStats] = useState(null);
    const [redeeming, setRedeeming] = useState(false);

    const load = useCallback(async () => {
        try {
            const [inviteRes, statsRes] = await Promise.all([
                foundersApi.lookup(code),
                foundersApi.stats(),
            ]);
            setInvite(inviteRes.data);
            setStats(statsRes.data);
        } catch (e) {
            console.error('Founder invite load failed', e);
        } finally {
            setLoading(false);
        }
    }, [code]);

    useEffect(() => { load(); }, [load]);

    const handleClaim = async () => {
        if (!user) {
            // Send them through signup, then they redeem.
            localStorage.setItem('pending_founder_code', code);
            navigate(`/register?founder=${encodeURIComponent(code)}`);
            return;
        }
        setRedeeming(true);
        try {
            const res = await foundersApi.redeem(code);
            toast.success(`Welcome, Founder #${res.data.founder_number}!`);
            navigate('/dashboard');
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Could not redeem');
        } finally {
            setRedeeming(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-midnight flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            </div>
        );
    }

    const taken = stats?.taken ?? 0;
    const total = stats?.total ?? 60;
    const remaining = stats?.remaining ?? Math.max(0, total - taken);
    const fillPct = Math.min(100, Math.round((taken / total) * 100));

    return (
        <div className="min-h-screen bg-midnight" data-testid="founder-invite-page">
            {/* Hero */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-rose-500/10 to-transparent" />
                <div className="absolute -top-20 -right-20 w-80 h-80 bg-amber-500/20 rounded-full blur-3xl" />
                <div className="relative max-w-3xl mx-auto px-6 pt-20 pb-12 text-center">
                    <div className="inline-flex items-center gap-2 mb-6">
                        <FoundingMemberBadge size="lg" showLabel={true} />
                    </div>
                    <h1 className="font-heading text-4xl md:text-6xl text-white mb-4 leading-tight">
                        You're invited to be
                        <br />
                        <span className="bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
                            one of the first 60.
                        </span>
                    </h1>
                    <p className="text-lg text-slate-300 max-w-xl mx-auto">
                        {invite?.invited_by ? (
                            <><strong className="text-white">{invite.invited_by}</strong> sent you this. </>
                        ) : null}
                        Hi Again is a new way to reconnect with the people you actually
                        crossed paths with — not random swipes, real moments.
                    </p>
                </div>
            </div>

            {/* Main card */}
            <div className="max-w-2xl mx-auto px-6 pb-20">
                <div className="bg-slate-900/60 backdrop-blur rounded-2xl border border-slate-800 p-8 md:p-10 shadow-xl">
                    {/* Status banner */}
                    {!invite?.valid && (
                        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200" data-testid="invite-invalid">
                            <strong>This invite code isn't valid.</strong>{' '}
                            Double-check the link or ask your inviter for a new one.
                        </div>
                    )}
                    {invite?.valid && invite?.redeemed && (
                        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-100" data-testid="invite-redeemed">
                            <Lock className="inline w-4 h-4 mr-1 -mt-0.5" />
                            <strong>This code has already been claimed.</strong>{' '}
                            But you can still sign up — there are <strong>{remaining}</strong> founder spots left.
                            <div className="mt-3">
                                <Link to="/register">
                                    <Button data-testid="invite-redeemed-signup-btn" className="bg-amber-500 text-amber-950 hover:bg-amber-400">
                                        Sign up anyway →
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* Pitch */}
                    <h2 className="font-heading text-2xl text-white mb-4">
                        What you get as a Founder
                    </h2>
                    <ul className="space-y-3 mb-8">
                        {[
                            ['Permanent gold "Founding Member" badge on your profile, posts, and crossings'],
                            ['12 months of Premium — free. Unlimited locations, advanced filters, priority match scoring.'],
                            ['Direct line to the founder. Your feedback shapes the next features we ship.'],
                            ['First access to every new feature, two weeks before public.'],
                            ['Lifetime status. Once a founder, always a founder.'],
                        ].map(([text]) => (
                            <li key={text} className="flex items-start gap-3 text-slate-200">
                                <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-amber-500/20 ring-1 ring-amber-400/40 flex items-center justify-center">
                                    <Check className="w-3 h-3 text-amber-300" strokeWidth={3} />
                                </span>
                                <span>{text}</span>
                            </li>
                        ))}
                    </ul>

                    {/* Founders counter */}
                    <div className="mb-8 p-5 rounded-xl bg-slate-950/60 border border-slate-800">
                        <div className="flex items-baseline justify-between mb-2">
                            <div className="text-slate-400 text-sm">Founders claimed</div>
                            <div className="font-heading text-2xl text-white" data-testid="founders-counter">
                                {taken}<span className="text-slate-500 text-base"> / {total}</span>
                            </div>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-500"
                                style={{ width: `${fillPct}%` }}
                                data-testid="founders-progress"
                            />
                        </div>
                        {stats?.top_cities?.length > 0 && (
                            <div className="mt-3 text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                                <MapPin className="w-3 h-3" />
                                {stats.top_cities.map((c) => `${c.city} (${c.count})`).join(' · ')}
                            </div>
                        )}
                    </div>

                    {/* CTA */}
                    {invite?.valid && !invite?.redeemed && (
                        <Button
                            onClick={handleClaim}
                            disabled={redeeming || remaining === 0}
                            className="w-full h-14 text-base font-semibold bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-amber-950 shadow-lg shadow-amber-500/30"
                            data-testid="claim-founder-btn"
                        >
                            {redeeming ? (
                                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Reserving your spot…</>
                            ) : (
                                <><Crown className="w-5 h-5 mr-2" /> Claim my founder spot</>
                            )}
                        </Button>
                    )}

                    <p className="mt-4 text-center text-xs text-slate-500">
                        <Sparkles className="inline w-3 h-3 mr-1 -mt-0.5" />
                        {user
                            ? `You'll claim as ${user.name}.`
                            : "You'll create a free account first — takes 30 seconds."}
                    </p>
                </div>

                <div className="mt-6 text-center text-sm text-slate-500">
                    Already a member?{' '}
                    <Link to="/login" className="text-amber-400 hover:text-amber-300 underline">
                        Sign in
                    </Link>
                </div>
            </div>
        </div>
    );
}
