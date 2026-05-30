import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Mail, X, Check, Loader2, ShieldCheck } from 'lucide-react';
import { authApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const RESEND_COOLDOWN_SECONDS = 60;

export default function EmailVerificationBanner() {
    const { user, updateUser } = useAuth();
    const [open, setOpen] = useState(false);
    const [code, setCode] = useState('');
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [demoCode, setDemoCode] = useState(null);
    const [dismissed, setDismissed] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const [errorMsg, setErrorMsg] = useState(null);
    const tickRef = useRef(null);

    useEffect(() => {
        if (cooldown <= 0) return undefined;
        tickRef.current = setTimeout(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
        return () => clearTimeout(tickRef.current);
    }, [cooldown]);

    if (!user || user.email_verified || dismissed) return null;

    const sendCode = async () => {
        if (sending || cooldown > 0) return;
        setSending(true);
        setErrorMsg(null);
        try {
            const res = await authApi.sendVerification();
            setOpen(true);
            setCooldown(RESEND_COOLDOWN_SECONDS);
            if (res?.data?.demo_code) {
                // No email provider configured — surface the code in-app
                setDemoCode(res.data.demo_code);
                toast.message('Verification code generated', {
                    description: `Code: ${res.data.demo_code} (email sending not configured yet)`,
                });
            } else {
                setDemoCode(null);
                toast.success('Code sent — check your email (and spam folder)');
            }
        } catch (err) {
            const detail = err?.response?.data?.detail || err?.message || 'Could not send code';
            console.error('sendVerification failed:', detail);
            setErrorMsg(detail);
            toast.error(detail);
        } finally {
            setSending(false);
        }
    };

    const submitCode = async (e) => {
        e?.preventDefault?.();
        const cleaned = code.trim();
        if (!cleaned || cleaned.length < 6) {
            setErrorMsg('Enter the full 6-digit code');
            return;
        }
        setVerifying(true);
        setErrorMsg(null);
        try {
            await authApi.verifyEmail(cleaned);
            updateUser({ ...user, email_verified: true });
            toast.success("Email verified — you're all set!");
            setOpen(false);
            setCode('');
        } catch (err) {
            const detail = err?.response?.data?.detail || 'Invalid or expired code';
            setErrorMsg(detail);
        } finally {
            setVerifying(false);
        }
    };

    return (
        <>
            <div
                className="max-w-6xl mx-auto px-6 mt-4"
                data-testid="email-verify-banner"
            >
                <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                        <Mail className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-amber-200 truncate">
                            Verify your email <span className="text-slate-400">({user.email})</span> to unlock all features.
                        </p>
                    </div>
                    <Button
                        size="sm"
                        onClick={sendCode}
                        disabled={sending}
                        data-testid="email-verify-send-btn"
                        className="bg-amber-500 hover:bg-amber-600 text-white"
                    >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                    </Button>
                    <button
                        onClick={() => setDismissed(true)}
                        aria-label="Dismiss"
                        className="text-amber-400/60 hover:text-amber-200"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" data-testid="email-verify-modal">
                    <div className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-8">
                        <button
                            onClick={() => setOpen(false)}
                            aria-label="Close"
                            className="absolute top-4 right-4 text-slate-500 hover:text-slate-300"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="text-center mb-6">
                            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/15 flex items-center justify-center mb-4">
                                <ShieldCheck className="w-8 h-8 text-amber-400" />
                            </div>
                            <h2 className="font-heading text-xl text-white mb-2">Verify your email</h2>
                            <p className="text-sm text-slate-400">
                                Enter the 6-digit code we generated for <span className="text-amber-300">{user.email}</span>
                            </p>
                        </div>

                        {demoCode && (
                            <div className="mb-4 p-3 rounded-lg bg-slate-800 border border-slate-700 text-center">
                                <p className="text-xs text-slate-500 mb-1">Your code (email send not wired up yet)</p>
                                <p className="font-mono text-2xl tracking-[0.3em] text-amber-300" data-testid="demo-code">{demoCode}</p>
                            </div>
                        )}

                        {!demoCode && (
                            <p className="text-xs text-slate-500 text-center mb-4">
                                Didn't get it? Check spam, or wait a moment and resend below.
                            </p>
                        )}

                        <form onSubmit={submitCode} className="space-y-3">
                            <Input
                                value={code}
                                onChange={(e) => { setErrorMsg(null); setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); }}
                                placeholder="123456"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                autoFocus
                                data-testid="email-verify-code-input"
                                className={`text-center font-mono text-2xl tracking-[0.3em] bg-slate-800 ${
                                    errorMsg ? 'border-rose-500/60 focus-visible:ring-rose-500' : 'border-slate-700'
                                }`}
                            />
                            {errorMsg && (
                                <p className="text-xs text-rose-400 text-center" data-testid="email-verify-error">
                                    {errorMsg}
                                </p>
                            )}
                            <Button
                                type="submit"
                                disabled={verifying || code.length < 6}
                                data-testid="email-verify-submit"
                                className="w-full btn-primary"
                            >
                                {verifying ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Check className="w-4 h-4 mr-2" />
                                        Verify
                                    </>
                                )}
                            </Button>
                            <button
                                type="button"
                                onClick={sendCode}
                                disabled={sending || cooldown > 0}
                                data-testid="email-verify-resend"
                                className="block text-xs text-slate-500 hover:text-slate-300 disabled:hover:text-slate-500 disabled:opacity-60 mx-auto"
                            >
                                {sending ? 'Sending…' : cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
