import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Eye, Crown, Lock, Loader2, UserCheck, Clock } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { Link } from 'react-router-dom';

export default function WhoViewedMe() {
    const { user } = useAuth();
    const [viewers, setViewers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isPremium, setIsPremium] = useState(false);

    const checkPremiumAndLoadViewers = useCallback(async () => {
        try {
            // Check subscription status (uses httpOnly cookie automatically)
            const statusRes = await api.get('/subscription/status');
            const premium = statusRes.data?.tier === 'premium';
            setIsPremium(premium);
            
            if (premium) {
                // Load viewers
                const viewersRes = await api.get('/profile/viewers');
                setViewers(viewersRes.data);
            }
        } catch (error) {
            console.error('Failed to load viewers:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        checkPremiumAndLoadViewers();
    }, [checkPremiumAndLoadViewers]);

    if (loading) {
        return (
            <div className="min-h-screen bg-midnight pt-20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
            </div>
        );
    }

    // Not Premium - Show upgrade prompt
    if (!isPremium) {
        return (
            <div className="min-h-screen bg-midnight pt-20 pb-12" data-testid="who-viewed-locked">
                <div className="max-w-2xl mx-auto px-6">
                    <div className="glass-card p-8 text-center">
                        <div className="w-20 h-20 rounded-full bg-rose-500/20 flex items-center justify-center mx-auto mb-6">
                            <Lock className="w-10 h-10 text-rose-400" />
                        </div>
                        
                        <h1 className="font-heading text-3xl text-white mb-4">
                            Who Viewed Your Profile?
                        </h1>
                        
                        <p className="text-slate-400 mb-6 max-w-md mx-auto">
                            This is a <span className="text-rose-400 font-medium">Premium VIP feature</span>. 
                            Upgrade to see everyone who's checked out your profile and is interested in connecting with you.
                        </p>

                        {/* Blurred Preview */}
                        <div className="relative mb-8">
                            <div className="space-y-3 blur-sm pointer-events-none">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-500 to-amber-500" />
                                        <div className="flex-1">
                                            <div className="h-4 w-32 bg-slate-700 rounded mb-2" />
                                            <div className="h-3 w-24 bg-slate-700/50 rounded" />
                                        </div>
                                        <div className="h-8 w-20 bg-rose-500/50 rounded-full" />
                                    </div>
                                ))}
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="bg-slate-900/90 px-6 py-4 rounded-xl border border-rose-500/30">
                                    <p className="text-white font-medium flex items-center gap-2">
                                        <Eye className="w-5 h-5 text-rose-400" />
                                        4 people viewed your profile
                                    </p>
                                </div>
                            </div>
                        </div>

                        <Link to="/premium">
                            <Button className="btn-primary text-lg px-8 py-4">
                                <Crown className="w-5 h-5 mr-2" />
                                Upgrade to Premium - $4.99/mo
                            </Button>
                        </Link>
                        
                        <p className="text-slate-500 text-sm mt-4">
                            Premium members also get: unlimited messages, VIP badge, and more
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Premium User - Show viewers
    return (
        <div className="min-h-screen bg-midnight pt-20 pb-12" data-testid="who-viewed-me">
            <div className="max-w-2xl mx-auto px-6">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center">
                        <Eye className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="font-heading text-2xl text-white">Who Viewed Me</h1>
                        <p className="text-slate-400 text-sm flex items-center gap-1">
                            <Crown className="w-4 h-4 text-amber-400" />
                            Premium VIP Feature
                        </p>
                    </div>
                </div>

                {viewers.length === 0 ? (
                    <div className="glass-card p-8 text-center">
                        <Eye className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                        <h3 className="text-white font-medium mb-2">No profile views yet</h3>
                        <p className="text-slate-400 text-sm">
                            When someone views your profile, they'll appear here.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {viewers.map((viewer) => (
                            <div 
                                key={viewer.id}
                                className="glass-card p-4 flex items-center gap-4 hover:border-rose-500/30 transition-colors"
                            >
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center overflow-hidden">
                                    {viewer.photo_url ? (
                                        <img src={viewer.photo_url} alt={viewer.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-white font-medium text-lg">
                                            {viewer.name?.charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                </div>
                                
                                <div className="flex-1">
                                    <h3 className="text-white font-medium">{viewer.name}</h3>
                                    <p className="text-slate-400 text-sm flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        Viewed {viewer.viewed_at}
                                    </p>
                                </div>
                                
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                                >
                                    <UserCheck className="w-4 h-4 mr-1" />
                                    Connect
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
