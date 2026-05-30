import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Mail, ArrowLeft, Loader2, CheckCircle, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

// Same-origin if env URL points to a different origin than the page (avoids cross-origin CORS)
function resolveBackendUrl() {
    const envUrl = process.env.REACT_APP_BACKEND_URL || '';
    if (typeof window === 'undefined') return envUrl;
    try {
        if (!envUrl) return '';
        return new URL(envUrl).origin === window.location.origin ? envUrl : '';
    } catch { return envUrl; }
}
const BACKEND_URL = resolveBackendUrl();

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [resetCode, setResetCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [step, setStep] = useState(1); // 1: email, 2: code+password, 3: success

    const handleSendCode = async (e) => {
        e.preventDefault();
        if (!email) {
            toast.error('Please enter your email');
            return;
        }

        setLoading(true);
        try {
            await axios.post(`${BACKEND_URL}/api/auth/forgot-password`, { email });
            setSent(true);
            setStep(2);
            toast.success('Reset code sent! Check your email.');
        } catch (error) {
            const message = error.response?.data?.detail || 'Failed to send reset code';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        
        if (!resetCode) {
            toast.error('Please enter the reset code');
            return;
        }
        
        if (newPassword.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            await axios.post(`${BACKEND_URL}/api/auth/reset-password`, {
                email,
                code: resetCode,
                new_password: newPassword
            });
            setStep(3);
            toast.success('Password reset successfully!');
        } catch (error) {
            const message = error.response?.data?.detail || 'Failed to reset password';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-midnight flex items-center justify-center px-4" data-testid="forgot-password-page">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-md">
                {/* Back Link */}
                <Link 
                    to="/login" 
                    className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to login
                </Link>

                <div className="glass-card p-8">
                    {/* Step 1: Enter Email */}
                    {step === 1 && (
                        <>
                            <div className="text-center mb-8">
                                <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center mx-auto mb-4">
                                    <Mail className="w-8 h-8 text-rose-400" />
                                </div>
                                <h1 className="font-heading text-2xl text-white mb-2">Forgot Password?</h1>
                                <p className="text-slate-400">
                                    Enter your email and we'll send you a reset code
                                </p>
                            </div>

                            <form onSubmit={handleSendCode} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Email Address
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                        <Input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="your@email.com"
                                            className="input-dark pl-10"
                                            data-testid="email-input"
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full btn-primary"
                                    data-testid="send-code-btn"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        'Send Reset Code'
                                    )}
                                </Button>
                            </form>
                        </>
                    )}

                    {/* Step 2: Enter Code & New Password */}
                    {step === 2 && (
                        <>
                            <div className="text-center mb-8">
                                <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                                    <KeyRound className="w-8 h-8 text-amber-400" />
                                </div>
                                <h1 className="font-heading text-2xl text-white mb-2">Reset Password</h1>
                                <p className="text-slate-400">
                                    Enter the code sent to <span className="text-white">{email}</span>
                                </p>
                            </div>

                            <form onSubmit={handleResetPassword} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Reset Code
                                    </label>
                                    <Input
                                        type="text"
                                        value={resetCode}
                                        onChange={(e) => setResetCode(e.target.value)}
                                        placeholder="Enter 6-digit code"
                                        className="input-dark text-center text-2xl tracking-widest"
                                        maxLength={6}
                                        data-testid="reset-code-input"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        New Password
                                    </label>
                                    <Input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="input-dark"
                                        data-testid="new-password-input"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Confirm Password
                                    </label>
                                    <Input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="input-dark"
                                        data-testid="confirm-password-input"
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full btn-primary"
                                    data-testid="reset-password-btn"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            Resetting...
                                        </>
                                    ) : (
                                        'Reset Password'
                                    )}
                                </Button>

                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="w-full text-sm text-slate-400 hover:text-white transition-colors"
                                >
                                    Didn't receive the code? Try again
                                </button>
                            </form>
                        </>
                    )}

                    {/* Step 3: Success */}
                    {step === 3 && (
                        <div className="text-center py-8">
                            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                                <CheckCircle className="w-10 h-10 text-emerald-400" />
                            </div>
                            <h1 className="font-heading text-2xl text-white mb-2">Password Reset!</h1>
                            <p className="text-slate-400 mb-8">
                                Your password has been successfully reset. You can now login with your new password.
                            </p>
                            <Link to="/login">
                                <Button className="btn-primary">
                                    Go to Login
                                </Button>
                            </Link>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <p className="text-center text-slate-500 text-sm mt-8">
                    © 2024 Crowdspulse Gsphere LLC. All rights reserved.
                </p>
            </div>
        </div>
    );
}
