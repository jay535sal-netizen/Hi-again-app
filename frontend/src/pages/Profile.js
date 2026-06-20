import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api, { profileApi, locationsApi, crossingsApi, connectionsApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { 
    Camera, MapPin, Heart, Users, Grid3X3, Settings, 
    Share2, Crown, Loader2, Edit2, Check, Ghost, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { getInitials } from '../lib/utils';
import { Link } from 'react-router-dom';

import ProfileGallery from '../components/ProfileGallery';
import EmailPreferences from '../components/EmailPreferences';

export default function Profile() {
    const { user, updateUser } = useAuth();
    const [photoUrl, setPhotoUrl] = useState(null);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [stats, setStats] = useState({ locations: 0, crossings: 0, connections: 0 });
    const [editingName, setEditingName] = useState(false);
    const [editingBio, setEditingBio] = useState(false);
    const [name, setName] = useState(user?.name || '');
    const [bio, setBio] = useState('');
    const [loading, setLoading] = useState(true);
    const [ghostMode, setGhostMode] = useState(Boolean(user?.ghost_mode));
    const [savingGhost, setSavingGhost] = useState(false);
    const [subscription, setSubscription] = useState(null);
    const fileInputRef = useRef(null);

    const loadData = useCallback(async () => {
        try {
            const [locRes, crossRes, connRes, subRes] = await Promise.all([
                locationsApi.getAll(),
                crossingsApi.getAll(),
                connectionsApi.getAll(),
                api.get('/subscription/status').catch(() => null),
            ]);
            setStats({
                locations: locRes.data.length,
                crossings: crossRes.data.length,
                connections: connRes.data.filter(c => c.status === 'accepted').length
            });
            if (subRes?.data) {
                setSubscription({
                    tier: subRes.data.tier,
                    sub: subRes.data.subscription || null,
                });
            }
        } catch (error) {
            console.error('Failed to load profile stats:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
        // Load saved photo and bio. Aggressively purge stale base64 blobs left
        // over from before the object-storage migration — they bloat
        // localStorage and slow down every page open.
        let savedPhoto = null;
        try {
            savedPhoto = localStorage.getItem('userPhoto');
            if (savedPhoto && savedPhoto.startsWith('data:')) {
                localStorage.removeItem('userPhoto');
                savedPhoto = null;
            }
        } catch {
            // localStorage unavailable — non-critical
        }
        const savedBio = localStorage.getItem('userBio');
        // Prefer the server-authoritative photo (user.photo_url) over the local cache
        if (user?.photo_url) {
            setPhotoUrl(user.photo_url);
        } else if (savedPhoto) {
            setPhotoUrl(savedPhoto);
        }
        if (savedBio) setBio(savedBio);
    }, [loadData, user?.photo_url]);

    // Keep ghost mode toggle in sync if user data refreshes (e.g. on /auth/me re-check)
    useEffect(() => {
        setGhostMode(Boolean(user?.ghost_mode));
    }, [user?.ghost_mode]);

    const handlePhotoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image must be less than 5MB');
            return;
        }

        setUploadingPhoto(true);
        try {
            // Optimistic preview: show the local preview immediately
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64Preview = event.target.result;
                setPhotoUrl(base64Preview);

                // Upload to server (object storage). Replace the local preview
                // with the SERVER URL once the upload returns — never persist
                // the multi-MB base64 string to localStorage.
                try {
                    const res = await profileApi.uploadPhoto(file);
                    const serverUrl = res?.data?.photo_url;
                    if (serverUrl) {
                        setPhotoUrl(serverUrl);
                        try { localStorage.setItem('userPhoto', serverUrl); } catch {
                            // localStorage unavailable — non-critical
                        }
                    }
                    toast.success('Photo uploaded!');
                } catch (err) {
                    // Surface failure cleanly; don't leave the preview lingering.
                    toast.error(err?.response?.data?.detail || 'Photo upload failed');
                }
                setUploadingPhoto(false);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            toast.error('Failed to upload photo');
            setUploadingPhoto(false);
        }
    };

    const handleSaveName = async () => {
        try {
            await profileApi.update({ name });
            updateUser({ ...user, name });
            toast.success('Name updated!');
            setEditingName(false);
        } catch (error) {
            toast.error('Failed to update name');
        }
    };

    const handleSaveBio = () => {
        localStorage.setItem('userBio', bio);
        toast.success('Bio updated!');
        setEditingBio(false);
    };

    const handleToggleGhost = async () => {
        const next = !ghostMode;
        setGhostMode(next); // optimistic
        setSavingGhost(true);
        try {
            const res = await profileApi.update({ ghost_mode: next });
            // Server returns updated user; sync auth context
            updateUser({ ...user, ghost_mode: Boolean(res?.data?.ghost_mode) });
            toast.success(next ? 'Ghost Mode ON — you\'re invisible' : 'Ghost Mode OFF — you\'re visible again');
        } catch (err) {
            console.error('Failed to update ghost mode:', err?.message || err);
            setGhostMode(!next); // revert
            toast.error('Could not update Ghost Mode');
        } finally {
            setSavingGhost(false);
        }
    };

    const handleShare = () => {
        const profileUrl = `https://hiagain.xyz/u/${user?.id}`;
        if (navigator.share) {
            navigator.share({
                title: `${user?.name} on Hi Again`,
                text: 'Check out my profile on Hi Again - find people you\'ve crossed paths with!',
                url: profileUrl,
            });
        } else {
            navigator.clipboard.writeText(profileUrl);
            toast.success('Profile link copied!');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-midnight flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-rose-500/20 via-orange-500/10 to-midnight" data-testid="profile-page">
            {/* Header Background */}
            <div className="h-48 bg-gradient-to-r from-rose-500 via-orange-400 to-amber-400 relative">
                <div className="absolute inset-0 bg-black/20"></div>
            </div>

            {/* Profile Card */}
            <div className="max-w-lg mx-auto px-4 -mt-24 pb-8">
                {/* Main Profile Section */}
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
                    {/* Profile Photo */}
                    <div className="flex justify-center -mt-0 pt-0">
                        <div className="relative -mt-16">
                            <div className="w-32 h-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-slate-100">
                                {uploadingPhoto ? (
                                    <div className="w-full h-full flex items-center justify-center bg-slate-200">
                                        <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
                                    </div>
                                ) : photoUrl ? (
                                    <img src={photoUrl} alt={user?.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-rose-400 to-orange-400 flex items-center justify-center">
                                        <span className="text-white text-3xl font-bold">{getInitials(user?.name)}</span>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute bottom-1 right-1 w-10 h-10 bg-rose-500 rounded-full flex items-center justify-center shadow-lg hover:bg-rose-600 transition-colors"
                            >
                                <Camera className="w-5 h-5 text-white" />
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoUpload}
                                className="hidden"
                            />
                        </div>
                    </div>

                    {/* Name & Username */}
                    <div className="text-center px-6 pt-4 pb-2">
                        {editingName ? (
                            <div className="flex items-center justify-center gap-2">
                                <Input 
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="text-center text-xl font-bold max-w-[200px]"
                                />
                                <Button size="icon" onClick={handleSaveName} className="bg-emerald-500 hover:bg-emerald-600">
                                    <Check className="w-4 h-4" />
                                </Button>
                            </div>
                        ) : (
                            <h1 
                                className="text-2xl font-bold text-slate-800 cursor-pointer hover:text-rose-500 transition-colors inline-flex items-center gap-2"
                                onClick={() => setEditingName(true)}
                            >
                                {user?.name}
                                <Edit2 className="w-4 h-4 opacity-50" />
                            </h1>
                        )}
                        <p className="text-rose-500 font-medium">@{user?.email?.split('@')[0]}</p>
                    </div>

                    {/* Bio */}
                    <div className="px-6 pb-4">
                        {editingBio ? (
                            <div className="flex items-center gap-2">
                                <Input 
                                    value={bio}
                                    onChange={(e) => setBio(e.target.value)}
                                    placeholder="Add a bio..."
                                    className="text-center text-sm"
                                />
                                <Button size="icon" onClick={handleSaveBio} className="bg-emerald-500 hover:bg-emerald-600">
                                    <Check className="w-4 h-4" />
                                </Button>
                            </div>
                        ) : (
                            <p 
                                className="text-slate-600 text-center text-sm italic cursor-pointer hover:text-rose-500"
                                onClick={() => setEditingBio(true)}
                            >
                                {bio || '"Tap to add your bio"'}
                            </p>
                        )}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 px-4 pb-6">
                        <div className="bg-rose-50 rounded-2xl p-4 text-center">
                            <div className="text-2xl font-bold text-rose-500">{stats.locations}</div>
                            <div className="text-xs text-slate-500 font-medium">Places</div>
                        </div>
                        <div className="bg-orange-50 rounded-2xl p-4 text-center">
                            <div className="text-2xl font-bold text-orange-500">{stats.crossings}</div>
                            <div className="text-xs text-slate-500 font-medium">Crossings</div>
                        </div>
                        <div className="bg-amber-50 rounded-2xl p-4 text-center">
                            <div className="text-2xl font-bold text-amber-500">{stats.connections}</div>
                            <div className="text-xs text-slate-500 font-medium">Connections</div>
                        </div>
                    </div>

                    {/* Location */}
                    <div className="px-6 pb-4 flex items-center justify-center gap-2 text-slate-500">
                        <MapPin className="w-4 h-4 text-rose-400" />
                        <span className="text-sm">Tap to add location</span>
                    </div>

                    {/* Action Buttons */}
                    <div className="px-6 pb-6 grid grid-cols-2 gap-3">
                        <Button 
                            onClick={handleShare}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
                        >
                            <Share2 className="w-4 h-4 mr-2" />
                            Share Profile
                        </Button>
                        {subscription?.tier === 'premium' ? (
                            <Link to="/premium" className="w-full" data-testid="profile-premium-active">
                                <Button
                                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 text-white rounded-xl"
                                    title={subscription.sub?.expires_at ? `Renews ${new Date(subscription.sub.expires_at).toLocaleDateString()}` : ''}
                                >
                                    <Crown className="w-4 h-4 mr-2" />
                                    {(() => {
                                        const sub = subscription.sub;
                                        if (sub?.amount != null) {
                                            const cur = sub.currency || 'usd';
                                            const symbol = cur === 'inr' ? '₹' : '$';
                                            const amt = cur === 'inr'
                                                ? Math.round(sub.amount).toLocaleString('en-IN')
                                                : sub.amount.toFixed(2);
                                            return `Premium • ${symbol}${amt}`;
                                        }
                                        return 'Premium ✓';
                                    })()}
                                </Button>
                            </Link>
                        ) : (
                            <Link to="/premium" className="w-full">
                                <Button className="w-full bg-gradient-to-r from-rose-500 to-orange-500 hover:opacity-90 text-white rounded-xl">
                                    <Crown className="w-4 h-4 mr-2" />
                                    Go Premium
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="mt-6 grid grid-cols-4 gap-4">
                    <Link to="/locations" className="text-center">
                        <div className="w-14 h-14 bg-white rounded-2xl shadow-md flex items-center justify-center mx-auto mb-2 hover:scale-105 transition-transform">
                            <MapPin className="w-6 h-6 text-rose-500" />
                        </div>
                        <span className="text-xs text-white">Places</span>
                    </Link>
                    <Link to="/crossings" className="text-center">
                        <div className="w-14 h-14 bg-white rounded-2xl shadow-md flex items-center justify-center mx-auto mb-2 hover:scale-105 transition-transform">
                            <Heart className="w-6 h-6 text-orange-500" />
                        </div>
                        <span className="text-xs text-white">Matches</span>
                    </Link>
                    <Link to="/connections" className="text-center">
                        <div className="w-14 h-14 bg-white rounded-2xl shadow-md flex items-center justify-center mx-auto mb-2 hover:scale-105 transition-transform">
                            <Users className="w-6 h-6 text-amber-500" />
                        </div>
                        <span className="text-xs text-white">Friends</span>
                    </Link>
                    <Link to="/premium" className="text-center">
                        <div className="w-14 h-14 bg-white rounded-2xl shadow-md flex items-center justify-center mx-auto mb-2 hover:scale-105 transition-transform">
                            <Crown className="w-6 h-6 text-rose-500" />
                        </div>
                        <span className="text-xs text-white">Premium</span>
                    </Link>
                </div>

                {/* Missed Connection Card */}
                <div className="mt-6 bg-white rounded-3xl shadow-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center">
                            <Heart className="w-6 h-6 text-rose-500" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">Missed Connection</h3>
                            <p className="text-sm text-slate-500">Describe someone you're looking for</p>
                        </div>
                    </div>
                    <Link to="/missed-connection">
                        <Button className="w-full bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl">
                            Describe Your Crush
                        </Button>
                    </Link>
                </div>

                {/* Ghost Mode (Privacy) Card */}
                <div className="mt-6 bg-white rounded-3xl shadow-xl p-6" data-testid="ghost-mode-card">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                                ghostMode ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
                            }`}>
                                {ghostMode ? <Ghost className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    Ghost Mode
                                    {ghostMode && (
                                        <span className="text-[10px] font-semibold uppercase tracking-wider bg-slate-800 text-white px-2 py-0.5 rounded-full">
                                            Active
                                        </span>
                                    )}
                                </h3>
                                <p className="text-sm text-slate-500">
                                    {ghostMode
                                        ? 'You\'re browsing invisibly. You won\'t appear in others\' crossings or "Who Viewed Me".'
                                        : 'Browse profiles invisibly — your views and crossings stay hidden from others.'}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={ghostMode}
                            aria-label="Toggle Ghost Mode"
                            disabled={savingGhost}
                            onClick={handleToggleGhost}
                            data-testid="ghost-mode-toggle"
                            className={`shrink-0 mt-1 w-12 h-7 rounded-full transition-colors disabled:opacity-50 ${
                                ghostMode ? 'bg-slate-800' : 'bg-slate-300'
                            }`}
                        >
                            <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                                ghostMode ? 'translate-x-6' : 'translate-x-1'
                            }`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Email Preferences */}
            <div className="mt-6 bg-white rounded-3xl shadow-xl p-6" data-testid="email-prefs-card">
                <EmailPreferences />
            </div>

            {/* Photo Gallery */}
            <div className="mt-6 bg-white rounded-3xl shadow-xl p-6" data-testid="profile-gallery-card">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="font-bold text-slate-800 text-lg">Gallery</h2>
                        <p className="text-sm text-slate-500">Photos from your posts plus a private album.</p>
                    </div>
                </div>
                <div className="bg-slate-900 rounded-2xl p-4">
                    {user?.id ? <ProfileGallery userId={user.id} isOwnProfile /> : null}
                </div>
            </div>
        </div>
    );
}
