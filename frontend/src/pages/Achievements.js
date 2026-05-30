import { useState, useEffect, useCallback } from 'react';
import { achievementsApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { 
    Trophy, Medal, Star, Lock, Sparkles, Crown, 
    Loader2, TrendingUp, Users, MapPin, Heart, MessageCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { getInitials } from '../lib/utils';

export default function Achievements() {
    const [achievements, setAchievements] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('badges');
    const [activeCategory, setActiveCategory] = useState('all');

    const loadData = useCallback(async () => {
        try {
            const [achievementsRes, leaderboardRes] = await Promise.all([
                achievementsApi.getMine(),
                achievementsApi.getLeaderboard(10)
            ]);
            setAchievements(achievementsRes.data);
            setLeaderboard(leaderboardRes.data.leaderboard || []);
        } catch {
            toast.error('Failed to load achievements');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const getTierGradient = (tier) => {
        switch (tier) {
            case 'diamond': return 'from-cyan-400 to-blue-500';
            case 'platinum': return 'from-slate-300 to-slate-500';
            case 'gold': return 'from-yellow-400 to-amber-500';
            case 'silver': return 'from-slate-400 to-slate-600';
            case 'bronze': return 'from-orange-400 to-orange-600';
            case 'special': return 'from-pink-400 to-purple-500';
            default: return 'from-slate-500 to-slate-700';
        }
    };

    const getCategoryIcon = (category) => {
        switch (category) {
            case 'posting': return MessageCircle;
            case 'connections': return Users;
            case 'crossings': return Sparkles;
            case 'locations': return MapPin;
            case 'engagement': return Heart;
            case 'special': return Crown;
            default: return Star;
        }
    };

    const categories = [
        { id: 'all', name: 'All', icon: Trophy },
        { id: 'posting', name: 'Posting', icon: MessageCircle },
        { id: 'connections', name: 'Connections', icon: Users },
        { id: 'crossings', name: 'Crossings', icon: Sparkles },
        { id: 'locations', name: 'Locations', icon: MapPin },
        { id: 'engagement', name: 'Engagement', icon: Heart },
        { id: 'special', name: 'Special', icon: Crown },
    ];

    const filterBadges = (badges) => {
        if (activeCategory === 'all') return badges;
        return badges.filter(b => b.category === activeCategory);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-midnight pt-20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-midnight pt-20 pb-12" data-testid="achievements-page">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header with User Title */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-rose-500 mb-4 animate-pulse">
                        <span className="text-4xl">{achievements?.user_title?.emoji}</span>
                    </div>
                    <h1 className="font-heading text-3xl md:text-4xl font-bold text-white mb-2">
                        {achievements?.user_title?.title}
                    </h1>
                    <p className="text-slate-400">
                        Activity Score: <span className="text-amber-400 font-bold">{achievements?.activity_score || 0}</span>
                    </p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="glass-card p-4 text-center">
                        <Trophy className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-white">{achievements?.badge_count || 0}</div>
                        <div className="text-xs text-slate-400">Badges Earned</div>
                    </div>
                    <div className="glass-card p-4 text-center">
                        <MessageCircle className="w-6 h-6 text-rose-400 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-white">{achievements?.stats?.posts || 0}</div>
                        <div className="text-xs text-slate-400">Posts</div>
                    </div>
                    <div className="glass-card p-4 text-center">
                        <Users className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-white">{achievements?.stats?.connections || 0}</div>
                        <div className="text-xs text-slate-400">Connections</div>
                    </div>
                    <div className="glass-card p-4 text-center">
                        <Heart className="w-6 h-6 text-pink-400 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-white">{achievements?.stats?.likes_received || 0}</div>
                        <div className="text-xs text-slate-400">Likes Received</div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-slate-800 pb-2">
                    {['badges', 'leaderboard'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-2 rounded-t-lg text-sm font-medium capitalize transition-colors ${
                                activeTab === tab
                                    ? 'bg-slate-800 text-white'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            {tab === 'badges' ? '🏆 My Badges' : '🥇 Leaderboard'}
                        </button>
                    ))}
                </div>

                {/* Badges Tab */}
                {activeTab === 'badges' && (
                    <>
                        {/* Category Filter */}
                        <div className="flex flex-wrap gap-2 mb-6">
                            {categories.map((cat) => {
                                const Icon = cat.icon;
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => setActiveCategory(cat.id)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors ${
                                            activeCategory === cat.id
                                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                : 'bg-slate-800 text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {cat.name}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Earned Badges */}
                        {filterBadges(achievements?.earned_badges || []).length > 0 && (
                            <div className="mb-8">
                                <h3 className="text-lg text-white font-medium mb-4 flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-amber-400" />
                                    Earned Badges ({filterBadges(achievements?.earned_badges || []).length})
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {filterBadges(achievements?.earned_badges || []).map((badge) => (
                                        <div
                                            key={badge.id}
                                            className={`glass-card p-4 border-2 hover:scale-105 transition-transform cursor-pointer`}
                                            style={{ borderColor: badge.tier_color + '50' }}
                                        >
                                            <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${getTierGradient(badge.tier)} flex items-center justify-center mx-auto mb-3`}>
                                                <span className="text-3xl">{badge.sticker}</span>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-white font-medium text-sm">{badge.name}</p>
                                                <p className="text-slate-400 text-xs mt-1">{badge.description}</p>
                                                <span 
                                                    className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs capitalize"
                                                    style={{ backgroundColor: badge.tier_color + '30', color: badge.tier_color }}
                                                >
                                                    {badge.tier}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Locked Badges */}
                        {filterBadges(achievements?.locked_badges || []).length > 0 && (
                            <div>
                                <h3 className="text-lg text-slate-400 font-medium mb-4 flex items-center gap-2">
                                    <Lock className="w-5 h-5" />
                                    Locked Badges ({filterBadges(achievements?.locked_badges || []).length})
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {filterBadges(achievements?.locked_badges || []).map((badge) => (
                                        <div
                                            key={badge.id}
                                            className="glass-card p-4 opacity-50 hover:opacity-75 transition-opacity"
                                        >
                                            <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center mx-auto mb-3 relative">
                                                <span className="text-3xl grayscale">{badge.sticker}</span>
                                                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 rounded-full">
                                                    <Lock className="w-6 h-6 text-slate-400" />
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-slate-400 font-medium text-sm">{badge.name}</p>
                                                <p className="text-slate-500 text-xs mt-1">{badge.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Leaderboard Tab */}
                {activeTab === 'leaderboard' && (
                    <div className="glass-card p-6">
                        <h3 className="text-lg text-white font-medium mb-6 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-amber-400" />
                            Top Achievers
                        </h3>
                        
                        {leaderboard.length > 0 ? (
                            <div className="space-y-3">
                                {leaderboard.map((user, i) => (
                                    <div 
                                        key={user.user_id}
                                        className={`flex items-center gap-4 p-4 rounded-xl ${
                                            i === 0 ? 'bg-amber-500/10 border border-amber-500/30' :
                                            i === 1 ? 'bg-slate-400/10 border border-slate-400/30' :
                                            i === 2 ? 'bg-orange-500/10 border border-orange-500/30' :
                                            'bg-slate-800/50'
                                        }`}
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                                            i === 0 ? 'bg-amber-500 text-black' :
                                            i === 1 ? 'bg-slate-400 text-black' :
                                            i === 2 ? 'bg-orange-500 text-black' :
                                            'bg-slate-700 text-white'
                                        }`}>
                                            {user.rank}
                                        </div>
                                        
                                        <Avatar className="w-12 h-12 border-2 border-slate-700">
                                            {user.photo_url ? (
                                                <AvatarImage src={user.photo_url} alt={user.name} />
                                            ) : null}
                                            <AvatarFallback className="bg-gradient-to-br from-rose-500 to-amber-500 text-white">
                                                {getInitials(user.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="text-white font-medium">{user.name}</p>
                                                <span className="text-lg">{user.user_title?.emoji}</span>
                                            </div>
                                            <p className="text-slate-400 text-sm">{user.user_title?.title}</p>
                                        </div>
                                        
                                        <div className="text-right">
                                            <p className="text-amber-400 font-bold">{user.activity_score}</p>
                                            <p className="text-slate-500 text-xs">{user.badge_count} badges</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                                <p className="text-slate-400">No data yet. Be the first to climb the ranks!</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
