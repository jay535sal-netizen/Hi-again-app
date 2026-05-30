import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchApi } from '../lib/api';
import { Search, X, Loader2, Crown, MapPin } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { getInitials } from '../lib/utils';

// Quick navbar search — debounced 250ms, popover with avatars + names.
// Click result → /user/:id. Esc / outside click closes the popover.
export default function UserSearch({ compact = false }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const navigate = useNavigate();

    // Debounced fetch
    useEffect(() => {
        const trimmed = query.trim();
        if (trimmed.length < 2) {
            setResults([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        const handle = setTimeout(async () => {
            try {
                const res = await searchApi.users(trimmed);
                setResults(res.data || []);
                setActiveIndex(-1);
            } catch (err) {
                console.error('Search failed:', err);
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 250);
        return () => clearTimeout(handle);
    }, [query]);

    // Close on outside click
    useEffect(() => {
        const onDocClick = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, []);

    const goToUser = useCallback((userId) => {
        setOpen(false);
        setQuery('');
        setResults([]);
        navigate(`/user/${userId}`);
    }, [navigate]);

    const handleKey = (e) => {
        if (!open) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => Math.min(results.length - 1, i + 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(-1, i - 1));
        } else if (e.key === 'Enter' && activeIndex >= 0 && results[activeIndex]) {
            goToUser(results[activeIndex].user_id);
        } else if (e.key === 'Escape') {
            setOpen(false);
            inputRef.current?.blur();
        }
    };

    const showPopover = open && (loading || results.length > 0 || query.trim().length >= 2);

    return (
        <div
            ref={containerRef}
            className={`relative ${compact ? 'w-full' : 'w-72'}`}
            data-testid="user-search"
        >
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    placeholder="Search people…"
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setOpen(true)}
                    onKeyDown={handleKey}
                    className="w-full pl-9 pr-9 py-2 rounded-full bg-slate-800/60 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition"
                    data-testid="user-search-input"
                />
                {query ? (
                    <button
                        type="button"
                        onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-700"
                        data-testid="user-search-clear"
                        aria-label="Clear search"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                ) : null}
            </div>

            {showPopover ? (
                <div
                    className="absolute z-50 left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
                    data-testid="user-search-popover"
                >
                    {loading ? (
                        <div className="px-4 py-6 flex items-center justify-center gap-2 text-sm text-slate-400">
                            <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                            Searching…
                        </div>
                    ) : results.length === 0 ? (
                        <div
                            className="px-4 py-6 text-center text-sm text-slate-400"
                            data-testid="user-search-empty"
                        >
                            No people match <span className="text-white">"{query}"</span>
                        </div>
                    ) : (
                        <ul className="max-h-80 overflow-auto">
                            {results.map((r, i) => (
                                <li key={r.user_id}>
                                    <button
                                        type="button"
                                        onClick={() => goToUser(r.user_id)}
                                        onMouseEnter={() => setActiveIndex(i)}
                                        className={`w-full text-left flex items-center gap-3 px-3 py-2.5 transition-colors ${
                                            activeIndex === i ? 'bg-slate-800' : 'hover:bg-slate-800/60'
                                        }`}
                                        data-testid={`user-search-result-${r.user_id}`}
                                    >
                                        <Avatar className="w-9 h-9 ring-1 ring-amber-500/20">
                                            {r.photo_url ? <AvatarImage src={r.photo_url} alt={r.name} /> : null}
                                            <AvatarFallback className="bg-amber-500/20 text-amber-200 text-xs font-semibold">
                                                {getInitials(r.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-sm font-medium text-white truncate">
                                                    {r.name}
                                                </span>
                                                {r.is_premium ? (
                                                    <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                                                ) : null}
                                            </div>
                                            {r.city ? (
                                                <div className="flex items-center gap-1 text-xs text-slate-400 truncate">
                                                    <MapPin className="w-3 h-3" /> {r.city}
                                                </div>
                                            ) : null}
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            ) : null}
        </div>
    );
}
