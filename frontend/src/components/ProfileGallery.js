import { useState, useEffect, useRef, useCallback } from 'react';
import { galleryApi, postsApi } from '../lib/api';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from './ui/select';
import { Image, Lock, Plus, Trash2, Loader2, Globe2, Users, Sparkles, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const PRIVACY_OPTIONS = [
    { value: 'public', label: 'Public — anyone can see', icon: Globe2 },
    { value: 'crossings', label: 'Crossings — people you crossed paths with', icon: Sparkles },
    { value: 'connections', label: 'Connections — only your accepted circle', icon: Users },
    { value: 'private', label: 'Private — only you', icon: EyeOff },
];

export default function ProfileGallery({ userId, isOwnProfile = false }) {
    const [albumPhotos, setAlbumPhotos] = useState([]);
    const [postPhotos, setPostPhotos] = useState([]);
    const [privacy, setPrivacy] = useState('public');
    const [locked, setLocked] = useState(false);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [savingPrivacy, setSavingPrivacy] = useState(false);
    const fileInputRef = useRef(null);

    const load = useCallback(async () => {
        if (!userId) return;
        try {
            const [galleryRes, postsRes] = await Promise.all([
                galleryApi.get(userId).catch((err) => ({ data: { photos: [], privacy: 'public', locked: false }, _err: err })),
                postsApi.getUserPosts(userId).catch(() => ({ data: [] })),
            ]);
            setAlbumPhotos(galleryRes.data?.photos || []);
            setPrivacy(galleryRes.data?.privacy || 'public');
            setLocked(Boolean(galleryRes.data?.locked));
            setPostPhotos(
                (postsRes.data || [])
                    .filter((p) => p.media_url && p.media_type === 'image')
                    .map((p) => ({
                        id: `post-${p.id}`,
                        url: p.media_url,
                        caption: p.caption,
                        created_at: p.created_at,
                    }))
            );
        } catch (err) {
            console.error('Gallery load failed', err);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        load();
    }, [load]);

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 8 * 1024 * 1024) {
            toast.error('Photo must be under 8 MB');
            return;
        }
        setUploading(true);
        try {
            const res = await galleryApi.upload(file);
            setAlbumPhotos((prev) => [res.data.photo, ...prev]);
            toast.success('Added to your album');
        } catch (err) {
            const detail = err?.response?.data?.detail || 'Upload failed';
            toast.error(detail);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDelete = async (photoId) => {
        if (!window.confirm('Delete this photo?')) return;
        try {
            await galleryApi.remove(photoId);
            setAlbumPhotos((prev) => prev.filter((p) => p.id !== photoId));
            toast.success('Photo deleted');
        } catch {
            toast.error('Failed to delete');
        }
    };

    const handlePrivacy = async (newPrivacy) => {
        setSavingPrivacy(true);
        try {
            await galleryApi.setPrivacy(newPrivacy);
            setPrivacy(newPrivacy);
            toast.success('Privacy updated');
        } catch {
            toast.error('Could not save privacy');
        } finally {
            setSavingPrivacy(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-10" data-testid="gallery-loading">
                <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
            </div>
        );
    }

    if (locked) {
        return (
            <div
                className="text-center py-12 border border-white/10 rounded-2xl bg-white/[0.02]"
                data-testid="gallery-locked"
            >
                <Lock className="w-8 h-8 text-amber-500 mx-auto mb-3" />
                <p className="text-white/80 font-medium mb-1">This gallery is private</p>
                <p className="text-sm text-white/50">
                    {privacy === 'crossings'
                        ? 'Visible only to people who have crossed paths with this user.'
                        : privacy === 'connections'
                          ? 'Visible only to their accepted Connections.'
                          : 'The owner has set their gallery to private.'}
                </p>
            </div>
        );
    }

    const hasAny = albumPhotos.length || postPhotos.length;

    return (
        <div data-testid="profile-gallery" className="space-y-4">
            {isOwnProfile ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.03] border border-white/10 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-sm text-white/70">
                        <Image className="w-4 h-4" />
                        <span>Gallery privacy</span>
                    </div>
                    <Select
                        value={privacy}
                        onValueChange={handlePrivacy}
                        disabled={savingPrivacy}
                    >
                        <SelectTrigger
                            className="w-full sm:w-[300px] bg-black/30 border-white/10"
                            data-testid="gallery-privacy-select"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PRIVACY_OPTIONS.map(({ value, label }) => (
                                <SelectItem
                                    key={value}
                                    value={value}
                                    data-testid={`gallery-privacy-${value}`}
                                >
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            ) : null}

            <Tabs defaultValue="albums" className="w-full">
                <TabsList className="bg-white/[0.04] border border-white/10">
                    <TabsTrigger value="albums" data-testid="gallery-tab-albums">
                        Albums ({albumPhotos.length})
                    </TabsTrigger>
                    <TabsTrigger value="posts" data-testid="gallery-tab-posts">
                        From Posts ({postPhotos.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="albums" className="mt-4">
                    {isOwnProfile ? (
                        <div className="mb-4">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleUpload}
                                className="hidden"
                                data-testid="gallery-file-input"
                            />
                            <Button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-95"
                                data-testid="gallery-upload-btn"
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Uploading…
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add a photo
                                    </>
                                )}
                            </Button>
                        </div>
                    ) : null}

                    {albumPhotos.length === 0 ? (
                        <EmptyState
                            text={
                                isOwnProfile
                                    ? 'No album photos yet — drop in your favorites.'
                                    : 'No album photos yet.'
                            }
                        />
                    ) : (
                        <PhotoGrid
                            photos={albumPhotos}
                            onDelete={isOwnProfile ? handleDelete : null}
                            testIdPrefix="album"
                        />
                    )}
                </TabsContent>

                <TabsContent value="posts" className="mt-4">
                    {postPhotos.length === 0 ? (
                        <EmptyState text="No post images yet." />
                    ) : (
                        <PhotoGrid photos={postPhotos} testIdPrefix="post-photo" />
                    )}
                </TabsContent>
            </Tabs>

            {!hasAny && !isOwnProfile ? (
                <p className="text-center text-xs text-white/40">
                    When this user adds photos, they'll show up here.
                </p>
            ) : null}
        </div>
    );
}

function PhotoGrid({ photos, onDelete, testIdPrefix }) {
    return (
        <div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2"
            data-testid={`${testIdPrefix}-grid`}
        >
            {photos.map((photo) => (
                <div
                    key={photo.id}
                    className="relative group aspect-square rounded-lg overflow-hidden bg-black/40 border border-white/5"
                    data-testid={`${testIdPrefix}-tile-${photo.id}`}
                >
                    <img
                        src={photo.url}
                        alt={photo.caption || 'gallery photo'}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {onDelete ? (
                        <button
                            onClick={() => onDelete(photo.id)}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid={`${testIdPrefix}-delete-${photo.id}`}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    ) : null}
                    {photo.caption ? (
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-xs text-white truncate">
                            {photo.caption}
                        </div>
                    ) : null}
                </div>
            ))}
        </div>
    );
}

function EmptyState({ text }) {
    return (
        <div
            className="text-center py-10 border border-dashed border-white/15 rounded-xl bg-white/[0.02]"
            data-testid="gallery-empty"
        >
            <Image className="w-7 h-7 text-white/30 mx-auto mb-2" />
            <p className="text-sm text-white/50">{text}</p>
        </div>
    );
}
