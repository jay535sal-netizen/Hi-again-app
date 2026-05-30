import { Share2, Copy, Users, Gift, MessageCircle, Mail } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { useState } from 'react';

const SHARE_URL = 'https://hiagain.xyz';
const SHARE_TEXT = "Find people you've crossed paths with! Join me on Hi Again - the app for real-world connections.";
const SHARE_TITLE = "Hi Again - Reconnect After The Moment Passes";

export default function ShareInvite({ variant = 'full', className = '' }) {
    const [showOptions, setShowOptions] = useState(false);

    // Build share URLs once. Used as <a href> for popup-blocker resilience.
    const SHARE_URLS = {
        whatsapp: `https://wa.me/?text=${encodeURIComponent(SHARE_TEXT)}%20${encodeURIComponent(SHARE_URL)}`,
        twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(SHARE_URL)}`,
        telegram: `https://t.me/share/url?url=${encodeURIComponent(SHARE_URL)}&text=${encodeURIComponent(SHARE_TEXT)}`,
        gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=&su=${encodeURIComponent(SHARE_TITLE)}&body=${encodeURIComponent(SHARE_TEXT)}%20${encodeURIComponent(SHARE_URL)}`,
        email: `mailto:?subject=${encodeURIComponent(SHARE_TITLE)}&body=${encodeURIComponent(SHARE_TEXT)}%20${encodeURIComponent(SHARE_URL)}`,
        sms: `sms:?body=${encodeURIComponent(SHARE_TEXT)}%20${encodeURIComponent(SHARE_URL)}`,
    };

    const handleNativeShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: SHARE_TITLE,
                    text: SHARE_TEXT,
                    url: SHARE_URL,
                });
                toast.success('Thanks for sharing!');
            } catch (err) {
                if (err.name !== 'AbortError') {
                    // User didn't cancel, show fallback
                    setShowOptions(true);
                }
            }
        } else {
            // No native share, show options
            setShowOptions(true);
        }
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(SHARE_URL);
            toast.success('Link copied to clipboard!');
            setShowOptions(false);
        } catch {
            toast.error('Failed to copy link');
        }
    };

    // Removed shareVia() — replaced with direct <a href> anchors below
    // for popup-blocker resilience.

    if (variant === 'button') {
        return (
            <Button
                onClick={handleNativeShare}
                className="btn-primary flex items-center gap-2"
                data-testid="share-button"
            >
                <Share2 className="w-4 h-4" />
                Invite Friends
            </Button>
        );
    }

    if (variant === 'floating') {
        return (
            <>
                <button
                    onClick={handleNativeShare}
                    className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 shadow-lg flex items-center justify-center text-white hover:scale-110 transition-transform"
                    data-testid="floating-share-button"
                >
                    <Share2 className="w-6 h-6" />
                </button>
                
                {showOptions && (
                    <ShareOptionsModal onClose={() => setShowOptions(false)} copyLink={copyLink} shareUrls={SHARE_URLS} />
                )}
            </>
        );
    }

    // Full card variant
    return (
        <div className={`glass-card p-6 ${className}`} data-testid="share-invite-card">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 flex items-center justify-center">
                    <Gift className="w-6 h-6 text-rose-400" />
                </div>
                <div>
                    <h3 className="font-heading text-lg text-white">Invite Friends</h3>
                    <p className="text-sm text-slate-400">Grow your network, find more connections</p>
                </div>
            </div>
            
            <p className="text-slate-300 text-sm mb-4">
                Share Hi Again with friends and discover who you've both crossed paths with!
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3">
                <Button
                    onClick={handleNativeShare}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                    data-testid="share-main-button"
                >
                    <Share2 className="w-4 h-4" />
                    Share Now
                </Button>
                <Button
                    onClick={copyLink}
                    variant="outline"
                    className="flex-1 flex items-center justify-center gap-2 border-slate-700 text-slate-300 hover:bg-slate-800"
                    data-testid="copy-link-button"
                >
                    <Copy className="w-4 h-4" />
                    Copy Link
                </Button>
            </div>
            
            {showOptions && (
                <ShareOptionsModal onClose={() => setShowOptions(false)} copyLink={copyLink} shareUrls={SHARE_URLS} />
            )}
        </div>
    );
}

function ShareOptionsModal({ onClose, copyLink, shareUrls }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div className="glass-card p-6 w-full max-w-sm" onClick={e => e.stopPropagation()} data-testid="share-options-modal">
                <h3 className="font-heading text-xl text-white mb-4 text-center">Share Hi Again</h3>
                
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <a href={shareUrls.whatsapp} target="_blank" rel="noopener noreferrer" onClick={onClose} className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-slate-800 transition-colors" data-testid="share-modal-whatsapp">
                        <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                            <MessageCircle className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xs text-slate-400">WhatsApp</span>
                    </a>
                    
                    <a href={shareUrls.twitter} target="_blank" rel="noopener noreferrer" onClick={onClose} className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-slate-800 transition-colors" data-testid="share-modal-twitter">
                        <div className="w-12 h-12 rounded-full bg-sky-500 flex items-center justify-center">
                            <span className="text-white font-bold text-lg">X</span>
                        </div>
                        <span className="text-xs text-slate-400">Twitter</span>
                    </a>
                    
                    <a href={shareUrls.telegram} target="_blank" rel="noopener noreferrer" onClick={onClose} className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-slate-800 transition-colors" data-testid="share-modal-telegram">
                        <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center">
                            <MessageCircle className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xs text-slate-400">Telegram</span>
                    </a>
                    
                    <a href={shareUrls.gmail} target="_blank" rel="noopener noreferrer" onClick={onClose} className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-slate-800 transition-colors" data-testid="share-modal-gmail">
                        <div className="w-12 h-12 rounded-full bg-rose-500 flex items-center justify-center">
                            <Mail className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xs text-slate-400">Gmail</span>
                    </a>

                    <a href={shareUrls.email} onClick={onClose} className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-slate-800 transition-colors" data-testid="share-modal-email">
                        <div className="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center">
                            <Mail className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xs text-slate-400">Email app</span>
                    </a>

                    <a href={shareUrls.sms} onClick={onClose} className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-slate-800 transition-colors" data-testid="share-modal-sms">
                        <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center">
                            <MessageCircle className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xs text-slate-400">SMS</span>
                    </a>
                </div>
                
                <button
                    onClick={copyLink}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                >
                    <Copy className="w-5 h-5" />
                    Copy Link
                </button>
                
                <button
                    onClick={onClose}
                    className="w-full mt-3 p-2 text-slate-400 hover:text-white text-sm transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
