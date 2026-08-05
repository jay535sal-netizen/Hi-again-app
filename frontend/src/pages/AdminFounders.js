import { useEffect, useState, useMemo, useCallback } from 'react';
import { Copy, Check, Users, Sparkles, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { foundersApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'redeemed', label: 'Redeemed' },
    { key: 'unclaimed', label: 'Unclaimed' },
];

/**
 * Admin-only dashboard for the Founders 60 program.
 * Renders every invite code with its share URL, redemption status,
 * and one-tap copy. Restricted to ADMIN_EMAILS on the backend.
 */
export default function AdminFounders() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [codes, setCodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [copiedCode, setCopiedCode] = useState(null);
    const [seeding, setSeeding] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await foundersApi.adminList();
            setCodes(res.data.codes || []);
        } catch (err) {
            console.error('founders list failed', err);
            if (err?.response?.status === 403) {
                toast.error('Admin access only');
                navigate('/dashboard');
            } else {
                toast.error('Could not load founder codes');
            }
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        if (user) load();
    }, [user, load]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return codes.filter((c) => {
            if (filter === 'redeemed' && !c.redeemed) return false;
            if (filter === 'unclaimed' && c.redeemed) return false;
            if (!q) return true;
            return (
                c.code.toLowerCase().includes(q) ||
                (c.redeemed_by_name || '').toLowerCase().includes(q) ||
                String(c.founder_number || '').includes(q)
            );
        });
    }, [codes, filter, search]);

    const stats = useMemo(() => {
        const total = codes.length;
        const redeemed = codes.filter((c) => c.redeemed).length;
        return { total, redeemed, remaining: total - redeemed };
    }, [codes]);

    const copyShareUrl = async (code, url) => {
        try {
            await navigator.clipboard.writeText(url);
            setCopiedCode(code);
            toast.success('Share link copied');
            setTimeout(() => setCopiedCode(null), 1600);
        } catch (e) {
            console.error('clipboard failed', e);
            toast.error('Copy failed — long-press the link instead');
        }
    };

    const handleSeed = async () => {
        if (seeding) return;
        setSeeding(true);
        try {
            const res = await foundersApi.adminSeed();
            toast.success(`Seeded ${res.data.created || 0} new codes`);
            await load();
        } catch (err) {
            const msg = err?.response?.data?.detail || 'Seed failed';
            toast.error(typeof msg === 'string' ? msg : 'Seed failed');
        } finally {
            setSeeding(false);
        }
    };

    return (
        <div
            className="max-w-4xl mx-auto px-4 py-8 pt-[calc(env(safe-area-inset-top,0px)+2rem)]"
            data-testid="admin-founders-page"
        >
            <div className="flex items-start justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-3xl text-white font-medium tracking-tight">Founders 60</h1>
                    <p className="text-sm text-white/60 mt-1">
                        {stats.redeemed} of {stats.total || 60} claimed · {stats.remaining} remaining
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={load}
                        disabled={loading}
                        data-testid="admin-founders-refresh"
                    >
                        <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    {stats.total < 60 && (
                        <Button
                            size="sm"
                            onClick={handleSeed}
                            disabled={seeding}
                            className="bg-gradient-to-r from-amber-500 to-orange-600"
                            data-testid="admin-founders-seed"
                        >
                            <Sparkles className="w-4 h-4 mr-1" />
                            {seeding ? 'Seeding…' : 'Seed codes'}
                        </Button>
                    )}
                </div>
            </div>

            {/* Progress bar */}
            <div className="mb-6" data-testid="admin-founders-progress">
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all"
                        style={{
                            width: `${Math.min(100, Math.round((stats.redeemed / Math.max(1, stats.total || 60)) * 100))}%`,
                        }}
                    />
                </div>
            </div>

            {/* Filters + search */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="flex gap-1 rounded-full bg-white/5 p-1">
                    {FILTERS.map((f) => (
                        <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            className={`px-4 py-1.5 rounded-full text-sm transition ${
                                filter === f.key
                                    ? 'bg-white text-slate-900 font-medium'
                                    : 'text-white/70 hover:text-white'
                            }`}
                            data-testid={`admin-founders-filter-${f.key}`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search code, name, or number"
                    className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                    data-testid="admin-founders-search"
                />
            </div>

            {/* Table / list */}
            {loading ? (
                <div className="text-center py-16 text-white/40">Loading…</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-white/40" data-testid="admin-founders-empty">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    No codes match this filter.
                </div>
            ) : (
                <div className="space-y-2" data-testid="admin-founders-list">
                    {filtered.map((c) => (
                        <div
                            key={c.code}
                            className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition"
                            data-testid={`admin-founders-row-${c.code}`}
                        >
                            {/* Number badge */}
                            <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-gradient-to-br from-amber-500/30 to-orange-600/30 border border-amber-500/30 flex items-center justify-center">
                                <span className="text-amber-300 font-medium text-sm">
                                    {c.founder_number ? `#${c.founder_number}` : '—'}
                                </span>
                            </div>
                            {/* Code + status */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-white text-sm">{c.code}</span>
                                    {c.redeemed ? (
                                        <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-300 rounded-full">
                                            REDEEMED
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-300 rounded-full">
                                            OPEN
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-white/50 truncate mt-0.5">
                                    {c.redeemed
                                        ? `claimed by ${c.redeemed_by_name || 'unknown'}`
                                        : c.share_url}
                                </p>
                            </div>
                            {/* Copy button */}
                            <button
                                onClick={() => copyShareUrl(c.code, c.share_url)}
                                className="flex-shrink-0 p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition"
                                aria-label="Copy share link"
                                data-testid={`admin-founders-copy-${c.code}`}
                            >
                                {copiedCode === c.code ? (
                                    <Check className="w-4 h-4 text-emerald-400" />
                                ) : (
                                    <Copy className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-8 text-xs text-white/40 text-center">
                <Link to="/founder-invite" className="hover:text-white/70 underline">
                    ← Back to founder invite
                </Link>
            </div>
        </div>
    );
}
