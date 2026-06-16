import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { referralApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Sparkles, Mail, Lock, User, ArrowRight, Loader2, Heart, Gift, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function Register() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [referralCode, setReferralCode] = useState('');
    const [referrerName, setReferrerName] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        // Check for referral code in URL
        const refCode = searchParams.get('ref');
        if (refCode) {
            setReferralCode(refCode.toUpperCase());
            validateReferralCode(refCode);
        }
    }, [searchParams]);

    const validateReferralCode = async (code) => {
        if (!code || code.length < 4) return;
        try {
            const response = await referralApi.validate(code);
            if (response.data.valid) {
                setReferrerName(response.data.referrer_name);
            } else {
                setReferrerName('');
            }
        } catch (err) {
            console.warn('Referral validation failed:', err?.message || err);
            setReferrerName('');
        }
    };

    const handleReferralCodeChange = (e) => {
        const code = e.target.value.toUpperCase();
        setReferralCode(code);
        if (code.length >= 4) {
            validateReferralCode(code);
        } else {
            setReferrerName('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!name || !email || !password) {
            toast.error('Please fill in all fields');
            return;
        }

        if (password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            await register(name, email, password);
            
            // Apply referral code if provided
            if (referralCode && referrerName) {
                try {
                    await referralApi.apply(referralCode);
                    toast.success(`Referral from ${referrerName} applied! Log your first location for rewards.`);
                } catch (err) {
                    // Referral application failed, but registration succeeded
                    console.warn('Referral apply failed:', err?.message || err);
                }
            }
            
            toast.success('Account created! Welcome to Hi Again.');
            navigate('/dashboard');
        } catch (error) {
            const message = error.response?.data?.detail || 'Registration failed. Please try again.';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-midnight flex items-center justify-center p-6" data-testid="register-page">
            {/* Background */}
            <div className="absolute inset-0 bg-radial-glow"></div>

            <div className="relative z-10 w-full max-w-md">
                {/* Logo */}
                <Link to="/" className="flex items-center justify-center gap-2 mb-8 group">
                    <div className="w-10 h-10 rounded-full gradient-sunset flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-heading font-normal text-2xl text-white">Hi Again</span>
                </Link>

                {/* Referral Banner */}
                {referrerName && (
                    <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <Gift className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-emerald-400 font-medium">Invited by {referrerName}</p>
                            <p className="text-xs text-slate-400">You'll both earn rewards when you join!</p>
                        </div>
                    </div>
                )}

                {/* Register Card */}
                <div className="glass-card p-8">
                    <div className="text-center mb-8">
                        <h1 className="font-heading text-2xl font-light text-white mb-2">
                            Create your account
                        </h1>
                        <p className="text-slate-400">
                            Start discovering your path crossings today
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-slate-300">
                                Full Name
                            </Label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <Input
                                    id="name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="John Doe"
                                    className="input-dark pl-12"
                                    data-testid="register-name"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-slate-300">
                                Email
                            </Label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <Input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    className="input-dark pl-12"
                                    data-testid="register-email"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-slate-300">
                                Password
                            </Label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="input-dark pl-12"
                                    data-testid="register-password"
                                />
                            </div>
                            <p className="text-xs text-slate-500">
                                Must be at least 6 characters
                            </p>
                        </div>

                        {/* Referral Code Field */}
                        <div className="space-y-2">
                            <Label htmlFor="referral" className="text-slate-300 flex items-center gap-2">
                                <Gift className="w-4 h-4 text-emerald-400" />
                                Referral Code <span className="text-slate-500">(optional)</span>
                            </Label>
                            <div className="relative">
                                <Input
                                    id="referral"
                                    type="text"
                                    value={referralCode}
                                    onChange={handleReferralCodeChange}
                                    placeholder="FRIENDS2026"
                                    className={`input-dark uppercase font-mono ${referrerName ? 'border-emerald-500/50' : ''}`}
                                    data-testid="register-referral"
                                />
                                {referrerName && (
                                    <Check className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400" />
                                )}
                            </div>
                            {referrerName && (
                                <p className="text-xs text-emerald-400">
                                    Valid code from {referrerName}! You'll both earn rewards.
                                </p>
                            )}
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full btn-primary"
                            data-testid="register-submit"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    Creating account...
                                </>
                            ) : (
                                <>
                                    Create Account
                                    <ArrowRight className="w-5 h-5 ml-2" />
                                </>
                            )}
                        </Button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-slate-400">
                            Already have an account?{' '}
                            <Link 
                                to="/login" 
                                className="text-rose-400 hover:text-rose-300 font-medium transition-colors"
                                data-testid="register-login-link"
                            >
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Decorative */}
                <div className="mt-8 text-center">
                    <Heart className="w-5 h-5 text-rose-500/30 mx-auto heartbeat" />
                </div>
            </div>
        </div>
    );
}
