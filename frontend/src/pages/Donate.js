import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Coffee, Heart, Sparkles, ArrowLeft, Loader2, Check } from 'lucide-react';
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

export default function Donate() {
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session_id');
    
    const [packages, setPackages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingPackage, setProcessingPackage] = useState(null);
    const [paymentStatus, setPaymentStatus] = useState(null);
    const [polling, setPolling] = useState(false);

    const loadPackages = useCallback(async () => {
        try {
            const response = await axios.get(`${BACKEND_URL}/api/donations/packages`);
            setPackages(response.data.packages);
        } catch (err) {
            console.error('Failed to load donation packages:', err?.message || err);
        } finally {
            setLoading(false);
        }
    }, []);

    const pollPaymentStatus = useCallback(async (sid, attempts = 0) => {
        const maxAttempts = 5;
        const pollInterval = 2000;

        if (attempts >= maxAttempts) {
            setPaymentStatus('timeout');
            return;
        }

        setPolling(true);
        try {
            const response = await axios.get(`${BACKEND_URL}/api/donations/status/${sid}`);
            const data = response.data;

            if (data.payment_status === 'paid') {
                setPaymentStatus('success');
                setPolling(false);
                toast.success('Thank you for your support! 💖');
                return;
            } else if (data.status === 'expired') {
                setPaymentStatus('expired');
                setPolling(false);
                return;
            }

            // Continue polling - use setTimeout with inline function to avoid dependency cycle
            setTimeout(() => pollPaymentStatus(sid, attempts + 1), pollInterval);
        } catch (err) {
            console.error('Payment status check failed:', err?.message || err);
            setPolling(false);
        }
    }, []);

    useEffect(() => {
        loadPackages();
    }, [loadPackages]);

    useEffect(() => {
        if (sessionId) {
            pollPaymentStatus(sessionId);
        }
    }, [sessionId, pollPaymentStatus]);

    const handleDonate = async (packageId) => {
        setProcessingPackage(packageId);
        try {
            const originUrl = window.location.origin;
            const response = await axios.post(`${BACKEND_URL}/api/donations/checkout`, {
                package_id: packageId,
                origin_url: originUrl
            });

            // Redirect to Stripe
            window.location.href = response.data.checkout_url;
        } catch (error) {
            toast.error('Failed to start checkout. Please try again.');
            setProcessingPackage(null);
        }
    };

    if (sessionId && (polling || paymentStatus === 'success')) {
        return (
            <div className="min-h-screen bg-midnight flex items-center justify-center p-6" data-testid="donate-success-page">
                <div className="text-center">
                    {polling ? (
                        <>
                            <Loader2 className="w-16 h-16 text-rose-400 animate-spin mx-auto mb-6" />
                            <h1 className="font-heading text-3xl font-light text-white mb-4">
                                Processing your donation...
                            </h1>
                            <p className="text-slate-400">Please wait while we confirm your payment</p>
                        </>
                    ) : (
                        <>
                            <div className="w-20 h-20 rounded-full gradient-sunset flex items-center justify-center mx-auto mb-6">
                                <Check className="w-10 h-10 text-white" />
                            </div>
                            <h1 className="font-heading text-3xl font-light text-white mb-4">
                                Thank you! 💖
                            </h1>
                            <p className="text-slate-400 mb-8">
                                Your support means the world to us. Together we're making connections happen.
                            </p>
                            <Link to="/">
                                <Button className="btn-primary">
                                    Back to Home
                                </Button>
                            </Link>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-midnight pt-20 pb-12" data-testid="donate-page">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Back Link */}
                <Link to="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Home
                </Link>

                {/* Header */}
                <div className="text-center mb-12">
                    <div className="w-20 h-20 rounded-full gradient-sunset flex items-center justify-center mx-auto mb-6">
                        <Coffee className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="font-heading text-4xl md:text-5xl font-light text-white mb-4">
                        Support <span className="gradient-sunset-text">Hi Again</span>
                    </h1>
                    <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                        Help us keep bringing people together. Your support helps us maintain the app, 
                        add new features, and keep the magic of serendipity alive.
                    </p>
                </div>

                {/* Donation Packages */}
                {loading ? (
                    <div className="flex justify-center">
                        <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
                    </div>
                ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {packages.map((pkg) => (
                            <div
                                key={pkg.id}
                                className="glass-card p-6 card-hover text-center group"
                                data-testid={`donate-package-${pkg.id}`}
                            >
                                <div className="text-4xl mb-4">{pkg.emoji}</div>
                                <h3 className="font-heading text-xl font-normal text-white mb-2">
                                    {pkg.name}
                                </h3>
                                <div className="text-3xl font-bold gradient-sunset-text mb-6">
                                    ${pkg.amount.toFixed(2)}
                                </div>
                                <Button
                                    onClick={() => handleDonate(pkg.id)}
                                    disabled={processingPackage === pkg.id}
                                    className="w-full btn-primary"
                                    data-testid={`donate-btn-${pkg.id}`}
                                >
                                    {processingPackage === pkg.id ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <Heart className="w-4 h-4 mr-2" />
                                            Donate
                                        </>
                                    )}
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Thank You Note */}
                <div className="mt-16 glass-rose rounded-3xl p-8 text-center">
                    <Sparkles className="w-8 h-8 text-rose-400 mx-auto mb-4" />
                    <h3 className="font-heading text-xl font-normal text-white mb-2">
                        Every contribution matters
                    </h3>
                    <p className="text-slate-400">
                        Whether it's a coffee or dinner, your support helps us build features that 
                        bring more people together. Thank you for being part of our journey. 💖
                    </p>
                </div>
            </div>
        </div>
    );
}
