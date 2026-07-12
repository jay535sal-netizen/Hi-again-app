import { useState, useRef } from 'react';
import { Upload, Video, X, Loader2, CheckCircle, Play } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import api from '../lib/api';

// Same-origin if env URL points to a different origin than the page (avoids cross-origin CORS)
function resolveBackendUrl() {
    const envUrl = process.env.REACT_APP_BACKEND_URL || '';
    if (typeof window === 'undefined') return envUrl;
    try {
        if (!envUrl) return '';
        return new URL(envUrl).origin === window.location.origin ? envUrl : '';
    } catch { return envUrl; }
}
const BACKEND_URL = resolveBackendUrl();

export default function VideoUploader({ onVideoUploaded }) {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [uploadedVideo, setUploadedVideo] = useState(null);
    const fileInputRef = useRef(null);

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        const validTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
        if (!validTypes.includes(file.type)) {
            toast.error('Please select a valid video file (MP4, MOV, or WebM)');
            return;
        }

        // Validate file size (50MB max)
        if (file.size > 50 * 1024 * 1024) {
            toast.error('Video must be under 50MB');
            return;
        }

        setUploading(true);
        setProgress(0);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('media_type', 'promo');

            const response = await api.post('/media/upload', formData, {
                onUploadProgress: (progressEvent) => {
                    const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setProgress(percent);
                }
            });

            setUploadedVideo(response.data);
            toast.success('Video uploaded successfully!');
            
            if (onVideoUploaded) {
                onVideoUploaded(response.data);
            }
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="glass-card p-6" data-testid="video-uploader">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center">
                    <Video className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                    <h3 className="font-medium text-white">Upload Promo Video</h3>
                    <p className="text-sm text-slate-400">MP4, MOV, or WebM (max 50MB)</p>
                </div>
            </div>

            {!uploadedVideo ? (
                <>
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                            uploading 
                                ? 'border-rose-500 bg-rose-500/5' 
                                : 'border-slate-600 hover:border-rose-500 hover:bg-rose-500/5'
                        }`}
                    >
                        {uploading ? (
                            <div className="space-y-4">
                                <Loader2 className="w-10 h-10 text-rose-400 animate-spin mx-auto" />
                                <div>
                                    <p className="text-white mb-2">Uploading... {progress}%</p>
                                    <div className="w-full bg-slate-700 rounded-full h-2">
                                        <div 
                                            className="bg-gradient-to-r from-rose-500 to-amber-500 h-2 rounded-full transition-all"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                                <p className="text-slate-300 mb-1">Click to upload video</p>
                                <p className="text-slate-500 text-sm">or drag and drop</p>
                            </>
                        )}
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/mp4,video/quicktime,video/webm"
                        onChange={handleFileSelect}
                        className="hidden"
                        data-testid="video-input"
                    />
                </>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                        <CheckCircle className="w-6 h-6 text-emerald-400" />
                        <div className="flex-1">
                            <p className="text-white font-medium">Video uploaded!</p>
                            <p className="text-sm text-slate-400">
                                {(uploadedVideo.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                        </div>
                        <button
                            onClick={() => setUploadedVideo(null)}
                            className="p-2 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Video Preview */}
                    <div className="relative rounded-xl overflow-hidden bg-slate-900">
                        <video
                            src={`${BACKEND_URL}/api/media/${uploadedVideo.id}`}
                            className="w-full aspect-video object-cover"
                            controls
                            poster=""
                        />
                    </div>

                    <Button
                        onClick={() => {
                            setUploadedVideo(null);
                            fileInputRef.current?.click();
                        }}
                        variant="outline"
                        className="w-full border-slate-600 text-slate-300"
                    >
                        Upload Different Video
                    </Button>
                </div>
            )}
        </div>
    );
}
