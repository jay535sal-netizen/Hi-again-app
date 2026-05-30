import { useState, useRef } from 'react';
import { Button } from './ui/button';
import {
    Upload, FileJson, Loader2, CheckCircle, AlertCircle,
    ExternalLink, ChevronDown, ChevronUp, MapPin, Activity, X
} from 'lucide-react';
import { locationsApi } from '../lib/api';
import { toast } from 'sonner';

const TAKEOUT_STEPS = [
    'Go to takeout.google.com (sign in with the Google account that has your Maps history).',
    'Click "Deselect all", then scroll down and check ONLY "Location History (Timeline)".',
    'Scroll to the bottom and click "Next step".',
    'Choose "Send download link via email", file type ".zip", and click "Create export".',
    'Wait for the email (a few minutes to a few hours), download the .zip and unzip it.',
    'Inside, find a JSON file (often "Records.json" or files inside "Semantic Location History/<year>/").',
    'Drag that JSON file into the upload zone above. Done!',
];

export default function TimelineImport({ onImported }) {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [showGuide, setShowGuide] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef(null);

    const accept = (chosen) => {
        if (!chosen) return;
        if (!chosen.name.toLowerCase().endsWith('.json')) {
            setError('Please select a .json file (Records.json or a Semantic Location History file)');
            return;
        }
        const SIZE_CAP_MB = 80;
        if (chosen.size > SIZE_CAP_MB * 1024 * 1024) {
            setError(`File too large (>${SIZE_CAP_MB}MB). Try a smaller date range or a single year file.`);
            return;
        }
        setError(null);
        setResult(null);
        setFile(chosen);
    };

    const reset = () => {
        setFile(null);
        setProgress(0);
        setResult(null);
        setError(null);
        if (inputRef.current) inputRef.current.value = '';
    };

    const onDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        accept(f);
    };

    const upload = async () => {
        if (!file) return;
        setUploading(true);
        setProgress(0);
        setError(null);
        try {
            const res = await locationsApi.importTimeline(file, (e) => {
                if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
            });
            const count = res?.data?.count ?? 0;
            setResult({ count });
            toast.success(`Imported ${count} place${count === 1 ? '' : 's'} from your Timeline`);
            if (onImported) onImported(count);
        } catch (err) {
            const msg = err?.response?.data?.detail || err?.message || 'Import failed';
            setError(msg);
            toast.error(msg);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div
            className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur p-5 sm:p-6"
            data-testid="timeline-import"
        >
            <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                    <Activity className="w-5 h-5 text-amber-400" />
                </div>
                <div className="min-w-0">
                    <h3 className="font-heading text-lg text-white">Import your Google Timeline</h3>
                    <p className="text-sm text-slate-400">
                        Have a <span className="text-amber-300">Google Takeout</span> JSON of your Location History? Drop it in to back-fill years of crossings.
                    </p>
                </div>
            </div>

            {/* Drop zone */}
            <label
                htmlFor="timeline-file-input"
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`block cursor-pointer rounded-xl border-2 border-dashed transition-colors p-6 text-center ${
                    dragOver
                        ? 'border-amber-400 bg-amber-500/5'
                        : 'border-slate-700 hover:border-slate-600 bg-slate-950/30'
                }`}
                data-testid="timeline-dropzone"
            >
                <input
                    ref={inputRef}
                    id="timeline-file-input"
                    type="file"
                    accept=".json,application/json"
                    className="sr-only"
                    onChange={(e) => accept(e.target.files?.[0])}
                    data-testid="timeline-file-input"
                />
                {!file ? (
                    <>
                        <Upload className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                        <p className="text-slate-300 font-medium">Drop your <span className="text-amber-300">Records.json</span> here</p>
                        <p className="text-sm text-slate-500 mt-1">or click to browse</p>
                    </>
                ) : (
                    <div className="flex items-center justify-center gap-3">
                        <FileJson className="w-7 h-7 text-amber-400 flex-shrink-0" />
                        <div className="text-left min-w-0">
                            <p className="text-white text-sm truncate max-w-[16rem]">{file.name}</p>
                            <p className="text-slate-500 text-xs">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
                        </div>
                        {!uploading && (
                            <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); reset(); }}
                                className="text-slate-500 hover:text-slate-300 ml-1"
                                aria-label="Remove file"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}
            </label>

            {/* Progress / Result / Error */}
            {uploading && (
                <div className="mt-4">
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-amber-400 to-rose-400 transition-all"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Uploading… {progress}% (parsing happens server-side; large files take a moment)
                    </p>
                </div>
            )}

            {result && (
                <div className="mt-4 flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-200" data-testid="timeline-import-success">
                    <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <p className="text-sm">
                        Imported <span className="font-semibold text-emerald-300">{result.count}</span> place visits. Crossings are being detected — check back in a moment.
                    </p>
                </div>
            )}

            {error && (
                <div className="mt-4 flex items-center gap-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-200">
                    <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                </div>
            )}

            {/* Action row */}
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <Button
                    type="button"
                    onClick={upload}
                    disabled={!file || uploading || !!result}
                    className="btn-primary"
                    data-testid="timeline-import-btn"
                >
                    {uploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : result ? (
                        <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Imported
                        </>
                    ) : (
                        <>
                            <Upload className="w-4 h-4 mr-2" />
                            Import
                        </>
                    )}
                </Button>
                <a
                    href="https://takeout.google.com/settings/takeout/custom/location_history"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center text-sm text-amber-300 hover:text-amber-200 px-3 py-2"
                >
                    Open Google Takeout <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                </a>
            </div>

            {/* Step-by-step guide */}
            <button
                type="button"
                onClick={() => setShowGuide((s) => !s)}
                className="mt-5 flex items-center gap-2 text-sm text-slate-400 hover:text-white"
                data-testid="timeline-guide-toggle"
            >
                {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                How do I get my Timeline JSON?
            </button>
            {showGuide && (
                <ol className="mt-3 space-y-2 list-decimal list-inside text-sm text-slate-300 leading-relaxed pl-1">
                    {TAKEOUT_STEPS.map((step) => (
                        <li key={step}><span className="text-slate-400">{step}</span></li>
                    ))}
                </ol>
            )}

            {/* GPS path callout */}
            <div className="mt-5 p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 flex items-start gap-3">
                <MapPin className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-400 leading-relaxed">
                    <span className="text-slate-200 font-medium">Don't have a Takeout export?</span>{' '}
                    Google retired most JSON exports in 2024. Use <span className="text-rose-300">GPS auto-tracking</span> on your dashboard
                    — Hi Again will build your timeline going forward, no Google needed.
                </p>
            </div>
        </div>
    );
}
