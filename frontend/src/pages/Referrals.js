import { useState, useEffect, useCallback } from 'react';
import { referralApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
    Gift, Users, Share2, Copy, Check, Crown, BadgeCheck, 
    Loader2, Trophy, ChevronRight, Sparkles, Link as LinkIcon,
    MessageCircle, Twitter, Send, Mail
} from 'lucide-react';
import { toast } from 'sonner';

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

export default function Referrals() {
    const [stats, setStats] = useState(null);
    const [history, setHistory] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState('invite');

    const loadData = useCallback(async () => {
        try {
            const [statsRes, historyRes, leaderboardRes] = await Promise.all([
                referralApi.getStats(),
                referralApi.getHistory(),
                referralApi.getLeaderboard()
            ]);
            setStats(statsRes.data);
            setHistory(historyRes.data);
            setLeaderboard(leaderboardRes.data.leaderboard || []);
        } catch (err) {
            console.error('Failed to load referrals:', err?.message || err);
            toast.error('Failed to load referral data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            toast.success('Link copied to clipboard!');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error('Failed to copy');
        }
    };

    const getShareMessage = () => {
        if (!stats) return '';
        return `I'm using Hi Again to reconnect with people I've crossed paths with! Join me and we both get rewards. Use my code: ${stats.referral_code}\n\n${stats.share_url}`;
    };

    // Build share URLs as plain strings — used by <a href> below so browsers
    // treat them as direct user-gesture link clicks (bypass popup blockers,
    // ad blockers, programmatic-window.open restrictions).
    const message = getShareMessage();
    const inviteUrl = stats?.share_url || '';
    const SUBJECT = 'Join me on Hi Again';
    const shareUrls = stats ? {
        whatsapp: `https://wa.me/?text=${encodeURIComponent(message)}`,
        twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`,
        telegram: `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent('Join me on Hi Again!')}`,
        gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=&su=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(message)}`,
        email: `mailto:?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(message)}`,
    } : {};

    const shareNative = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Join me on Hi Again',
                    text: getShareMessage(),
                    url: stats?.share_url
                });
            } catch {
                // User cancelled
            }
        } else {
            copyToClipboard(stats?.share_url);
        }
    };

    const getProgressPercentage = () => {
        if (!stats?.next_tier) return 100;
        const currentReferrals = stats.successful_referrals;
        const thresholds = [1, 3, 5, 10];
        const currentThreshold = thresholds.find(t => t > currentReferrals) || 10;
        const prevThreshold = thresholds[thresholds.indexOf(currentThreshold) - 1] || 0;
        return ((currentReferrals - prevThreshold) / (currentThreshold - prevThreshold)) * 100;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-midnight pt-20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-midnight pt-20 pb-12" data-testid="referrals-page">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Hero Section */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-rose-500 to-amber-500 mb-4">
                        <Gift className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="font-heading text-3xl md:text-4xl font-bold text-white mb-2">
                        Invite Friends, Earn Rewards
                    </h1>
                    <p className="text-slate-400 max-w-md mx-auto">
                        Share Hi Again with friends and both of you get Premium perks when they join!
                    </p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="glass-card p-4 text-center">
                        <Users className="w-6 h-6 text-rose-400 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-white">{stats?.successful_referrals || 0}</div>
                        <div className="text-xs text-slate-400">Successful Referrals</div>
                    </div>
                    <div className="glass-card p-4 text-center">
                        <Crown className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-white">{stats?.earned_premium_days || 0}</div>
                        <div className="text-xs text-slate-400">Premium Days Earned</div>
                    </div>
                    <div className="glass-card p-4 text-center">
                        <Sparkles className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-white">{stats?.earned_extra_locations || 0}</div>
                        <div className="text-xs text-slate-400">Extra Locations</div>
                    </div>
                    <div className="glass-card p-4 text-center">
                        <BadgeCheck className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-white">{stats?.has_verified_badge ? 'Yes' : 'No'}</div>
                        <div className="text-xs text-slate-400">Verified Badge</div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-slate-800 pb-2">
                    {['invite', 'rewards', 'history', 'leaderboard'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-t-lg text-sm font-medium capitalize transition-colors ${
                                activeTab === tab
                                    ? 'bg-slate-800 text-white'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Invite Tab */}
                {activeTab === 'invite' && (
                    <div className="space-y-6">
                        {/* Your Referral Code */}
                        <div className="glass-card p-6">
                            <h3 className="font-heading text-lg text-white mb-4 flex items-center gap-2">
                                <LinkIcon className="w-5 h-5 text-rose-400" />
                                Your Referral Link
                            </h3>
                            
                            <div className="flex gap-2 mb-4">
                                <Input
                                    value={stats?.share_url || ''}
                                    readOnly
                                    className="bg-slate-800 border-slate-700 text-white font-mono text-sm"
                                />
                                <Button
                                    onClick={() => copyToClipboard(stats?.share_url)}
                                    className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30"
                                >
                                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            </div>

                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-slate-400 text-sm">Your code:</span>
                                <span className="font-mono font-bold text-amber-400 text-lg">{stats?.referral_code}</span>
                            </div>

                            {/* Share Buttons — using <a> anchors for popup-blocker resilience */}
                            <div className="flex flex-wrap gap-3">
                                <a
                                    href={shareUrls.whatsapp}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition"
                                    data-testid="share-whatsapp"
                                >
                                    <MessageCircle className="w-4 h-4 mr-2" />
                                    WhatsApp
                                </a>
                                <a
                                    href={shareUrls.twitter}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/30 transition"
                                    data-testid="share-twitter"
                                >
                                    <Twitter className="w-4 h-4 mr-2" />
                                    Twitter/X
                                </a>
                                <a
                                    href={shareUrls.telegram}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 transition"
                                    data-testid="share-telegram"
                                >
                                    <Send className="w-4 h-4 mr-2" />
                                    Telegram
                                </a>
                                <a
                                    href={shareUrls.gmail}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 transition"
                                    data-testid="share-gmail"
                                >
                                    <Mail className="w-4 h-4 mr-2" />
                                    Gmail
                                </a>
                                <a
                                    href={shareUrls.email}
                                    className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium bg-slate-500/20 hover:bg-slate-500/30 text-slate-300 border border-slate-500/30 transition"
                                    data-testid="share-email"
                                >
                                    <Mail className="w-4 h-4 mr-2" />
                                    Email app
                                </a>
                                <Button
                                    onClick={shareNative}
                                    className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30"
                                >
                                    <Share2 className="w-4 h-4 mr-2" />
                                    More
                                </Button>
                            </div>
                        </div>

                        {/* Progress to Next Tier */}
                        {stats?.next_tier && (
                            <div className="glass-card p-6">
                                <h3 className="font-heading text-lg text-white mb-4 flex items-center gap-2">
                                    <Trophy className="w-5 h-5 text-amber-400" />
                                    Progress to Next Reward
                                </h3>
                                
                                <div className="mb-4">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-slate-400">
                                            {stats.successful_referrals} referrals
                                        </span>
                                        <span className="text-amber-400">
                                            {stats.next_tier.referrals_needed} more to unlock
                                        </span>
                                    </div>
                                    <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full transition-all duration-500"
                                            style={{ width: `${getProgressPercentage()}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl">
                                    <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                                        <Gift className="w-6 h-6 text-amber-400" />
                                    </div>
                                    <div>
                                        <p className="text-white font-medium">Next Reward</p>
                                        <p className="text-sm text-slate-400">
                                            {stats.next_tier.reward.premium_days} days Premium
                                            {stats.next_tier.reward.badge && ` + ${stats.next_tier.reward.badge} badge`}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Rewards Tab */}
                {activeTab === 'rewards' && (
                    <div className="glass-card p-6">
                        <h3 className="font-heading text-lg text-white mb-6">Reward Tiers</h3>
                        
                        <div className="space-y-4">
                            {[
                                { id: 'tier-1', referrals: 1, reward: '3 days Premium + 3 extra locations', icon: Gift },
                                { id: 'tier-3', referrals: 3, reward: '7 days Premium + 5 extra locations', icon: Crown },
                                { id: 'tier-5', referrals: 5, reward: '30 days Premium + Verified Badge', icon: BadgeCheck },
                                { id: 'tier-10', referrals: 10, reward: '90 days Premium + Super Referrer Badge', icon: Trophy },
                            ].map((tier) => {
                                const Icon = tier.icon;
                                const achieved = (stats?.successful_referrals || 0) >= tier.referrals;
                                
                                return (
                                    <div 
                                        key={tier.id}
                                        className={`flex items-center gap-4 p-4 rounded-xl border ${
                                            achieved 
                                                ? 'bg-emerald-500/10 border-emerald-500/30' 
                                                : 'bg-slate-800/50 border-slate-700'
                                        }`}
                                    >
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                            achieved ? 'bg-emerald-500/20' : 'bg-slate-700'
                                        }`}>
                                            <Icon className={`w-6 h-6 ${achieved ? 'text-emerald-400' : 'text-slate-400'}`} />
                                        </div>
                                        <div className="flex-1">
                                            <p className={`font-medium ${achieved ? 'text-emerald-400' : 'text-white'}`}>
                                                {tier.referrals} Referral{tier.referrals > 1 ? 's' : ''}
                                            </p>
                                            <p className="text-sm text-slate-400">{tier.reward}</p>
                                        </div>
                                        {achieved && (
                                            <Check className="w-6 h-6 text-emerald-400" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl">
                            <p className="text-rose-400 text-sm">
                                <strong>Bonus:</strong> Your friends also get 3 days Premium + 2 extra locations when they join using your code!
                            </p>
                        </div>
                    </div>
                )}

                {/* History Tab */}
                {activeTab === 'history' && (
                    <div className="glass-card p-6">
                        <h3 className="font-heading text-lg text-white mb-6">Referral History</h3>
                        
                        {history.length > 0 ? (
                            <div className="space-y-3">
                                {history.map((item) => (
                                    <div 
                                        key={item.id}
                                        className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                                item.status === 'completed' 
                                                    ? 'bg-emerald-500/20' 
                                                    : 'bg-amber-500/20'
                                            }`}>
                                                <Users className={`w-5 h-5 ${
                                                    item.status === 'completed' 
                                                        ? 'text-emerald-400' 
                                                        : 'text-amber-400'
                                                }`} />
                                            </div>
                                            <div>
                                                <p className="text-white font-medium">{item.referred_name}</p>
                                                <p className="text-xs text-slate-400">
                                                    {new Date(item.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                            item.status === 'completed'
                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                : 'bg-amber-500/20 text-amber-400'
                                        }`}>
                                            {item.status === 'completed' ? 'Completed' : 'Pending'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                                <p className="text-slate-400">No referrals yet. Share your link to get started!</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Leaderboard Tab */}
                {activeTab === 'leaderboard' && (
                    <div className="glass-card p-6">
                        <h3 className="font-heading text-lg text-white mb-6 flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-amber-400" />
                            Top Referrers
                        </h3>
                        
                        {leaderboard.length > 0 ? (
                            <div className="space-y-3">
                                {leaderboard.map((user) => (
                                    <div 
                                        key={user.user_id}
                                        className={`flex items-center gap-4 p-4 rounded-xl ${
                                            user.rank === 1 ? 'bg-amber-500/10 border border-amber-500/30' :
                                            user.rank === 2 ? 'bg-slate-400/10 border border-slate-400/30' :
                                            user.rank === 3 ? 'bg-orange-500/10 border border-orange-500/30' :
                                            'bg-slate-800/50'
                                        }`}
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                                            user.rank === 1 ? 'bg-amber-500 text-black' :
                                            user.rank === 2 ? 'bg-slate-400 text-black' :
                                            user.rank === 3 ? 'bg-orange-500 text-black' :
                                            'bg-slate-700 text-white'
                                        }`}>
                                            {user.rank}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="text-white font-medium">{user.name}</p>
                                                {user.badge && (
                                                    <BadgeCheck className="w-4 h-4 text-amber-400" />
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-400">{user.referrals} referrals</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                                <p className="text-slate-400">Be the first on the leaderboard!</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
