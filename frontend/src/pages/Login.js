import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Sparkles, Mail, Lock, ArrowRight, Loader2, Heart } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!email || !password) {
            toast.error('Please fill in all fields');
            return;
        }

        setLoading(true);
        try {
            await login(email, password);
            toast.success('Welcome back!');
            navigate('/dashboard');
        } catch (error) {
            const message = error.response?.data?.detail || 'Login failed. Please try again.';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-midnight flex items-center justify-center p-6" data-testid="login-page">
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

                {/* Login Card */}
                <div className="glass-card p-8">
                    <div className="text-center mb-8">
                        <h1 className="font-heading text-2xl font-light text-white mb-2">
                            Welcome back
                        </h1>
                        <p className="text-slate-400">
                            Sign in to discover your path crossings
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
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
                                    data-testid="login-email"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="text-slate-300">
                                    Password
                                </Label>
                                <Link 
                                    to="/forgot-password" 
                                    className="text-sm text-rose-400 hover:text-rose-300 transition-colors"
                                    data-testid="forgot-password-link"
                                >
                                    Forgot password?
                                </Link>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="input-dark pl-12"
                                    data-testid="login-password"
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full btn-primary"
                            data-testid="login-submit"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    Sign In
                                    <ArrowRight className="w-5 h-5 ml-2" />
                                </>
                            )}
                        </Button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-slate-400">
                            Don't have an account?{' '}
                            <Link 
                                to="/register" 
                                className="text-rose-400 hover:text-rose-300 font-medium transition-colors"
                                data-testid="login-register-link"
                            >
                                Sign up
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
