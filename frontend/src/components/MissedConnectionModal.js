import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Heart, X, Loader2, Sparkles } from 'lucide-react';
import { locationsApi } from '../lib/api';
import { toast } from 'sonner';

export default function MissedConnectionModal({ open, onClose, onCreated }) {
    const today = new Date().toISOString().split('T')[0];
    const [city, setCity] = useState('');
    const [place, setPlace] = useState('');
    const [date, setDate] = useState(today);
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);

    if (!open) return null;

    const reset = () => {
        setCity(''); setPlace(''); setDate(today); setDescription('');
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!city.trim() || !place.trim() || !description.trim()) {
            toast.error('City, place, and a short description are required');
            return;
        }
        setSaving(true);
        try {
            // Persist as a tagged location with type=missed_connection in description prefix
            // (no separate table needed; backend already runs crossings detection on locations)
            await locationsApi.add({
                city: city.trim(),
                event_or_place: place.trim(),
                date,
                description: `[Missed Connection] ${description.trim()}`,
            });
            toast.success("Saved! We'll alert you if they sign up.");
            reset();
            onCreated?.();
            onClose?.();
        } catch (err) {
            const detail = err?.response?.data?.detail || 'Could not save — try again';
            toast.error(detail);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
            data-testid="missed-connection-modal"
        >
            <div className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-7">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-500 hover:text-slate-300"
                    aria-label="Close"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="text-center mb-5">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/15 flex items-center justify-center mb-3">
                        <Heart className="w-7 h-7 text-rose-400" />
                    </div>
                    <h2 className="font-heading text-xl text-white mb-1">Describe your missed connection</h2>
                    <p className="text-sm text-slate-400">
                        Tell us where & who. We'll alert you if they show up.
                    </p>
                </div>

                <form onSubmit={submit} className="space-y-4">
                    <div>
                        <Label htmlFor="mc-city" className="text-slate-300 text-sm">City</Label>
                        <Input
                            id="mc-city"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="San Diego"
                            className="input-dark mt-1"
                            data-testid="mc-city"
                            autoFocus
                        />
                    </div>
                    <div>
                        <Label htmlFor="mc-place" className="text-slate-300 text-sm">Where (event or place)</Label>
                        <Input
                            id="mc-place"
                            value={place}
                            onChange={(e) => setPlace(e.target.value)}
                            placeholder="The Casbah, Petco Park, etc."
                            className="input-dark mt-1"
                            data-testid="mc-place"
                        />
                    </div>
                    <div>
                        <Label htmlFor="mc-date" className="text-slate-300 text-sm">When</Label>
                        <Input
                            id="mc-date"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="input-dark mt-1"
                            data-testid="mc-date"
                        />
                    </div>
                    <div>
                        <Label htmlFor="mc-desc" className="text-slate-300 text-sm">Describe them</Label>
                        <Textarea
                            id="mc-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brunette, blue jacket, ordered an old fashioned..."
                            className="input-dark mt-1 min-h-[100px]"
                            data-testid="mc-desc"
                            maxLength={500}
                        />
                        <p className="text-xs text-slate-500 mt-1">{description.length}/500</p>
                    </div>

                    <Button
                        type="submit"
                        disabled={saving}
                        className="w-full btn-primary"
                        data-testid="mc-submit"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                            <>
                                <Sparkles className="w-4 h-4 mr-2" />
                                Save Missed Connection
                            </>
                        )}
                    </Button>
                </form>
            </div>
        </div>
    );
}
