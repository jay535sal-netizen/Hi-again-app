import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { crossingsApi, connectionsApi, subscriptionApi, profileApi } from '../lib/api';
import { Button } from '../components/ui/button';
import CrossingCard from '../components/CrossingCard';
import ShareInvite from '../components/ShareInvite';
import PrivateCircle from '../components/PrivateCircle';
import SuggestedCrossings from '../components/SuggestedCrossings';
import GPSTracker from '../components/GPSTracker';
import BluetoothTracker from '../components/BluetoothTracker'; // eslint-disable-line no-unused-vars
import OnboardingModal from '../components/OnboardingModal';
import EmailVerificationBanner from '../components/EmailVerificationBanner';
import MissedConnectionModal from '../components/MissedConnectionModal';
import { Link } from 'react-router-dom';
import { 
    Sparkles, MapPin, Users, History, ArrowRight, 
    Loader2, TrendingUp, Heart, Coffee, Crown, Zap, Star, Eye, Lock, BadgeCheck
} from 'lucide-react';
import { toast } from 'sonner';

// Visual images for engagement
const MOOD_IMAGES = [
    "https://images.unsplash.com/photo-1574962325789-fbe9cbcfacf0?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1717278088397-61477b512d78?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1563461661026-49631dd5d68e?w=400&h=300&fit=crop"
];

