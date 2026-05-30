import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
    Crown, Check, Sparkles, MapPin, MessageCircle, Eye, 
    Shield, Zap, Star, Loader2, ArrowRight, X, Heart,
    Users, Unlock, BadgeCheck, Infinity as InfinityIcon, Gift, Ticket
} from 'lucide-react';
import { toast } from 'sonner';
import api, { subscriptionApi } from '../lib/api';

// Premium perks data
const PREMIUM_PERKS = [
    {
        icon: Unlock,
        title: "See Full Contact Info",
        description: "View email addresses and connect directly with people you've crossed paths with",
        freeLimit: "Blurred contacts",
        premiumValue: "Full access",
        color: "rose"
    },
    {
        icon: InfinityIcon,
        title: "Unlimited Locations",
        description: "Track as many locations as you want - concerts, cafes, events, everywhere",
        freeLimit: "10 locations",
        premiumValue: "Unlimited",
        color: "purple"
    },
    {
        icon: Eye,
        title: "See Who Viewed You",
        description: "Know who's checking out your profile and interested in connecting",
        freeLimit: "Hidden",
        premiumValue: "Full visibility",
        color: "amber"
    },
    {
        icon: BadgeCheck,
        title: "Verified Badge",
        description: "Stand out with a premium badge that shows you're serious about connections",
        freeLimit: "No badge",
        premiumValue: "Verified ✓",
        color: "emerald"
    },
    {
        icon: MessageCircle,
        title: "Unlimited Messages",
        description: "Send as many messages as you want without restrictions",
        freeLimit: "5 per day",
        premiumValue: "Unlimited",
        color: "blue"
    },
    {
        icon: Zap,
        title: "Priority Matching",
        description: "Your profile appears first in search results and crossing notifications",
        freeLimit: "Standard",
        premiumValue: "Priority boost",
        color: "orange"
    }
];

// Currency formatting helpers (USD + INR)
const CURRENCY_META = {
    usd: { symbol: '$', code: 'USD', label: 'USD', locale: 'en-US' },
    inr: { symbol: '₹', code: 'INR', label: 'INR', locale: 'en-IN' },
};

function formatPrice(amount, currency) {
    const meta = CURRENCY_META[currency] || CURRENCY_META.usd;
    try {
        return new Intl.NumberFormat(meta.locale, {
            style: 'currency',
            currency: meta.code,
            maximumFractionDigits: currency === 'inr' ? 0 : 2,
        }).format(amount);
    } catch {
        return `${meta.symbol}${amount}`;
    }
}

function detectDefaultCurrency() {
    try {
        const stored = localStorage.getItem('hiagain.currency');
        if (stored === 'usd' || stored === 'inr') return stored;
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        if (tz.toLowerCase().includes('kolkata') || tz.toLowerCase().includes('calcutta')) return 'inr';
    } catch {
        // localStorage / Intl unavailable — fall back to USD
    }
    return 'usd';
}

