import { useState, useEffect } from 'react';
import { crossingsApi, connectionsApi } from '../lib/api';
import CrossingCard from '../components/CrossingCard';
import { Input } from '../components/ui/input';
import { Loader2, Sparkles, Search, Filter, Share2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../components/ui/select';

export default function Crossings() {
    const [crossings, setCrossings] = useState([]);
    const [connections, setConnections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('recent');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [crossingsRes, connectionsRes] = await Promise.all([
                crossingsApi.getAll(),
                connectionsApi.getAll(),
            ]);
            setCrossings(crossingsRes.data);
            setConnections(connectionsRes.data);
        } catch (error) {
            toast.error('Failed to load crossings');
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = async (crossing) => {
        try {
            await connectionsApi.create({
                target_user_id: crossing.other_user_id,
                message: `We crossed paths at ${crossing.event_or_place} in ${crossing.city}!`,
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

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: 'Hi Again',
                text: 'Find people you\'ve crossed paths with! Join me on Hi Again.',
                url: 'https://hiagain.xyz',
            });
        } else {
            navigator.clipboard.writeText('https://hiagain.xyz');
            toast.success('Link copied! Share it with friends.');
        }
    };

    const filteredCrossings = crossings
        .filter(
            (c) =>
                c.other_user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.event_or_place?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (sortBy === 'recent') {
                return new Date(b.created_at) - new Date(a.created_at);
            } else if (sortBy === 'city') {
                return (a.city || '').localeCompare(b.city || '');
            } else if (sortBy === 'score') {
                // Sort by match score: high > medium > low
                const scoreOrder = { high: 3, medium: 2, low: 1 };
                return (scoreOrder[b.match_score] || 1) - (scoreOrder[a.match_score] || 1);
            }
            return 0;
        });

    if (loading) {
        return (
            <div className="min-h-screen bg-midnight flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-midnight pt-20 pb-12" data-testid="crossings-page">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="font-heading text-3xl font-light text-white mb-2">
                        Path Crossings
                    </h1>
                    <p className="text-slate-400">
                        {crossings.length} crossing{crossings.length !== 1 ? 's' : ''} discovered
                    </p>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                        <Input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by name, city, or event..."
                            className="input-dark pl-12"
                            data-testid="search-crossings"
                        />
                    </div>
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-full sm:w-48 bg-slate-950 border-slate-800 text-white" data-testid="sort-crossings">
                            <Filter className="w-4 h-4 mr-2 text-slate-500" />
                            <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800">
                            <SelectItem value="recent">Most Recent</SelectItem>
                            <SelectItem value="score">Best Match</SelectItem>
                            <SelectItem value="city">By City</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Crossings List */}
                {filteredCrossings.length > 0 ? (
                    <div className="grid gap-4">
                        {filteredCrossings.map((crossing) => (
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
                            {searchTerm ? 'No crossings found' : 'No path crossings yet'}
                        </h3>
                        <p className="text-slate-400 mb-6">
                            {searchTerm
                                ? 'Try a different search term'
                                : 'Add places you\'ve been and invite friends to find matches!'}
                        </p>
                        {!searchTerm && (
                            <div className="space-y-3">
                                <p className="text-sm text-slate-500">
                                    The more people using Hi Again, the more likely you'll match!
                                </p>
                                <Button
                                    onClick={handleShare}
                                    className="btn-primary"
                                >
                                    <Share2 className="w-4 h-4 mr-2" />
                                    Invite Friends
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
