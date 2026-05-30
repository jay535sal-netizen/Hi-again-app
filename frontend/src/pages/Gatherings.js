import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { 
    PartyPopper, Plus, MapPin, Calendar, Clock, Users, 
    Crown, Lock, ChevronRight, Loader2, X, Check, Share2,
    Sparkles, Music, Coffee, Utensils, Dumbbell, Gamepad2,
    GraduationCap, Briefcase, Heart, Star
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { getInitials, formatDate } from '../lib/utils';

// Event category icons
const CATEGORIES = [
    { id: 'party', label: 'Party', icon: PartyPopper, color: 'rose' },
    { id: 'concert', label: 'Concert', icon: Music, color: 'purple' },
    { id: 'coffee', label: 'Coffee Meetup', icon: Coffee, color: 'amber' },
    { id: 'dinner', label: 'Dinner', icon: Utensils, color: 'orange' },
    { id: 'fitness', label: 'Fitness', icon: Dumbbell, color: 'green' },
    { id: 'gaming', label: 'Gaming', icon: Gamepad2, color: 'blue' },
    { id: 'networking', label: 'Networking', icon: Briefcase, color: 'slate' },
    { id: 'study', label: 'Study Group', icon: GraduationCap, color: 'cyan' },
    { id: 'dating', label: 'Singles Mixer', icon: Heart, color: 'pink' },
    { id: 'other', label: 'Other', icon: Star, color: 'gray' },
];

export default function Gatherings() {
    const { user } = useAuth();
    const [gatherings, setGatherings] = useState([]);
    const [myGatherings, setMyGatherings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('discover'); // 'discover', 'attending', 'hosting'
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isPremium, setIsPremium] = useState(false);

    const loadGatherings = useCallback(async () => {
        try {
            const [gatheringsRes, statusRes] = await Promise.all([
                api.get('/gatherings'),
                api.get('/subscription/status').catch(() => ({ data: null }))
            ]);
            
            setGatherings(gatheringsRes.data.upcoming || []);
            setMyGatherings(gatheringsRes.data.my_gatherings || []);
            setIsPremium(statusRes.data?.tier === 'premium');
        } catch (error) {
            console.error('Failed to load gatherings:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadGatherings();
    }, [loadGatherings]);

    const handleRSVP = async (gatheringId, attending) => {
        try {
            await api.post(`/gatherings/${gatheringId}/rsvp`, { attending });
            toast.success(attending ? 'You\'re going!' : 'RSVP removed');
            loadGatherings();
        } catch (error) {
            toast.error('Failed to RSVP');
        }
    };

    const handleShare = async (gathering) => {
        const shareUrl = `${window.location.origin}/gatherings/${gathering.id}`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: gathering.title,
                    text: `Join me at ${gathering.title} on Hi Again!`,
                    url: shareUrl
                });
            } catch {
                // User cancelled
            }
        } else {
            navigator.clipboard.writeText(shareUrl);
            toast.success('Link copied!');
        }
    };

    const filteredGatherings = activeTab === 'discover' 
        ? gatherings 
        : activeTab === 'attending'
            ? gatherings.filter(g => g.is_attending)
            : myGatherings;

    if (loading) {
        return (
            <div className="min-h-screen bg-midnight pt-20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-midnight pt-20 pb-12" data-testid="gatherings-page">
            <div className="max-w-6xl mx-auto px-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="font-heading text-3xl text-white flex items-center gap-3">
                            <PartyPopper className="w-8 h-8 text-rose-400" />
                            Gatherings
                        </h1>
                        <p className="text-slate-400 mt-1">Meet people you've crossed paths with IRL</p>
                    </div>
                    <Button 
                        onClick={() => setShowCreateModal(true)}
                        className="btn-primary"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Event
                    </Button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-slate-800 pb-4">
                    {[
                        { id: 'discover', label: 'Discover', icon: Sparkles },
                        { id: 'attending', label: 'Attending', icon: Check },
                        { id: 'hosting', label: 'My Events', icon: Crown },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                activeTab === tab.id
                                    ? 'bg-rose-500/20 text-rose-400'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Gatherings Grid */}
                {filteredGatherings.length === 0 ? (
                    <div className="text-center py-16">
                        <PartyPopper className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                        <h3 className="text-xl text-white mb-2">No gatherings yet</h3>
                        <p className="text-slate-400 mb-6">
                            {activeTab === 'hosting' 
                                ? 'Create your first event and invite your connections!'
                                : 'Be the first to create one!'}
                        </p>
                        <Button onClick={() => setShowCreateModal(true)} className="btn-primary">
                            <Plus className="w-4 h-4 mr-2" />
                            Create Event
                        </Button>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredGatherings.map(gathering => (
                            <GatheringCard 
                                key={gathering.id}
                                gathering={gathering}
                                isPremium={isPremium}
                                onRSVP={handleRSVP}
                                onShare={handleShare}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Create Event Modal */}
            {showCreateModal && (
                <CreateGatheringModal 
                    onClose={() => setShowCreateModal(false)}
                    onCreated={() => {
                        setShowCreateModal(false);
                        loadGatherings();
                    }}
                    isPremium={isPremium}
                />
            )}
        </div>
    );
}

// Gathering Card Component
function GatheringCard({ gathering, isPremium, onRSVP, onShare }) {
    const category = CATEGORIES.find(c => c.id === gathering.category) || CATEGORIES[9];
    const CategoryIcon = category.icon;
    const isHost = gathering.is_host;
    const isFull = gathering.attendee_count >= gathering.max_attendees;

    return (
        <div className="glass-card overflow-hidden group hover:border-rose-500/30 transition-all">
            {/* Cover Image or Gradient */}
            <div className={`h-32 relative bg-gradient-to-br from-${category.color}-600/30 to-${category.color}-900/30`}>
                {gathering.cover_image && (
                    <img 
                        src={gathering.cover_image} 
                        alt={gathering.title}
                        className="w-full h-full object-cover"
                    />
                )}
                <div className="absolute top-3 left-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium bg-${category.color}-500/20 text-${category.color}-400 flex items-center gap-1`}>
                        <CategoryIcon className="w-3 h-3" />
                        {category.label}
                    </span>
                </div>
                {isHost && (
                    <div className="absolute top-3 right-3">
                        <span className="px-2 py-1 rounded-full text-xs bg-amber-500/20 text-amber-400 flex items-center gap-1">
                            <Crown className="w-3 h-3" />
                            Host
                        </span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4">
                <h3 className="font-heading text-lg text-white mb-2 group-hover:text-rose-400 transition-colors">
                    {gathering.title}
                </h3>
                
                <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Calendar className="w-4 h-4 text-rose-400" />
                        <span>{formatDate(gathering.date)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Clock className="w-4 h-4 text-purple-400" />
                        <span>{gathering.time}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <MapPin className="w-4 h-4 text-amber-400" />
                        <span>{gathering.location}</span>
                    </div>
                </div>

                {/* Attendees Preview */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                            {gathering.attendees?.slice(0, 3).map((attendee, i) => (
                                <Avatar key={i} className="w-8 h-8 border-2 border-midnight">
                                    {attendee.photo_url ? (
                                        <AvatarImage src={attendee.photo_url} />
                                    ) : null}
                                    <AvatarFallback className="bg-gradient-to-br from-rose-500 to-orange-500 text-white text-xs">
                                        {getInitials(attendee.name)}
                                    </AvatarFallback>
                                </Avatar>
                            ))}
                        </div>
                        <span className="text-sm text-slate-400">
                            {gathering.attendee_count}/{gathering.max_attendees} going
                        </span>
                    </div>
                    
                    {/* Premium lock for full attendee list */}
                    {!isPremium && gathering.attendee_count > 3 && (
                        <Link to="/premium" className="text-xs text-rose-400 flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            See all
                        </Link>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    {gathering.is_attending ? (
                        <Button 
                            onClick={() => onRSVP(gathering.id, false)}
                            variant="outline"
                            className="flex-1 border-emerald-500/50 text-emerald-400"
                        >
                            <Check className="w-4 h-4 mr-2" />
                            Going
                        </Button>
                    ) : (
                        <Button 
                            onClick={() => onRSVP(gathering.id, true)}
                            disabled={isFull}
                            className="flex-1 btn-primary"
                        >
                            {isFull ? 'Full' : 'RSVP'}
                        </Button>
                    )}
                    <Button 
                        variant="outline" 
                        onClick={() => onShare(gathering)}
                        className="border-slate-600"
                    >
                        <Share2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

// Create Gathering Modal
function CreateGatheringModal({ onClose, onCreated, isPremium }) {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: 'party',
        location: '',
        city: '',
        date: '',
        time: '',
        max_attendees: 20,
        is_private: false
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.title || !formData.location || !formData.date || !formData.time) {
            toast.error('Please fill in all required fields');
            return;
        }

        setLoading(true);
        try {
            await api.post('/gatherings', formData);
            toast.success('Event created!');
            onCreated();
        } catch (error) {
            toast.error('Failed to create event');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                    <h2 className="font-heading text-xl text-white flex items-center gap-2">
                        <PartyPopper className="w-5 h-5 text-rose-400" />
                        Create Gathering
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Title */}
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Event Title *</label>
                        <Input
                            value={formData.title}
                            onChange={e => setFormData({...formData, title: e.target.value})}
                            placeholder="Friday Night Rooftop Party"
                            className="bg-slate-800 border-slate-600"
                        />
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Category</label>
                        <div className="grid grid-cols-5 gap-2">
                            {CATEGORIES.slice(0, 10).map(cat => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setFormData({...formData, category: cat.id})}
                                    className={`p-2 rounded-lg flex flex-col items-center gap-1 transition-colors ${
                                        formData.category === cat.id
                                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50'
                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                    }`}
                                >
                                    <cat.icon className="w-5 h-5" />
                                    <span className="text-xs">{cat.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Location */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Venue *</label>
                            <Input
                                value={formData.location}
                                onChange={e => setFormData({...formData, location: e.target.value})}
                                placeholder="Sky Lounge"
                                className="bg-slate-800 border-slate-600"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">City *</label>
                            <Input
                                value={formData.city}
                                onChange={e => setFormData({...formData, city: e.target.value})}
                                placeholder="Miami"
                                className="bg-slate-800 border-slate-600"
                            />
                        </div>
                    </div>

                    {/* Date & Time */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Date *</label>
                            <Input
                                type="date"
                                value={formData.date}
                                onChange={e => setFormData({...formData, date: e.target.value})}
                                className="bg-slate-800 border-slate-600"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Time *</label>
                            <Input
                                type="time"
                                value={formData.time}
                                onChange={e => setFormData({...formData, time: e.target.value})}
                                className="bg-slate-800 border-slate-600"
                            />
                        </div>
                    </div>

                    {/* Max Attendees */}
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Max Attendees</label>
                        <Input
                            type="number"
                            min="2"
                            max="500"
                            value={formData.max_attendees}
                            onChange={e => setFormData({...formData, max_attendees: parseInt(e.target.value)})}
                            className="bg-slate-800 border-slate-600 w-32"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={e => setFormData({...formData, description: e.target.value})}
                            placeholder="Tell people what to expect..."
                            rows={3}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none"
                        />
                    </div>

                    {/* Private Event Toggle */}
                    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                        <div>
                            <p className="text-white text-sm">Private Event</p>
                            <p className="text-xs text-slate-400">Only visible to your connections</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setFormData({...formData, is_private: !formData.is_private})}
                            className={`w-12 h-6 rounded-full transition-colors ${
                                formData.is_private ? 'bg-rose-500' : 'bg-slate-600'
                            }`}
                        >
                            <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                                formData.is_private ? 'translate-x-6' : 'translate-x-0.5'
                            }`} />
                        </button>
                    </div>

                    {/* Submit */}
                    <Button 
                        type="submit" 
                        disabled={loading}
                        className="w-full btn-primary py-3"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                <PartyPopper className="w-4 h-4 mr-2" />
                                Create Event
                            </>
                        )}
                    </Button>
                </form>
            </div>
        </div>
    );
}
