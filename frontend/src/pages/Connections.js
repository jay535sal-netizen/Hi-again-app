import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { connectionsApi, subscriptionApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Loader2, Users, Check, X, Clock, UserPlus, Lock, Crown, MessageCircle, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';
import { getInitials, formatTimeAgo } from '../lib/utils';

export default function Connections() {
    const { user } = useAuth();
    const [connections, setConnections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');
    const [isPremium, setIsPremium] = useState(false);

    const checkPremiumStatus = useCallback(async () => {
        try {
            const response = await subscriptionApi.getStatus();
            setIsPremium(response.data?.tier === 'premium');
        } catch (err) {
            console.warn('Premium status check failed:', err?.message || err);
        }
    }, []);

    const loadConnections = useCallback(async () => {
        try {
            const response = await connectionsApi.getAll();
            setConnections(response.data);
        } catch (err) {
            console.error('Failed to load connections:', err?.message || err);
            toast.error('Failed to load connections');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadConnections();
        checkPremiumStatus();
    }, [loadConnections, checkPremiumStatus]);

    const handleUpdateConnection = async (connectionId, status) => {
        try {
            await connectionsApi.update(connectionId, status);
            toast.success(`Connection ${status}!`);
            loadConnections();
        } catch (error) {
            toast.error('Failed to update connection');
        }
    };

    const pendingReceived = connections.filter(
        (c) => c.status === 'pending' && c.target_id === user?.id
    );
    const pendingSent = connections.filter(
        (c) => c.status === 'pending' && c.requester_id === user?.id
    );
    const accepted = connections.filter((c) => c.status === 'accepted');

    const getFilteredConnections = () => {
        switch (activeTab) {
            case 'pending':
                return pendingReceived;
            case 'sent':
                return pendingSent;
            case 'accepted':
                return accepted;
            default:
                return connections;
        }
    };

    // Render message with premium gating
    const renderMessage = (message, isFromPremiumUser) => {
        if (!message) return null;
        
        // Premium users can see all messages
        if (isPremium) {
            return (
                <p className="text-sm text-slate-400 mt-1 italic">
                    "{message}"
                </p>
            );
        }
        
        // Free users can only see messages from premium users (who paid to send to them)
        // OR see blurred versions with upgrade prompt
        if (isFromPremiumUser) {
            return (
                <p className="text-sm text-slate-400 mt-1 italic">
                    "{message}"
                </p>
            );
        }
        
        // Free users see blurred message with upgrade prompt
        return (
            <div className="mt-2 relative">
                <div className="blur-sm select-none text-sm text-slate-400 italic">
                    "{message?.substring(0, 30)}..."
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <Link 
                        to="/premium"
                        className="flex items-center gap-1 text-xs bg-rose-500/20 text-rose-400 px-3 py-1 rounded-full hover:bg-rose-500/30 transition-colors"
                    >
                        <Lock className="w-3 h-3" />
                        Upgrade to read
                    </Link>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-midnight flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-midnight pt-20 pb-12" data-testid="connections-page">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="font-heading text-3xl font-bold text-white mb-2">
                                Connections
                            </h1>
                            <p className="text-slate-400">
                                Manage your path crossing connections
                            </p>
                        </div>
                        {isPremium && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-full">
                                <BadgeCheck className="w-4 h-4 text-amber-400" />
                                <span className="text-amber-400 text-sm font-medium">VIP Member</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Premium Upsell Banner for Free Users */}
                {!isPremium && pendingReceived.length > 0 && (
                    <div className="glass-card p-4 mb-6 border-rose-500/30 bg-gradient-to-r from-rose-500/10 to-amber-500/10">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center">
                                    <MessageCircle className="w-5 h-5 text-rose-400" />
                                </div>
                                <div>
                                    <p className="text-white font-medium">You have {pendingReceived.length} message{pendingReceived.length > 1 ? 's' : ''} waiting!</p>
                                    <p className="text-slate-400 text-sm">Upgrade to Premium to read all messages</p>
                                </div>
                            </div>
                            <Link to="/premium">
                                <Button size="sm" className="btn-primary">
                                    <Crown className="w-4 h-4 mr-2" />
                                    Upgrade
                                </Button>
                            </Link>
                        </div>
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="glass-card p-4 text-center">
                        <div className="text-2xl font-bold text-emerald-400">{accepted.length}</div>
                        <div className="text-sm text-slate-400">Connected</div>
                    </div>
                    <div className="glass-card p-4 text-center">
                        <div className="text-2xl font-bold text-amber-500">{pendingReceived.length}</div>
                        <div className="text-sm text-slate-400">Pending</div>
                    </div>
                    <div className="glass-card p-4 text-center">
                        <div className="text-2xl font-bold text-indigo-400">{pendingSent.length}</div>
                        <div className="text-sm text-slate-400">Sent</div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    {[
                        { id: 'all', label: 'All', count: connections.length },
                        { id: 'pending', label: 'Pending', count: pendingReceived.length },
                        { id: 'sent', label: 'Sent', count: pendingSent.length },
                        { id: 'accepted', label: 'Connected', count: accepted.length },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'bg-amber-500/20 text-amber-500'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                            data-testid={`tab-${tab.id}`}
                        >
                            {tab.label}
                            {tab.count > 0 && (
                                <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-800 text-xs">
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Connections List */}
                {getFilteredConnections().length > 0 ? (
                    <div className="space-y-4">
                        {getFilteredConnections().map((connection) => {
                            const isRequester = connection.requester_id === user?.id;
                            const otherUser = isRequester
                                ? { name: connection.target_name, email: connection.target_email }
                                : { name: connection.requester_name, email: connection.requester_email };
                            const isFromPremiumUser = connection.requester_is_premium && !isRequester;

                            return (
                                <div
                                    key={connection.id}
                                    className="glass-card p-6 card-hover"
                                    data-testid={`connection-${connection.id}`}
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <Avatar className="w-12 h-12 border-2 border-slate-700">
                                                <AvatarFallback className="bg-slate-800 text-amber-500">
                                                    {getInitials(otherUser.name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-heading font-semibold text-white">
                                                        {otherUser.name}
                                                    </h3>
                                                    {isFromPremiumUser && (
                                                        <BadgeCheck className="w-4 h-4 text-amber-400" title="Premium Member" />
                                                    )}
                                                </div>
                                                <p className="text-sm text-slate-500">{otherUser.email}</p>
                                                {renderMessage(connection.message, isFromPremiumUser)}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {connection.status === 'pending' && !isRequester && (
                                                <>
                                                    <Button
                                                        onClick={() => handleUpdateConnection(connection.id, 'accepted')}
                                                        size="sm"
                                                        className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30"
                                                        data-testid={`accept-${connection.id}`}
                                                    >
                                                        <Check className="w-4 h-4 mr-1" />
                                                        Accept
                                                    </Button>
                                                    <Button
                                                        onClick={() => handleUpdateConnection(connection.id, 'rejected')}
                                                        size="sm"
                                                        variant="ghost"
                                                        className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                                                        data-testid={`reject-${connection.id}`}
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </>
                                            )}
                                            {connection.status === 'pending' && isRequester && (
                                                <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-sm text-slate-400">
                                                    <Clock className="w-4 h-4" />
                                                    Pending
                                                </span>
                                            )}
                                            {connection.status === 'accepted' && (
                                                <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-sm text-emerald-400">
                                                    <UserPlus className="w-4 h-4" />
                                                    Connected
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-slate-800 text-sm text-slate-500">
                                        {formatTimeAgo(connection.created_at)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="glass-card p-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                            <Users className="w-8 h-8 text-slate-600" />
                        </div>
                        <h3 className="font-heading text-lg font-semibold text-white mb-2">
                            No connections yet
                        </h3>
                        <p className="text-slate-400">
                            {activeTab === 'pending'
                                ? 'No pending requests to review'
                                : activeTab === 'sent'
                                ? 'You haven\'t sent any connection requests'
                                : 'Start connecting with people you\'ve crossed paths with'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