export default function Premium() {
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session_id');
    
    const [plans, setPlans] = useState([]);
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [processingPlan, setProcessingPlan] = useState(null);
    const [activating, setActivating] = useState(false);
    const [promoCode, setPromoCode] = useState('');
    const [redeeming, setRedeeming] = useState(false);
    const [currency, setCurrency] = useState(detectDefaultCurrency);

    // Persist currency choice for repeat visits
    useEffect(() => {
        try { localStorage.setItem('hiagain.currency', currency); } catch {
            // localStorage unavailable — non-critical
        }
    }, [currency]);

    const loadData = useCallback(async () => {
        try {
            const [plansRes, statusRes] = await Promise.all([
                api.get('/subscription/plans'),
                user ? api.get('/subscription/status') : Promise.resolve({ data: null })
            ]);
            
            setPlans(plansRes.data.plans);
            setStatus(statusRes.data);
        } catch (error) {
            console.error('Failed to load subscription data:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    const activateSubscription = useCallback(async (sid) => {
        setActivating(true);
        try {
            const res = await api.get(`/subscription/activate/${sid}`);
            const cur = res?.data?.currency || 'usd';
            const amt = res?.data?.amount;
            const priceLabel = amt != null ? ` (${formatPrice(amt, cur)})` : '';
            toast.success(`Welcome to Premium${priceLabel} — enjoy unlimited features!`);
            loadData();
        } catch (error) {
            console.error('Failed to activate subscription:', error);
            toast.error('Failed to activate subscription');
        } finally {
            setActivating(false);
        }
    }, [loadData]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        if (sessionId) {
            activateSubscription(sessionId);
        }
    }, [sessionId, activateSubscription]);

    const handleSubscribe = async (planId) => {
        if (!user) {
            toast.error('Please login first');
            return;
        }

        setProcessingPlan(planId);
        try {
            const response = await api.post('/subscription/checkout', { 
                plan: planId,
                origin_url: window.location.origin,
                currency,
            });
            
            if (response.data.checkout_url || response.data.url) {
                window.location.href = response.data.checkout_url || response.data.url;
            } else {
                toast.error('Checkout session did not return a URL');
            }
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to start checkout');
        } finally {
            setProcessingPlan(null);
        }
    };

    const handleRedeemPromo = async (e) => {
        e?.preventDefault?.();
        if (!user) {
            toast.error('Please log in first to redeem a code');
            return;
        }
        const code = promoCode.trim();
        if (!code) {
            toast.error('Enter a promo code');
            return;
        }
        setRedeeming(true);
        try {
            const res = await subscriptionApi.redeemPromo(code);
            toast.success(res?.data?.message || 'Promo code applied!');
            setPromoCode('');
            await loadData();
        } catch (err) {
            const msg = err?.response?.data?.detail || 'Invalid or expired code';
            toast.error(msg);
        } finally {
            setRedeeming(false);
        }
    };

    const isPremium = status?.tier === 'premium';

    // Lookup price for selected currency. Backend may return plans with
    // `prices: {usd, inr}` (new) or just `price` (legacy fallback).
    const priceFor = (planId) => {
        const plan = plans.find((p) => p.id === planId);
        if (!plan) return null;
        if (plan.prices && plan.prices[currency] != null) return plan.prices[currency];
        return plan.price;
    };

    return (
        <div className="min-h-screen bg-midnight pt-16" data-testid="premium-page">
            {/* Hero Section with Visuals */}
            <section className="relative py-16 overflow-hidden">
                {/* Background Effects */}
                <div className="absolute inset-0 bg-gradient-to-b from-rose-500/10 via-transparent to-transparent" />
                <div className="absolute top-20 left-1/4 w-72 h-72 bg-rose-500/20 rounded-full blur-3xl" />
                <div className="absolute top-40 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
                
                <div className="relative max-w-4xl mx-auto px-6 text-center">
                    {/* Animated Crown */}
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-rose-500 to-amber-500 mb-6 animate-pulse shadow-2xl shadow-rose-500/30">
                        <Crown className="w-12 h-12 text-white" />
                    </div>
                    
                    <h1 className="font-heading text-4xl md:text-6xl font-light text-white mb-4">
                        Unlock <span className="gradient-sunset-text">Premium</span>
                    </h1>
                    <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
                        Get more connections, see who's interested in you, and never miss a chance encounter again.
                    </p>
                    
                    {/* Quick Stats */}
                    <div className="flex flex-wrap justify-center gap-6 mb-8">
                        <div className="flex items-center gap-2 text-slate-300">
                            <Heart className="w-5 h-5 text-rose-400" />
                            <span>3x more connections</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-300">
                            <Eye className="w-5 h-5 text-amber-400" />
                            <span>See who viewed you</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-300">
                            <BadgeCheck className="w-5 h-5 text-emerald-400" />
                            <span>Verified badge</span>
                        </div>
                    </div>

                    {isPremium && (
                        <div
                            className="inline-flex flex-col items-center gap-1 px-6 py-3 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl text-emerald-400 mb-8"
                            data-testid="premium-active-badge"
                        >
                            <div className="inline-flex items-center gap-2">
                                <BadgeCheck className="w-5 h-5" />
                                <span className="font-medium">You're a Premium Member!</span>
                            </div>
                            {status?.subscription?.amount != null && (
                                <span className="text-xs text-emerald-200/80">
                                    Paid {formatPrice(status.subscription.amount, status.subscription.currency || 'usd')}
                                    {status.subscription.plan ? ` • ${status.subscription.plan}` : ''}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Promo code redemption — for friends & beta testers */}
                    {!isPremium && user && (
                        <div className="max-w-md mx-auto mt-4 mb-2" data-testid="promo-redeem-card">
                            <form
                                onSubmit={handleRedeemPromo}
                                className="flex items-center gap-2 p-2 rounded-full bg-slate-900/70 border border-slate-700 backdrop-blur"
                            >
                                <Ticket className="w-5 h-5 text-amber-400 ml-3 flex-shrink-0" />
                                <Input
                                    type="text"
                                    value={promoCode}
                                    onChange={(e) => setPromoCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                                    placeholder="Got a promo code?"
                                    maxLength={32}
                                    autoCapitalize="characters"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    className="flex-1 bg-transparent border-0 focus-visible:ring-0 text-white placeholder:text-slate-500 tracking-wider"
                                    data-testid="promo-code-input"
                                />
                                <Button
                                    type="submit"
                                    disabled={redeeming || !promoCode.trim()}
                                    size="sm"
                                    className="rounded-full bg-gradient-to-r from-amber-500 to-rose-500 text-white px-5 flex-shrink-0"
                                    data-testid="promo-redeem-btn"
                                >
                                    {redeeming ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Redeem'}
                                </Button>
                            </form>
                            <p className="text-xs text-slate-500 mt-2">Friends with a code get {30} days free.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* Perks Grid - Visual Cards */}
            <section className="py-12 px-6">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-2xl md:text-3xl font-heading text-white text-center mb-4">
                        What You Get with Premium
                    </h2>
                    <p className="text-slate-400 text-center mb-12 max-w-xl mx-auto">
                        Upgrade your experience and make meaningful connections faster
                    </p>
                    
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {PREMIUM_PERKS.map((perk) => {
                            const Icon = perk.icon;
                            const colorClasses = {
                                rose: { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/30' },
                                purple: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
                                amber: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
                                emerald: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
                                blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
                                orange: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
                            };
                            const colors = colorClasses[perk.color];
                            
                            return (
                                <div 
                                    key={perk.title}
                                    className={`glass-card p-6 border ${colors.border} hover:scale-105 transition-transform duration-300`}
                                >
                                    <div className={`w-14 h-14 rounded-2xl ${colors.bg} flex items-center justify-center mb-4`}>
                                        <Icon className={`w-7 h-7 ${colors.text}`} />
                                    </div>
                                    
                                    <h3 className="font-heading text-lg text-white mb-2">{perk.title}</h3>
                                    <p className="text-slate-400 text-sm mb-4">{perk.description}</p>
                                    
                                    {/* Free vs Premium comparison */}
                                    <div className="flex items-center gap-4 text-sm">
                                        <div className="flex items-center gap-1 text-slate-500">
                                            <X className="w-4 h-4 text-red-400" />
                                            <span>{perk.freeLimit}</span>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-slate-600" />
                                        <div className="flex items-center gap-1 text-emerald-400">
                                            <Check className="w-4 h-4" />
                                            <span className="font-medium">{perk.premiumValue}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Pricing Cards */}
            <section className="py-16 px-6 bg-gradient-to-b from-transparent to-rose-500/5">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-2xl md:text-3xl font-heading text-white text-center mb-6">
                        Choose Your Plan
                    </h2>

                    {/* Currency toggle */}
                    <div
                        className="flex items-center justify-center mb-10"
                        data-testid="currency-toggle"
                    >
                        <div className="inline-flex p-1 rounded-full bg-slate-900/80 border border-slate-700">
                            {['usd', 'inr'].map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setCurrency(c)}
                                    className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
                                        currency === c
                                            ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                    data-testid={`currency-${c}`}
                                    aria-pressed={currency === c}
                                >
                                    {CURRENCY_META[c].symbol} {CURRENCY_META[c].label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                            {/* Monthly Plan */}
                            <div className="glass-card p-8 border-slate-700 hover:border-rose-500/50 transition-colors">
                                <div className="text-center mb-6">
                                    <h3 className="font-heading text-xl text-white mb-2">Monthly</h3>
                                    <div className="flex items-end justify-center gap-1">
                                        <span className="text-4xl font-bold text-white" data-testid="price-monthly">
                                            {formatPrice(priceFor('monthly') ?? 0, currency)}
                                        </span>
                                        <span className="text-slate-400 mb-1">/month</span>
                                    </div>
                                    <p className="text-slate-400 text-sm mt-2">Cancel anytime</p>
                                </div>
                                
                                <Button
                                    onClick={() => handleSubscribe('monthly')}
                                    disabled={processingPlan === 'monthly' || isPremium}
                                    className="w-full btn-primary"
                                    data-testid="subscribe-monthly"
                                >
                                    {processingPlan === 'monthly' ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : isPremium ? (
                                        'Current Plan'
                                    ) : (
                                        <>
                                            Get Monthly
                                            <ArrowRight className="w-4 h-4 ml-2" />
                                        </>
                                    )}
                                </Button>
                            </div>

                            {/* Annual Plan - Highlighted */}
                            <div className="glass-card p-8 border-rose-500/50 relative overflow-hidden">
                                {/* Popular Badge */}
                                <div className="absolute top-0 right-0 bg-gradient-to-r from-rose-500 to-amber-500 text-white text-xs font-bold px-4 py-1 rounded-bl-lg">
                                    BEST VALUE
                                </div>
                                
                                <div className="text-center mb-6">
                                    <h3 className="font-heading text-xl text-white mb-2">Annual</h3>
                                    <div className="flex items-end justify-center gap-1">
                                        <span className="text-4xl font-bold gradient-sunset-text" data-testid="price-yearly">
                                            {formatPrice(priceFor('yearly') ?? 0, currency)}
                                        </span>
                                        <span className="text-slate-400 mb-1">/year</span>
                                    </div>
                                    <p className="text-emerald-400 text-sm mt-2 font-medium">Save 33% vs monthly</p>
                                </div>
                                
                                <Button
                                    onClick={() => handleSubscribe('yearly')}
                                    disabled={processingPlan === 'yearly' || isPremium}
                                    className="w-full bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white"
                                    data-testid="subscribe-yearly"
                                >
                                    {processingPlan === 'yearly' ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : isPremium ? (
                                        'Current Plan'
                                    ) : (
                                        <>
                                            <Gift className="w-4 h-4 mr-2" />
                                            Get Annual & Save
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}

                    {currency === 'inr' && (
                        <p className="text-xs text-slate-500 text-center mt-6 max-w-md mx-auto">
                            Charged in INR via Stripe. Most international-enabled Visa, Mastercard
                            and RuPay cards work — UPI not yet supported.
                        </p>
                    )}
                </div>
            </section>

            {/* Testimonials / Social Proof */}
            <section className="py-16 px-6">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-2xl font-heading text-white text-center mb-12">
                        What Premium Members Say
                    </h2>
                    
                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            { name: "Sarah M.", text: "Found 3 people I'd crossed paths with at Coachella. Already dating one of them! 💕", avatar: "SM" },
                            { name: "Jake R.", text: "The verified badge made all the difference. People actually respond now.", avatar: "JR" },
                            { name: "Mia L.", text: "Seeing who viewed me helped me know who was actually interested.", avatar: "ML" }
                        ].map((testimonial) => (
                            <div key={testimonial.name} className="glass-card p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center text-white font-medium text-sm">
                                        {testimonial.avatar}
                                    </div>
                                    <div>
                                        <p className="text-white font-medium">{testimonial.name}</p>
                                        <div className="flex text-amber-400">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <Star key={`star-${testimonial.name}-${star}`} className="w-3 h-3 fill-current" />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <p className="text-slate-300 text-sm">{testimonial.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-16 px-6">
                <div className="max-w-2xl mx-auto text-center">
                    <h2 className="font-heading text-3xl text-white mb-4">
                        Ready to make real connections?
                    </h2>
                    <p className="text-slate-400 mb-8">
                        Join thousands of premium members finding meaningful connections every day.
                    </p>
                    <Button
                        onClick={() => handleSubscribe('monthly')}
                        disabled={processingPlan || isPremium}
                        className="btn-primary text-lg px-10 py-6"
                    >
                        {isPremium ? (
                            "You're Already Premium! 🎉"
                        ) : (
                            <>
                                <Crown className="w-5 h-5 mr-2" />
                                Start Premium Now
                            </>
                        )}
                    </Button>
                    <p className="text-slate-500 text-sm mt-4">
                        Secure payment via Stripe • Cancel anytime
                    </p>
                </div>
            </section>
        </div>
    );
}
