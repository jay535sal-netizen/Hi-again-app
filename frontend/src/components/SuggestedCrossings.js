import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { crossingsApi, connectionsApi } from '../lib/api';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { 
    Sparkles, MapPin, UserPlus, Loader2, ChevronRight, 
    BadgeCheck, Users, Clock, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { getInitials } from '../lib/utils';

export default function SuggestedCrossings({ limit = 5, showViewAll = true }) {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(null);

    const loadSuggestions = useCallback(async () => {
        try {
            const response = await crossingsApi.getSuggestions();
            setSuggestions(response.data.slice(0, limit));
        } catch (err) {
            // Suggestions are non-critical; log so dev can debug if it ever breaks.
            console.warn('Failed to load suggested crossings:', err?.message || err);
        } finally {
            setLoading(false);
        }
    }, [limit]);

    useEffect(() => {
        loadSuggestions();
    }, [loadSuggestions]);

    const handleConnect = async (suggestion) => {
        setConnecting(suggestion.user_id);
        try {
            await connectionsApi.create({
                target_user_id: suggestion.user_id,
                message: `Hi! Looks like we might have crossed paths - ${suggestion.reason}. Would love to connect!`,
            });
            toast.success('Connection request sent!');
            // Remove from suggestions
            setSuggestions(prev => prev.filter(s => s.user_id !== suggestion.user_id));
        } catch (error) {
            const message = error.response?.data?.detail || 'Failed to send request';
            toast.error(message);
        } finally {
            setConnecting(null);
        }
    };

    const getStrengthColor = (strength) => {
        switch (strength) {
            case 'likely': return 'text-emerald-400 bg-emerald-500/10';
            case 'possible': return 'text-amber-400 bg-amber-500/10';
            default: return 'text-slate-400 bg-slate-500/10';
        }
    };

    const getStrengthLabel = (strength) => {
        switch (strength) {
            case 'likely': return 'Likely crossed paths';
            case 'possible': return 'Possibly crossed paths';
            default: return 'Might have crossed paths';
        }
    };

    if (loading) {
        return (
            <div className="glass-card p-6">
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-rose-400 animate-spin" />
                </div>
            </div>
        );
    }

    if (suggestions.length === 0) {
        return (
            <div className="glass-card p-6" data-testid="suggested-crossings-empty">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center">
                        <Users className="w-5 h-5 text-rose-400" />
                    </div>
                    <div>
                        <h3 className="font-heading text-lg font-normal text-white">People You Might Know</h3>
                        <p className="text-xs text-slate-400">Based on your locations</p>
                    </div>
                </div>
                <div className="text-center py-6">
                    <MapPin className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm mb-3">Add more locations to discover potential connections</p>
                    <Link to="/locations">
                        <Button size="sm" variant="outline" className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10">
                            <MapPin className="w-4 h-4 mr-2" />
                            Add Location
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-card p-6" data-testid="suggested-crossings">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-heading text-lg font-normal text-white">People You Might Know</h3>
                        <p className="text-xs text-slate-400">Based on shared locations</p>
                    </div>
                </div>
                {showViewAll && suggestions.length >= limit && (
                    <Link to="/crossings?tab=suggestions" className="text-rose-400 hover:text-rose-300 text-sm flex items-center gap-1">
                        View all
                        <ChevronRight className="w-4 h-4" />
                    </Link>
                )}
            </div>

            <div className="space-y-3">
                {suggestions.map((suggestion) => (
                    <div 
                        key={suggestion.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors"
                        data-testid={`suggestion-${suggestion.user_id}`}
                    >
                        <Avatar className="w-12 h-12 border-2 border-slate-700">
                            {suggestion.photo_url ? (
                                <AvatarImage src={suggestion.photo_url} alt={suggestion.name} />
                            ) : null}
                            <AvatarFallback className="bg-gradient-to-br from-rose-500 to-amber-500 text-white">
                                {getInitials(suggestion.name)}
                            </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <h4 className="font-medium text-white truncate">{suggestion.name}</h4>
                                {suggestion.is_premium && (
                                    <BadgeCheck className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                )}
                            </div>
                            <p className="text-xs text-slate-400 truncate">{suggestion.reason}</p>
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full mt-1 ${getStrengthColor(suggestion.match_strength)}`}>
                                <Clock className="w-3 h-3" />
                                {getStrengthLabel(suggestion.match_strength)}
                            </span>
                        </div>
                        
                        <Button
                            size="sm"
                            onClick={() => handleConnect(suggestion)}
                            disabled={connecting === suggestion.user_id}
                            className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 flex-shrink-0"
                        >
                            {connecting === suggestion.user_id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <UserPlus className="w-4 h-4 mr-1" />
                                    Connect
                                </>
                            )}
                        </Button>
                    </div>
                ))}
            </div>

            {showViewAll && (
                <Link to="/crossings" className="block mt-4">
                    <Button variant="ghost" className="w-full text-slate-400 hover:text-white hover:bg-slate-800">
                        See all crossings
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                </Link>
            )}
        </div>
    );
}
