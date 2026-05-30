import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ArrowRight, Heart, Sparkles, MapPin, Users, Crown, Shield, Lock, CheckCircle2 } from 'lucide-react';

// User uploaded images - PROMINENT display
const HERO_IMAGE = "https://customer-assets.emergentagent.com/job_crossed-paths-1/artifacts/2q573pcq_1789.png";
const CONCERT_IMAGE = "https://customer-assets.emergentagent.com/job_crossed-paths-1/artifacts/ohctnemm_1786.png";
const BASEBALL_IMAGE = "https://customer-assets.emergentagent.com/job_crossed-paths-1/artifacts/gsklald8_1787.png";
const LOGO_IMAGE = "https://customer-assets.emergentagent.com/job_b7b92905-43c7-452b-8604-2f29be040573/artifacts/ye6z93sn_4173.jpg";

export default function Landing() {
    return (
        <div className="min-h-screen bg-midnight" data-testid="landing-page">
            {/* HERO - Full Screen Visual Impact */}
            <section className="relative min-h-screen flex items-center overflow-hidden">
                {/* Full-screen background image */}
                <div className="absolute inset-0">
                    <img 
                        src={HERO_IMAGE}
                        alt="Two people reconnecting - a magical moment"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-midnight via-midnight/70 to-transparent"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-midnight via-transparent to-midnight/50"></div>
                </div>

                {/* Content - Left side */}
                <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-12 items-center">
                    <div>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 text-sm font-medium mb-6">
                            <Heart className="w-4 h-4 animate-pulse" />
                            For moments that deserve a second chance
                        </div>

                        {/* Updated headline from Genspark */}
                        <h1 className="font-heading text-5xl md:text-7xl font-light leading-[1.1] text-white mb-6">
                            Reconnect after
                            <span className="block gradient-sunset-text font-normal">the moment passes.</span>
                        </h1>

                        {/* Updated subheadline from Genspark */}
                        <p className="text-xl text-slate-300 mb-8 max-w-lg leading-relaxed">
                            Hi Again helps people turn real-world encounters into real connections — from concerts and games to nights out and chance meetings.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <Link to="/register">
                                <Button 
                                    className="btn-primary text-lg px-8 py-6"
                                    data-testid="hero-cta-register"
                                >
                                    Get Early Access
                                    <ArrowRight className="w-5 h-5 ml-2" />
                                </Button>
                            </Link>
                            <Link to="/premium">
                                <Button 
                                    variant="outline" 
                                    className="border-white/20 text-white hover:bg-white/10 text-lg px-8 py-6"
                                >
                                    <Crown className="w-5 h-5 mr-2" />
                                    Go Premium
                                </Button>
                            </Link>
                        </div>

                        {/* Social proof */}
                        <div className="mt-12 flex items-center gap-6">
                            <div className="flex -space-x-3">
                                <div className="w-10 h-10 rounded-full bg-rose-500 border-2 border-midnight flex items-center justify-center text-white text-xs font-bold">JK</div>
                                <div className="w-10 h-10 rounded-full bg-orange-500 border-2 border-midnight flex items-center justify-center text-white text-xs font-bold">SM</div>
                                <div className="w-10 h-10 rounded-full bg-amber-500 border-2 border-midnight flex items-center justify-center text-white text-xs font-bold">AL</div>
                                <div className="w-10 h-10 rounded-full bg-rose-400 border-2 border-midnight flex items-center justify-center text-white text-xs font-bold">+</div>
                            </div>
                            <p className="text-slate-400 text-sm">
                                <span className="text-white font-medium">Join thousands</span> making connections
                            </p>
                        </div>
                    </div>

                    {/* Hero video — phone-shaped frame, portrait orientation */}
                    <div className="hidden lg:flex justify-center" data-testid="hero-video-wrap">
                        <div className="relative">
                            {/* Glow */}
                            <div className="absolute -inset-8 bg-gradient-to-tr from-rose-500/30 via-amber-500/20 to-purple-500/30 blur-3xl rounded-[3rem] animate-pulse"></div>

                            {/* Phone frame */}
                            <div className="relative w-[290px] h-[600px] rounded-[2.75rem] bg-slate-900 border-[10px] border-slate-800 shadow-2xl overflow-hidden">
                                {/* Notch */}
                                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 bg-slate-900 rounded-b-2xl z-20"></div>

                                <video
                                    src="/media/hero-loop.mp4"
                                    poster="/media/hero-poster.jpg"
                                    className="absolute inset-0 w-full h-full object-cover"
                                    autoPlay
                                    muted
                                    loop
                                    playsInline
                                    preload="metadata"
                                    data-testid="hero-video"
                                />

                                {/* Subtle bottom gradient for legibility */}
                                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent pointer-events-none z-10"></div>
                            </div>

                            {/* Caption ribbon */}
                            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-rose-500/95 backdrop-blur text-xs font-semibold text-white shadow-lg whitespace-nowrap">
                                Real moments, reconnected
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mobile-only video (below text) */}
                <div className="lg:hidden relative z-10 max-w-md mx-auto px-6 pb-16 -mt-8">
                    <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900">
                        <video
                            src="/media/hero-loop.mp4"
                            poster="/media/hero-poster.jpg"
                            className="w-full h-auto"
                            autoPlay
                            muted
                            loop
                            playsInline
                            preload="metadata"
                            data-testid="hero-video-mobile"
                        />
                        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent pointer-events-none"></div>
                    </div>
                </div>
            </section>

            {/* Why Hi Again - Value Props from Genspark */}
            <section className="py-20 px-6 bg-midnight-paper">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="font-heading text-3xl md:text-5xl font-light text-white mb-4">
                            Why <span className="gradient-sunset-text">Hi Again</span>
                        </h2>
                        <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                            The best connections often start offline. We help you turn those moments into something more.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="glass-card p-8 text-center group hover:border-rose-500/30 transition-all">
                            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                                <Sparkles className="w-8 h-8 text-rose-400" />
                            </div>
                            <h3 className="font-heading text-xl text-white mb-3">Built for real-life connection</h3>
                            <p className="text-slate-400">Start from shared context, not cold intros. Real moments create better reasons to reconnect.</p>
                        </div>

                        <div className="glass-card p-8 text-center group hover:border-orange-500/30 transition-all">
                            <div className="w-16 h-16 rounded-2xl bg-orange-500/20 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                                <Heart className="w-8 h-8 text-orange-400" />
                            </div>
                            <h3 className="font-heading text-xl text-white mb-3">Better than endless swiping</h3>
                            <p className="text-slate-400">Real-world moments create genuine chemistry. No algorithms deciding your fate.</p>
                        </div>

                        <div className="glass-card p-8 text-center group hover:border-amber-500/30 transition-all">
                            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                                <Users className="w-8 h-8 text-amber-300" />
                            </div>
                            <h3 className="font-heading text-xl text-white mb-3">Designed for second chances</h3>
                            <p className="text-slate-400">Some people are worth seeing again. Don't let the moment slip away.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Story Cards - Visual Grid */}
            <section className="py-20 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="font-heading text-3xl md:text-5xl font-light text-white mb-4">
                            Real connections happen <span className="gradient-sunset-text">everywhere</span>
                        </h2>
                    </div>

                    {/* Image Grid */}
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Concert Card */}
                        <div className="relative group overflow-hidden rounded-3xl aspect-[4/3]">
                            <img 
                                src={CONCERT_IMAGE}
                                alt="Couple connecting at a concert"
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                            <div className="absolute bottom-0 left-0 right-0 p-8">
                                <span className="inline-block px-3 py-1 bg-rose-500/80 text-white text-xs font-bold rounded-full mb-3">
                                    CONCERTS & FESTIVALS
                                </span>
                                <h3 className="font-heading text-2xl text-white mb-2">
                                    "We locked eyes during the encore"
                                </h3>
                                <p className="text-slate-300 text-sm">
                                    Sarah found Mike after Taylor Swift's Eras Tour
                                </p>
                            </div>
                        </div>

                        {/* Baseball Card */}
                        <div className="relative group overflow-hidden rounded-3xl aspect-[4/3]">
                            <img 
                                src={BASEBALL_IMAGE}
                                alt="Couple meeting at a baseball game"
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                            <div className="absolute bottom-0 left-0 right-0 p-8">
                                <span className="inline-block px-3 py-1 bg-orange-500/80 text-white text-xs font-bold rounded-full mb-3">
                                    SPORTS EVENTS
                                </span>
                                <h3 className="font-heading text-2xl text-white mb-2">
                                    "She was in the seat next to me"
                                </h3>
                                <p className="text-slate-300 text-sm">
                                    James reconnected with Ana from the World Series
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* More locations */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                        {['Coffee Shops', 'Gyms', 'Airports', 'Festivals'].map((place, i) => (
                            <div key={place} className="glass-card p-4 text-center group hover:border-rose-500/30 transition-colors">
                                <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center ${
                                    i === 0 ? 'bg-rose-500/20 text-rose-400' :
                                    i === 1 ? 'bg-orange-500/20 text-orange-400' :
                                    i === 2 ? 'bg-amber-500/20 text-amber-300' :
                                    'bg-emerald-500/20 text-emerald-400'
                                }`}>
                                    <MapPin className="w-5 h-5" />
                                </div>
                                <span className="text-white text-sm font-medium">{place}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works - Updated from Genspark */}
            <section className="py-20 px-6 bg-midnight-paper">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="font-heading text-3xl md:text-4xl font-light text-white mb-4">
                            How Hi Again works
                        </h2>
                        <p className="text-slate-400">Three simple steps to your second chance</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="text-center">
                            <div className="w-20 h-20 rounded-full bg-rose-500/20 flex items-center justify-center mx-auto mb-6 relative">
                                <MapPin className="w-10 h-10 text-rose-400" />
                                <span className="absolute -top-2 -right-2 w-8 h-8 bg-rose-500 rounded-full flex items-center justify-center text-white font-bold">1</span>
                            </div>
                            <h3 className="font-heading text-xl text-white mb-2">Start with a real moment</h3>
                            <p className="text-slate-400">Meet someone at a concert, game, night out, or anywhere real life happens.</p>
                        </div>

                        <div className="text-center">
                            <div className="w-20 h-20 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-6 relative">
                                <Sparkles className="w-10 h-10 text-orange-400" />
                                <span className="absolute -top-2 -right-2 w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold">2</span>
                            </div>
                            <h3 className="font-heading text-xl text-white mb-2">Keep the connection alive</h3>
                            <p className="text-slate-400">Hi Again helps turn that shared moment into something you can return to.</p>
                        </div>

                        <div className="text-center">
                            <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-6 relative">
                                <Heart className="w-10 h-10 text-amber-300" />
                                <span className="absolute -top-2 -right-2 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white font-bold">3</span>
                            </div>
                            <h3 className="font-heading text-xl text-white mb-2">See where it goes</h3>
                            <p className="text-slate-400">Because the best connections deserve more than one hello.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Trust & Safety Section - NEW from Genspark */}
            <section className="py-20 px-6">
                <div className="max-w-4xl mx-auto">
                    <div className="glass-card p-10 md:p-12 border-emerald-500/20">
                        <div className="flex flex-col md:flex-row items-center gap-8">
                            <div className="flex-shrink-0">
                                <div className="w-20 h-20 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                                    <Shield className="w-10 h-10 text-emerald-400" />
                                </div>
                            </div>
                            <div className="text-center md:text-left">
                                <h3 className="font-heading text-2xl text-white mb-4">Built with trust in mind</h3>
                                <p className="text-slate-400 mb-6">
                                    Real connection only works when it feels safe, mutual, and respectful. Hi Again is designed around privacy, trust, and better real-world interactions.
                                </p>
                                <div className="flex flex-wrap justify-center md:justify-start gap-4">
                                    <div className="flex items-center gap-2 text-sm text-slate-300">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                        <span>Mutual matching only</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-slate-300">
                                        <Lock className="w-4 h-4 text-emerald-400" />
                                        <span>Private by default</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-slate-300">
                                        <Shield className="w-4 h-4 text-emerald-400" />
                                        <span>Block & report</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Premium Upsell */}
            <section className="py-20 px-6 bg-gradient-to-b from-midnight to-rose-950/20">
                <div className="max-w-4xl mx-auto text-center">
                    <Crown className="w-16 h-16 text-rose-400 mx-auto mb-6" />
                    <h2 className="font-heading text-3xl md:text-4xl font-light text-white mb-4">
                        Go Premium, Get More Matches
                    </h2>
                    <p className="text-lg text-slate-400 mb-8 max-w-2xl mx-auto">
                        Unlimited locations, see who's looking for you, share contact info directly, and get a verified badge.
                    </p>
                    <Link to="/premium">
                        <Button className="btn-primary text-lg px-10 py-6">
                            <Crown className="w-5 h-5 mr-2" />
                            Unlock Premium - $4.99/month
                        </Button>
                    </Link>
                </div>
            </section>

            {/* Final CTA - Updated from Genspark */}
            <section className="relative py-32 px-6 overflow-hidden">
                <div className="absolute inset-0">
                    <img 
                        src={CONCERT_IMAGE}
                        alt=""
                        className="w-full h-full object-cover opacity-30"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/90 to-midnight"></div>
                </div>

                <div className="relative z-10 max-w-3xl mx-auto text-center">
                    <h2 className="font-heading text-4xl md:text-6xl font-light text-white mb-6">
                        For the moments that
                        <span className="block gradient-sunset-text">felt real.</span>
                    </h2>
                    <p className="text-xl text-slate-300 mb-10">
                        Turn chance encounters into second chances. Your next connection might already be waiting.
                    </p>
                    <Link to="/register">
                        <Button 
                            className="btn-primary text-xl px-12 py-7"
                            data-testid="cta-register"
                        >
                            Get Early Access
                            <Heart className="w-6 h-6 ml-3" />
                        </Button>
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-6 border-t border-slate-800">
                <div className="max-w-6xl mx-auto">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
                        <div className="flex items-center gap-2">
                            <img 
                                src={LOGO_IMAGE} 
                                alt="Hi Again Logo" 
                                className="w-8 h-8 object-contain"
                            />
                            <span className="font-heading font-normal text-white">Hi Again</span>
                        </div>
                        <div className="flex items-center gap-6">
                            <Link to="/premium" className="text-sm text-slate-400 hover:text-rose-400 transition-colors">Premium</Link>
                            <Link to="/feed" className="text-sm text-slate-400 hover:text-rose-400 transition-colors">Feed</Link>
                            <Link to="/login" className="text-sm text-slate-400 hover:text-white transition-colors">Login</Link>
                            <Link to="/register" className="text-sm text-slate-400 hover:text-white transition-colors">Sign Up</Link>
                        </div>
                    </div>
                    <div className="flex flex-col md:flex-row justify-between items-center border-t border-slate-800 pt-8 gap-4">
                        <div className="text-center md:text-left">
                            <p className="text-sm text-slate-500 mb-2">
                                Hi Again — for the moments that deserve more than one hello.
                            </p>
                            <p className="text-sm text-slate-600">
                                © 2026 Crowdspulse Gsphere LLC. All rights reserved.
                            </p>
                        </div>
                        <div className="flex items-center gap-6">
                            <Link to="/privacy" className="text-sm text-slate-500 hover:text-rose-400 transition-colors">Privacy Policy</Link>
                            <Link to="/terms" className="text-sm text-slate-500 hover:text-rose-400 transition-colors">Terms of Service</Link>
                            <a href="mailto:support@hiagain.xyz" className="text-sm text-slate-500 hover:text-rose-400 transition-colors">Contact</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
