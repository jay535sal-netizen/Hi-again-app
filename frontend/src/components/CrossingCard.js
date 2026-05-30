import { MapPin, Calendar, UserPlus, Building, Sparkles, Zap, Users, Route, Crown, Eye, Lock, MessageCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { getInitials, formatDate } from '../lib/utils';
import { useState } from 'react';
import { Link } from 'react-router-dom';

// Match type icons and colors
const matchTypeConfig = {
    moment: { icon: Sparkles, color: 'text-rose-400', bg: 'bg-rose-500/20', label: 'Same Moment' },
    alumni: { icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Regular Spot' },
    path: { icon: Route, color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Crossed Paths' },
    nearby: { icon: MapPin, color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Same Area' },
    bluetooth_proximity: { icon: Sparkles, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Nearby (BLE)' },
};

const matchScoreConfig = {
    high: { color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Strong Match', glow: 'shadow-emerald-500/20' },
    medium: { color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Good Match', glow: 'shadow-amber-500/20' },
    low: { color: 'text-slate-400', bg: 'bg-slate-500/20', label: 'Match', glow: '' },
};

export default function CrossingCard({ crossing, onConnect, isConnected, isPremiumUser = false }) {
    const [showPremiumPrompt, setShowPremiumPrompt] = useState(false);
    const matchType = matchTypeConfig[crossing.match_type] || matchTypeConfig.path;
    const matchScore = matchScoreConfig[crossing.match_score] || matchScoreConfig.low;
    const MatchIcon = matchType.icon;
    const otherIsPremium = crossing.other_is_premium;

    // Check if contact info should be blurred for free users
    const shouldBlurContact = !isPremiumUser && !isConnected;

    return (
        <div 
            className={`glass-card p-6 card-hover group relative overflow-hidden ${matchScore.glow ? `shadow-lg ${matchScore.glow}` : ''}`}
            data-testid={`crossing-card-${crossing.id}`}
        >
            {/* Premium user glow effect */}
            {otherIsPremium && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-rose-500/10 to-transparent pointer-events-none" />
            )}

            <div className="flex items-start justify-between gap-4">
                {/* User Info with Enhanced Avatar - CLICKABLE */}
                <Link to={`/user/${crossing.other_user_id}`} className="flex items-center gap-4 flex-1 cursor-pointer">
                    <div className="relative">
                        {/* Large Avatar with Border */}
                        <Avatar className={`w-16 h-16 border-3 transition-all duration-300 group-hover:scale-105 ${
                            otherIsPremium 
                                ? 'border-rose-500 shadow-lg shadow-rose-500/30' 
                                : 'border-slate-600 group-hover:border-rose-500/50'
                        }`}>
                            {crossing.other_user_photo ? (
                                <AvatarImage 
                                    src={crossing.other_user_photo} 
                                    alt={crossing.other_user_name}
                                    className="object-cover"
                                />
                            ) : null}
                            <AvatarFallback className="bg-gradient-to-br from-rose-500 to-orange-500 text-white font-medium text-xl">
                                {getInitials(crossing.other_user_name)}
                            </AvatarFallback>
                        </Avatar>
                        
                        {/* Online/Match indicator */}
                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${
                            matchScore.score === 'high' ? 'bg-emerald-500' : 'bg-rose-500'
                        } crossing-point`}>
                            {matchScore.score === 'high' && <Sparkles className="w-3 h-3 text-white" />}
                        </div>
                        
                        {/* Premium Crown */}
                        {otherIsPremium && (
                            <div className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 flex items-center justify-center">
                                <Crown className="w-3 h-3 text-white" />
                            </div>
                        )}
                    </div>
                    
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-heading text-lg font-normal text-white group-hover:text-rose-400 transition-colors">
                                {crossing.other_user_name}
                            </h3>
                            {otherIsPremium && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-rose-500/20 text-rose-400 rounded-full">
                                    Premium
                                </span>
                            )}
                        </div>
                        
                        {/* Contact Info - Blurred for free users */}
                        <div className="relative">
                            <p className={`text-sm text-slate-500 ${shouldBlurContact ? 'blur-sm select-none' : ''}`}>
                                {crossing.other_user_email}
                            </p>
                            {shouldBlurContact && (
                                <button 
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowPremiumPrompt(true); }}
                                    className="absolute inset-0 flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300"
                                >
                                    <Lock className="w-3 h-3" />
                                    <span>Unlock with Premium</span>
                                </button>
                            )}
                        </div>
                        
                        {/* Match Score Badges */}
                        <div className="flex items-center gap-2 mt-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${matchScore.bg} ${matchScore.color}`}>
                                <Zap className="w-3 h-3" />
                                {matchScore.label}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${matchType.bg} ${matchType.color}`}>
                                <MatchIcon className="w-3 h-3" />
                                {matchType.label}
                            </span>
                        </div>
                    </div>
                </Link>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2">
                    {!isConnected ? (
                        <Button
                            onClick={() => onConnect(crossing)}
                            variant="outline"
                            size="sm"
                            className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500 rounded-full transition-all duration-300"
                            data-testid={`connect-btn-${crossing.id}`}
                        >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Say Hi
                        </Button>
                    ) : (
                        <>
                            <span className="px-3 py-1 text-xs font-medium text-emerald-500 bg-emerald-500/10 rounded-full text-center">
                                Connected
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-slate-400 hover:text-white"
                            >
                                <MessageCircle className="w-4 h-4 mr-1" />
                                Message
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Location Details with Visual Enhancement */}
            <div className="mt-4 pt-4 border-t border-slate-800">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center gap-2 text-slate-300 bg-slate-800/50 px-3 py-1.5 rounded-full">
                        <MapPin className="w-4 h-4 text-rose-400" />
                        <span className="font-medium">{crossing.event_or_place}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                        <Building className="w-4 h-4 text-orange-400" />
                        <span>{crossing.city}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                        <Calendar className="w-4 h-4 text-amber-300" />
                        <span>{formatDate(crossing.date)}</span>
                    </div>
                    {crossing.overlap_count > 1 && (
                        <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full">
                            <Sparkles className="w-4 h-4" />
                            <span className="font-medium">{crossing.overlap_count}x crossed paths</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Premium Prompt Modal */}
            {showPremiumPrompt && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                    onClick={() => setShowPremiumPrompt(false)}
                >
                    <div className="glass-card p-6 max-w-sm text-center" onClick={e => e.stopPropagation()}>
                        <div className="w-16 h-16 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 flex items-center justify-center mx-auto mb-4">
                            <Crown className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="font-heading text-xl text-white mb-2">Unlock Contact Info</h3>
                        <p className="text-slate-400 mb-6">
                            Upgrade to Premium to see full contact details, send unlimited messages, and get a verified badge.
                        </p>
                        <div className="space-y-3">
                            <a href="/premium" className="block">
                                <Button className="w-full btn-primary">
                                    <Crown className="w-4 h-4 mr-2" />
                                    Go Premium - $4.99/mo
                                </Button>
                            </a>
                            <button 
                                onClick={() => setShowPremiumPrompt(false)}
                                className="text-sm text-slate-400 hover:text-white"
                            >
                                Maybe later
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