export default function Dashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [recentCrossings, setRecentCrossings] = useState([]);
    const [connections, setConnections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isPremium, setIsPremium] = useState(false);
    const [viewersCount, setViewersCount] = useState(0);
    const [missedOpen, setMissedOpen] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const [statsRes, crossingsRes, connectionsRes, subStatusRes, viewersCountRes] = await Promise.all([
                crossingsApi.getStats(),
                crossingsApi.getAll(),
                connectionsApi.getAll(),
                subscriptionApi.getStatus(),
                profileApi.getViewersCount().catch(() => ({ data: { count: 0 } }))
            ]);
            setStats(statsRes.data);
            setRecentCrossings(crossingsRes.data.slice(0, 5));
            setConnections(connectionsRes.data);
            setIsPremium(subStatusRes.data?.tier === 'premium');
            setViewersCount(viewersCountRes.data?.count || 0);
        } catch (error) {
            console.error('Failed to load dashboard:', error);
            toast.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleConnect = async (crossing) => {
        try {
            await connectionsApi.create({
                target_user_id: crossing.other_user_id,
                message: `We crossed paths at ${crossing.location_name || 'a location'}!`,
            });
            toast.success('Connection request sent!');
            loadData();
        } catch (error) {
            const message = error.response?.data?.detail || 'Failed to send request';
            toast.error(message);
        }
    };

    const isConnected = (userId) => {
        return connections.some(
            (c) => c.requester_id === userId || c.target_id === userId
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-midnight flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-midnight pt-20 pb-12" data-testid="dashboard-page">
            {/* Onboarding modal — shown once for new users */}
            {user && user.onboarded === false && <OnboardingModal />}

            {/* Email verification banner — shown until verified or dismissed */}
            <EmailVerificationBanner />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Visual Hero Banner */}
                <div className="relative rounded-3xl overflow-hidden mb-8 h-48 md:h-64">
                    <div className="absolute inset-0 grid grid-cols-3">
                        {MOOD_IMAGES.map((img) => (
                            <div key={img} className="relative overflow-hidden">
                                <img src={img} alt="" className="w-full h-full object-cover" />
                            </div>
                        ))}
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-r from-midnight via-midnight/80 to-midnight/60" />
                    <div className="absolute inset-0 bg-gradient-to-t from-midnight via-transparent to-transparent" />
                    <div className="relative h-full flex items-center px-8">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-5 h-5 text-rose-400" />
                                <span className="text-rose-400 text-sm font-medium">Your Journey</span>
                            </div>
                            <h1 className="font-heading text-3xl md:text-5xl font-light text-white mb-2">
                                Welcome back, <span className="gradient-sunset-text">{user?.name?.split(' ')[0]}</span>
                            </h1>
                            <p className="text-slate-300 max-w-md">
                                Every location you track brings you closer to meaningful connections
                            </p>
                        </div>
                    </div>
                </div>

                {/* Premium Upgrade Banner (for free users) */}
                {!isPremium && (
                    <Link to="/premium" className="block mb-8">
                        <div className="glass-card p-4 md:p-6 border-rose-500/30 bg-gradient-to-r from-rose-500/10 to-amber-500/10 hover:from-rose-500/20 hover:to-amber-500/20 transition-all group">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center">
                                        <Crown className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-white flex items-center gap-2">
                                            Unlock Premium Features
                                            <Zap className="w-4 h-4 text-amber-400" />
                                        </h3>
                                        <p className="text-sm text-slate-400">
                                            See who viewed you • Unlimited messages • Verified badge
                                        </p>
                                    </div>
                                </div>
                                <div className="hidden md:flex items-center gap-2 text-rose-400 group-hover:translate-x-1 transition-transform">
                                    <span className="font-medium">$4.99/mo</span>
                                    <ArrowRight className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                    </Link>
                )}

                {/* Premium Status Banner (for premium users) */}
                {isPremium && (
                    <div className="glass-card p-4 md:p-6 mb-8 border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-emerald-500/10">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-emerald-500 flex items-center justify-center">
                                <BadgeCheck className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="font-medium text-white flex items-center gap-2">
                                    VIP Premium Member
                                    <Crown className="w-4 h-4 text-amber-400" />
                                </h3>
                                <p className="text-sm text-slate-400">
                                    You have access to all premium features • Verified badge active
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
                    <div className="glass-card p-6 card-hover" data-testid="stat-crossings">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-rose-400" />
                            </div>
                        </div>
                        <div className="text-3xl font-heading font-normal text-white mb-1">
                            {stats?.total_crossings || 0}
                        </div>
                        <div className="text-sm text-slate-400">Path Crossings</div>
                    </div>

                    <div className="glass-card p-6 card-hover" data-testid="stat-people">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                                <Users className="w-5 h-5 text-orange-400" />
                            </div>
                        </div>
                        <div className="text-3xl font-heading font-normal text-white mb-1">
                            {stats?.unique_people || 0}
                        </div>
                        <div className="text-sm text-slate-400">Unique People</div>
                    </div>

                    <div className="glass-card p-6 card-hover" data-testid="stat-locations">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                <MapPin className="w-5 h-5 text-amber-300" />
                            </div>
                        </div>
                        <div className="text-3xl font-heading font-normal text-white mb-1">
                            {stats?.total_locations || 0}
                        </div>
                        <div className="text-sm text-slate-400">Locations Tracked</div>
                    </div>

                    <div className="glass-card p-6 card-hover" data-testid="stat-top-location">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-emerald-400" />
                            </div>
                        </div>
                        <div className="text-lg font-heading font-normal text-white mb-1 truncate">
                            {stats?.top_location || 'N/A'}
                        </div>
                        <div className="text-sm text-slate-400">Top Location</div>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Recent Crossings */}
                    <div className="lg:col-span-2">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="font-heading text-xl font-normal text-white flex items-center gap-2">
                                <History className="w-5 h-5 text-rose-400" />
                                Recent Crossings
                            </h2>
                            <Link to="/crossings">
                                <Button variant="ghost" className="text-slate-400 hover:text-white">
                                    View All
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </Link>
                        </div>

                        {recentCrossings.length > 0 ? (
                            <div className="space-y-4">
                                {recentCrossings.map((crossing) => (
                                    <CrossingCard
                                        key={crossing.id}
                                        crossing={crossing}
                                        onConnect={handleConnect}
                                        isConnected={isConnected(crossing.other_user_id)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="glass-card p-12 text-center">
                                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                                    <Sparkles className="w-8 h-8 text-slate-600" />
                                </div>
                                <h3 className="font-heading text-lg font-normal text-white mb-2">
                                    No crossings yet
                                </h3>
                                <p className="text-slate-400 mb-6">
                                    Start adding locations to discover path crossings
                                </p>
                                <Link to="/locations">
                                    <Button className="btn-primary">
                                        Add Your First Location
                                        <MapPin className="w-4 h-4 ml-2" />
                                    </Button>
                                </Link>
                            </div>
                        )}

                        {/* People You Might Have Crossed Paths With */}
                        <div className="mt-8">
                            <SuggestedCrossings limit={5} showViewAll={true} />
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Who Viewed Me Card - Premium Feature */}
                        <Link to="/who-viewed-me" className="block">
                            <div className={`glass-card p-6 hover:border-amber-500/30 transition-all ${isPremium ? 'border-amber-500/20' : ''}`} data-testid="who-viewed-card">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                                            <Eye className="w-5 h-5 text-amber-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-heading text-lg font-normal text-white">Who Viewed Me</h3>
                                            <div className="flex items-center gap-1">
                                                <Crown className="w-3 h-3 text-amber-400" />
                                                <span className="text-xs text-amber-400">VIP Feature</span>
                                            </div>
                                        </div>
                                    </div>
                                    {isPremium && (
                                        <BadgeCheck className="w-5 h-5 text-amber-400" />
                                    )}
                                </div>
                                
                                {isPremium ? (
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="text-3xl font-heading text-white">{viewersCount}</span>
                                            <span className="text-slate-400 ml-2">profile views</span>
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-amber-400" />
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <div className="flex items-center justify-between blur-sm">
                                            <div>
                                                <span className="text-3xl font-heading text-white">{viewersCount}</span>
                                                <span className="text-slate-400 ml-2">people viewed you</span>
                                            </div>
                                        </div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="flex items-center gap-2 bg-amber-500/20 text-amber-400 px-4 py-2 rounded-full text-sm">
                                                <Lock className="w-4 h-4" />
                                                Upgrade to see
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Link>

                        {/* Quick Actions */}
                        <div className="glass-card p-6">
                            <h3 className="font-heading text-lg font-normal text-white mb-4">
                                Quick Actions
                            </h3>
                            <div className="space-y-3">
                                <Link to="/locations" className="block">
                                    <Button className="w-full justify-start bg-slate-800 hover:bg-slate-700 text-white">
                                        <MapPin className="w-4 h-4 mr-3 text-rose-400" />
                                        Check In Location
                                    </Button>
                                </Link>
                                <Link to="/locations#import" className="block">
                                    <Button className="w-full justify-start bg-slate-800 hover:bg-slate-700 text-white">
                                        <History className="w-4 h-4 mr-3 text-orange-400" />
                                        Import Google Timeline
                                    </Button>
                                </Link>
                                <Button
                                    onClick={() => setMissedOpen(true)}
                                    className="w-full justify-start bg-slate-800 hover:bg-slate-700 text-white"
                                    data-testid="open-missed-connection-modal"
                                >
                                    <Heart className="w-4 h-4 mr-3 text-rose-400" />
                                    Add Missed Connection
                                </Button>
                            </div>
                        </div>

                        {/* GPS Proximity Tracker */}
                        <GPSTracker 
                            onMatchFound={(count) => {
                                loadData(); // Refresh dashboard data when matches found
                            }}
                        />

                        {/* Bluetooth Proximity Tracker — deferred to v1.1 (BLE plugin requires Capacitor 6) */}
                        {false && (
                        <BluetoothTracker 
                            userId={user?.id}
                            onEncounterFound={(_count) => {
                                loadData();
                            }}
                            compact={true}
                        />
                        )}
                        {/* Missed Connection Promo */}
                        <div className="glass-rose rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center">
                                    <Heart className="w-5 h-5 text-rose-400 heartbeat" />
                                </div>
                                <h3 className="font-heading text-lg font-normal text-white">
                                    Missed Connection
                                </h3>
                            </div>
                            <p className="text-sm text-slate-400 mb-4">
                                Looking for someone special you crossed paths with? 
                                Describe them and we'll notify you if they join.
                            </p>
                            <Button
                                variant="outline"
                                onClick={() => setMissedOpen(true)}
                                className="w-full border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                                data-testid="missed-connection-cta"
                            >
                                Describe Your Crush
                            </Button>
                        </div>

                        {/* Private Circle - Add Friends */}
                        <div className="glass-card p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-green-400" />
                                </div>
                                <div>
                                    <h3 className="font-heading text-lg font-normal text-white">Private Circle</h3>
                                    <p className="text-xs text-slate-400">Find friends on Hi Again</p>
                                </div>
                            </div>
                            <p className="text-sm text-slate-400 mb-4">
                                Add contacts to discover mutual connections. Your data stays private.
                            </p>
                            <PrivateCircle />
                        </div>

                        {/* Share & Invite */}
                        <ShareInvite />

                        {/* Support Card */}
                        <div className="glass-card p-6 text-center">
                            <Coffee className="w-8 h-8 text-rose-400 mx-auto mb-3" />
                            <h3 className="font-heading text-base font-normal text-white mb-2">
                                Love Hi Again?
                            </h3>
                            <p className="text-sm text-slate-400 mb-4">
                                Help us keep building connections
                            </p>
                            <Link to="/donate">
                                <Button 
                                    size="sm"
                                    className="gradient-sunset text-white rounded-full hover:opacity-90"
                                    data-testid="dashboard-donate-btn"
                                >
                                    <Coffee className="w-4 h-4 mr-2" />
                                    Support Us
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Missed Connection modal */}
            <MissedConnectionModal
                open={missedOpen}
                onClose={() => setMissedOpen(false)}
                onCreated={loadData}
            />
        </div>
    );
}
