import { useState, useEffect } from 'react';
import { emailPrefsApi } from '../lib/api';
import { Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const ROWS = [
    {
        key: 'crossings',
        title: 'Crossing notifications',
        desc: 'Email me when I cross paths with someone (max 3 per day, 24h cooldown per person).',
    },
    {
        key: 'marketing',
        title: 'Tips & updates',
        desc: 'Occasional product tips, new features, and the welcome email.',
    },
];

export default function EmailPreferences() {
    const [prefs, setPrefs] = useState({ crossings: true, marketing: true, welcome: true });
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState(null);

    useEffect(() => {
        let alive = true;
        emailPrefsApi
            .get()
            .then((res) => alive && setPrefs(res.data))
            .catch((err) => console.error('Failed to load email prefs:', err))
            .finally(() => alive && setLoading(false));
        return () => {
            alive = false;
        };
    }, []);

    const toggle = async (key) => {
        const next = !prefs[key];
        setSavingKey(key);
        try {
            const res = await emailPrefsApi.update({ [key]: next });
            setPrefs(res.data);
            toast.success(next ? 'Subscribed' : 'Unsubscribed');
        } catch {
            toast.error('Could not update preference');
        } finally {
            setSavingKey(null);
        }
    };

    return (
        <div data-testid="email-prefs" className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center">
                    <Mail className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 text-lg">Email preferences</h3>
                    <p className="text-sm text-slate-500">Choose what lands in your inbox.</p>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-8" data-testid="email-prefs-loading">
                    <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                </div>
            ) : (
                <ul className="divide-y divide-slate-100">
                    {ROWS.map(({ key, title, desc }) => {
                        const enabled = Boolean(prefs[key]);
                        const isSaving = savingKey === key;
                        return (
                            <li
                                key={key}
                                className="flex items-start justify-between gap-4 py-3"
                                data-testid={`email-prefs-row-${key}`}
                            >
                                <div className="min-w-0">
                                    <p className="font-medium text-slate-800">{title}</p>
                                    <p className="text-sm text-slate-500">{desc}</p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={enabled}
                                    aria-label={`Toggle ${title}`}
                                    disabled={isSaving}
                                    onClick={() => toggle(key)}
                                    data-testid={`email-prefs-toggle-${key}`}
                                    className={`shrink-0 mt-1 w-12 h-7 rounded-full transition-colors disabled:opacity-50 ${
                                        enabled ? 'bg-amber-500' : 'bg-slate-300'
                                    }`}
                                >
                                    <div
                                        className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                                            enabled ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
            <p className="text-xs text-slate-400 mt-2">
                Verification & security emails are always sent regardless of these settings.
            </p>
        </div>
    );
}
