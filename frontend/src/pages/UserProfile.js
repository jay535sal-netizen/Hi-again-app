import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { 
    MapPin, Calendar, Users, MessageCircle, UserPlus, ArrowLeft,
    Crown, BadgeCheck, Sparkles, Heart, Share2, Flag, Loader2,
    Instagram, Twitter, Globe, Mail, Lock, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { getInitials, formatDate } from '../lib/utils';
import ProfileGallery from '../components/ProfileGallery';

export default function UserProfile() {
    const { userId } = useParams();
    const { user: currentUser } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState(null);
    const [commonPlaces, setCommonPlaces] = useState([]);
    const [isPremium, setIsPremium] = useState(false);

    const loadProfile = useCallback(async () => {
        try {
            const [profileRes, statusRes] = await Promise.all([
                api.get(`/users/${userId}/profile`),
                api.get('/subscription/status').catch(() => ({ data: null }))
            ]);
            
            setProfile(profileRes.data);
            setConnectionStatus(profileRes.data.connection_status);
            setCommonPlaces(profileRes.data.common_places || []);
            setIsPremium(statusRes.data?.tier === 'premium');
            
            // Record profile view
            await api.post(`/profile/${userId}/view`).catch(() => {});
        } catch (error) {
            console.error('Failed to load profile:', error);
            toast.error('Could not load profile');
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    const handleConnect = async () => {
        setConnecting(true);
        try {
            await api.post('/connections', { target_id: userId });
            setConnectionStatus('pending');
            toast.success('Connection request sent!');
        } catch (error) {
            toast.error('Failed to send request');
        } finally {
            setConnecting(false);
        }
    };

    const handleShare = async () => {
        const shareUrl = `${window.location.origin}/user/${userId}`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Check out ${profile?.name} on Hi Again`,
                    text: `I found someone interesting on Hi Again!`,
                    url: shareUrl
                });
            } catch {
                // User cancelled
            }
        } else {
            navigator.clipboard.writeText(shareUrl);
            toast.success('Profile link copied!');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-midnight pt-20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen bg-midnight pt-20 px-6">
                <div className="max-w-2xl mx-auto text-center py-20">
                    <h1 className="text-2xl text-white mb-4">Profile not found</h1>
                    <Link to="/dashboard">
                        <Button className="btn-primary">Back to Dashboard</Button>
                    </Link>
                </div>
            </div>
        );
    }

    const isOwnProfile = currentUser?.id === userId;
    const canViewContact = isPremium || connectionStatus === 'accepted' || isOwnProfile;
    const canViewAllPlaces = isPremium || isOwnProfile;
    const canViewAllPosts = isPremium || isOwnProfile;

    return (
        <div className="min-h-screen bg-midnight pt-20 pb-12" data-testid="user-profile-page">
            {/* Premium Upsell Banner for Free Users */}
            {!isPremium && !isOwnProfile && (
                <div className="max-w-4xl mx-auto px-6 mb-4">
                    <Link 
                        to="/premium"
                        className="block p-4 bg-gradient-to-r from-rose-600/20 to-amber-600/20 border border-rose-500/30 rounded-xl hover:border-rose-500/50 transition-all"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Crown className="w-6 h-6 text-amber-400" />
                                <div>
                                    <p className="text-white font-medium">Unlock Full Profile</p>
                                    <p className="text-sm text-slate-400">See contact info, all photos & message directly</p>
                                </div>
                            </div>
                            <Button className="bg-gradient-to-r from-rose-500 to-amber-500 text-white text-sm">
                                Go Premium
                            </Button>
                        </div>
                    </Link>
                </div>
            )}

            {/* Back Button */}
            <div className="max-w-4xl mx-auto px-6 mb-6">
                <Link 
                    to="/crossings" 
                    className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Crossings
                </Link>
            </div>

            {/* Profile Header */}
            <div className="max-w-4xl mx-auto px-6">
                <div className="glass-card overflow-hidden">
                    {/* Cover/Banner */}
                    <div className="h-32 bg-gradient-to-r from-rose-600/30 via-purple-600/30 to-orange-600/30 relative">
                        {profile.is_premium && (
                            <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-black/30 backdrop-blur-sm rounded-full">
                                <Crown className="w-4 h-4 text-amber-400" />
                                <span className="text-sm text-amber-300 font-medium">VIP Member</span>
                            </div>
                        )}
                    </div>

                    {/* Avatar & Info */}
                    <div className="px-6 pb-6">
                        <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-16 relative z-10">
                            {/* Large Avatar */}
                            <div className="relative">
                                <Avatar className={`w-32 h-32 border-4 ${
                                    profile.is_premium 
                                        ? 'border-rose-500 shadow-xl shadow-rose-500/30' 
                                        : 'border-slate-700'
                                }`}>
                                    {profile.photo_url ? (
                                        <AvatarImage src={profile.photo_url} alt={profile.name} className="object-cover" />
                                    ) : null}
                                    <AvatarFallback className="bg-gradient-to-br from-rose-500 to-orange-500 text-white text-4xl font-medium">
                                        {getInitials(profile.name)}
                                    </AvatarFallback>
                                </Avatar>
                                {profile.is_premium && (
                                    <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 flex items-center justify-center shadow-lg">
                                        <BadgeCheck className="w-6 h-6 text-white" />
                                    </div>
                                )}
                            </div>

                            {/* Name & Stats */}
                            <div className="flex-1 sm:pb-2">
                                <div className="flex items-center gap-3 mb-1">
                                    <h1 className="font-heading text-3xl text-white">{profile.name}</h1>
                                    {profile.is_premium && (
                                        <BadgeCheck className="w-6 h-6 text-rose-400" />
                                    )}
                                </div>
                                
                                {/* Contact - blurred for non-premium */}
                                <div className="relative inline-block mb-3">
                                    <p className={`text-slate-400 ${!canViewContact ? 'blur-sm select-none' : ''}`}>
                                        {profile.email}
                                    </p>
                                    {!canViewContact && (
                                        <Link 
                                            to="/premium"
                                            className="absolute inset-0 flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300"
                                        >
                                            <Lock className="w-3 h-3" />
                                            <span>Unlock with Premium</span>
                                        </Link>
                                    )}
                                </div>

                                {/* Quick Stats */}
                                <div className="flex items-center gap-4 text-sm">
                                    <div className="flex items-center gap-1 text-slate-300">
                                        <MapPin className="w-4 h-4 text-rose-400" />
                                        <span>{profile.location_count || 0} places</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-slate-300">
                                        <Users className="w-4 h-4 text-purple-400" />
                                        <span>{profile.crossing_count || 0} crossings</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-slate-300">
                                        <Calendar className="w-4 h-4 text-amber-400" />
                                        <span>Joined {formatDate(profile.created_at)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            {!isOwnProfile && (
                                <div className="flex gap-2 sm:pb-2">
                                    {connectionStatus === 'accepted' ? (
                                        <Link to={`/connections?chat=${userId}`}>
                                            <Button className="btn-primary">
                                                <MessageCircle className="w-4 h-4 mr-2" />
                                                Message
                                            </Button>
                                        </Link>
                                    ) : connectionStatus === 'pending' ? (
                                        <Button disabled className="bg-slate-700 text-slate-400">
                                            Request Pending
                                        </Button>
                                    ) : (
                                        <Button 
                                            onClick={handleConnect} 
                                            disabled={connecting}
                                            className="btn-primary"
                                        >
                                            {connecting ? (
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                                <UserPlus className="w-4 h-4 mr-2" />
                                            )}
                                            Say Hi
                                        </Button>
                                    )}
                                    <Button 
                                        variant="outline" 
                                        onClick={handleShare}
                                        className="border-slate-600 text-slate-300 hover:bg-slate-800"
                                    >
                                        <Share2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bio Section */}
                {profile.bio && (
                    <div className="glass-card p-6 mt-6">
                        <h2 className="font-heading text-lg text-white mb-3">About</h2>
                        <p className="text-slate-300 leading-relaxed">{profile.bio}</p>
                    </div>
                )}

                {/* Missed Connection (if any) */}
                {profile.missed_connection && (
                    <div className="glass-card p-6 mt-6 border-l-4 border-rose-500">
                        <div className="flex items-center gap-2 mb-3">
                            <Heart className="w-5 h-5 text-rose-400" />
                            <h2 className="font-heading text-lg text-white">Looking For Someone</h2>
                        </div>
                        <p className="text-slate-300 italic">"{profile.missed_connection}"</p>
                    </div>
                )}

                {/* Common Places - Limited for free users */}
                {commonPlaces.length > 0 && (
                    <div className="glass-card p-6 mt-6">
                        <h2 className="font-heading text-lg text-white mb-4 flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-amber-400" />
                            Places You Both Visited
                        </h2>
                        <div className="grid gap-3">
                            {commonPlaces.slice(0, canViewAllPlaces ? 10 : 2).map((place) => (
                                <div 
                                    key={`${place.city}-${place.event}-${place.date || ''}`}
                                    className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center">
                                            <MapPin className="w-5 h-5 text-rose-400" />
                                        </div>
                                        <div>
                                            <p className="text-white font-medium">{place.event}</p>
                                            <p className="text-sm text-slate-400">{place.city}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-slate-500">{formatDate(place.date)}</p>
                                        {place.overlap_count > 1 && (
                                            <p className="text-xs text-emerald-400">{place.overlap_count}x overlap</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {/* Teaser for more places */}
                        {!canViewAllPlaces && commonPlaces.length > 2 && (
                            <Link 
                                to="/premium"
                                className="mt-4 p-3 bg-slate-800/30 border border-dashed border-slate-600 rounded-lg flex items-center justify-center gap-2 hover:border-rose-500/50 transition-colors"
                            >
                                <Lock className="w-4 h-4 text-rose-400" />
                                <span className="text-sm text-slate-400">
                                    +{commonPlaces.length - 2} more places unlocked with Premium
                                </span>
                            </Link>
                        )}
                    </div>
                )}

                {/* Recent Activity (Posts) - Limited for free users */}
                {profile.recent_posts?.length > 0 && (
                    <div className="glass-card p-6 mt-6">
                        <h2 className="font-heading text-lg text-white mb-4">Recent Posts</h2>
                        <div className="grid grid-cols-3 gap-2">
                            {profile.recent_posts.slice(0, canViewAllPosts ? 6 : 2).map((post, index) => (
                                <Link 
                                    key={post.id || index}
                                    to={`/feed?post=${post.id}`}
                                    className="aspect-square rounded-lg overflow-hidden bg-slate-800 hover:opacity-80 transition-opacity"
                                >
                                    {post.media_url ? (
                                        <img 
                                            src={post.media_url} 
                                            alt="" 
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center p-2">
                                            <p className="text-xs text-slate-400 text-center line-clamp-3">
                                                {post.caption}
                                            </p>
                                        </div>
                                    )}
                                </Link>
                            ))}
                            
                            {/* Blurred teaser posts for free users */}
                            {!canViewAllPosts && profile.recent_posts.length > 2 && (
                                <>
                                    {profile.recent_posts.slice(2, 4).map((post, index) => (
                                        <Link
                                            key={`blur-${index}`}
                                            to="/premium"
                                            className="aspect-square rounded-lg overflow-hidden bg-slate-800 relative group"
                                        >
                                            {post.media_url ? (
                                                <img 
                                                    src={post.media_url} 
                                                    alt="" 
                                                    className="w-full h-full object-cover blur-lg"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-slate-700 blur-md" />
                                            )}
                                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                                                <Lock className="w-6 h-6 text-rose-400 mb-1" />
                                                <span className="text-xs text-white">Premium</span>
                                            </div>
                                        </Link>
                                    ))}
                                </>
                            )}
                        </div>
                        
                        {canViewAllPosts ? (
                            <Link 
                                to={`/feed?user=${userId}`}
                                className="block text-center text-sm text-rose-400 hover:text-rose-300 mt-4"
                            >
                                View all posts →
                            </Link>
                        ) : (
                            <Link 
                                to="/premium"
                                className="block text-center text-sm text-amber-400 hover:text-amber-300 mt-4"
                            >
                                <Crown className="w-4 h-4 inline mr-1" />
                                Unlock all {profile.recent_posts.length} posts with Premium
                            </Link>
                        )}
                    </div>
                )}

                {/* Photo Gallery */}
                <div className="mt-6 bg-slate-900/60 rounded-3xl border border-white/10 p-6" data-testid="user-profile-gallery">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-white font-semibold text-lg">Gallery</h3>
                            <p className="text-sm text-white/50">{profile.name?.split(' ')[0]}'s photos and album</p>
                        </div>
                    </div>
                    <ProfileGallery userId={userId} isOwnProfile={isOwnProfile} />
                </div>

                {/* Report Button */}
                {!isOwnProfile && (
                    <div className="mt-6 text-center">
                        <button className="text-sm text-slate-500 hover:text-slate-400 flex items-center gap-1 mx-auto">
                            <Flag className="w-4 h-4" />
                            Report Profile
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
