import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { postsApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
    Heart, 
    MessageCircle, 
    Send, 
    Image, 
    Video, 
    X, 
    Loader2, 
    MapPin,
    MoreHorizontal,
    Trash2,
    Flag,
    UserX,
    Compass,
    Users,
    Plus,
    Play,
    Pause,
    BadgeCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

export default function Feed() {
    const { user } = useAuth();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('explore'); // 'explore' (public feed) or 'feed' (your crossings)
    const [cityFilter, setCityFilter] = useState(null); // null = all cities
    const [nearMe, setNearMe] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedPost, setSelectedPost] = useState(null);
    
    const fetchPosts = useCallback(async () => {
        setLoading(true);
        try {
            let response;
            if (activeTab === 'feed') {
                response = await postsApi.getFeed();
            } else if (nearMe) {
                response = await postsApi.getExplore(null, true);
            } else {
                response = await postsApi.getExplore(cityFilter);
            }
            setPosts(response.data);
        } catch (error) {
            toast.error('Failed to load feed');
        } finally {
            setLoading(false);
        }
    }, [activeTab, cityFilter, nearMe]);

    // Derive city chips sorted by post count (most populated first).
    const cityOptions = useMemo(() => {
        const counts = new Map();
        for (const p of posts) {
            const loc = (p.location || '').trim();
            if (!loc) continue;
            const parts = loc.split(',').map((s) => s.trim()).filter(Boolean);
            const candidate = parts.length > 1 ? parts[parts.length - 1] : parts[0];
            if (candidate && candidate.length <= 30) {
                counts.set(candidate, (counts.get(candidate) || 0) + 1);
            }
        }
        // Ensure the user's home city always appears (even if zero posts)
        if (user?.city && !counts.has(user.city)) counts.set(user.city, 0);
        return Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .slice(0, 8)
            .map(([name]) => name);
    }, [user, posts]);
    
    useEffect(() => {
        fetchPosts();
    }, [fetchPosts]);
    
    const handleLike = async (postId) => {
        try {
            const response = await postsApi.like(postId);
            setPosts(posts.map(post => 
                post.id === postId 
                    ? { 
                        ...post, 
                        liked_by_me: response.data.action === 'liked',
                        likes_count: response.data.likes_count 
                    }
                    : post
            ));
        } catch (error) {
            toast.error('Failed to like post');
        }
    };
    
    const handleDelete = async (postId) => {
        try {
            await postsApi.delete(postId);
            setPosts(posts.filter(post => post.id !== postId));
            toast.success('Post deleted');
        } catch (error) {
            toast.error('Failed to delete post');
        }
    };

    const handleReport = async (postId) => {
        try {
            await postsApi.report(postId, 'Inappropriate content');
            toast.success("Thanks — we'll review this post");
        } catch {
            toast.error('Could not submit report');
        }
    };

    const handleBlock = async (userId, userName) => {
        if (!window.confirm(`Block ${userName}? You won't see their posts or be matched with them.`)) return;
        try {
            await postsApi.block(userId);
            setPosts((prev) => prev.filter((p) => p.user_id !== userId));
            toast.success(`${userName} blocked`);
        } catch {
            toast.error('Could not block user');
        }
    };
    
    const handlePostCreated = (newPost) => {
        setPosts([newPost, ...posts]);
        setShowCreateModal(false);
    };
    
    return (
        <div className="min-h-screen bg-midnight pt-16" data-testid="feed-page">
            {/* Header */}
            <div className="sticky top-16 z-40 bg-midnight/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-2xl mx-auto px-4">
                    <div className="flex items-center justify-between py-4">
                        {/* Tabs */}
                        <div className="flex gap-1 bg-slate-800/50 rounded-full p-1">
                            <button
                                onClick={() => setActiveTab('explore')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                                    activeTab === 'explore' 
                                        ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white' 
                                        : 'text-slate-400 hover:text-white'
                                }`}
                                data-testid="explore-tab"
                            >
                                <Compass className="w-4 h-4" />
                                Public
                            </button>
                            <button
                                onClick={() => setActiveTab('feed')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                                    activeTab === 'feed' 
                                        ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white' 
                                        : 'text-slate-400 hover:text-white'
                                }`}
                                data-testid="feed-tab"
                            >
                                <Users className="w-4 h-4" />
                                My Crossings
                            </button>
                        </div>
                        
                        {/* Create Post Button */}
                        <Button
                            onClick={() => setShowCreateModal(true)}
                            className="btn-primary flex items-center gap-2"
                            data-testid="create-post-btn"
                        >
                            <Plus className="w-4 h-4" />
                            Post
                        </Button>
                    </div>

                    {/* City filter chips — only on Public tab */}
                    {activeTab === 'explore' && cityOptions.length > 0 ? (
                        <div className="overflow-x-auto -mx-4 px-4 pb-3" data-testid="city-filter-row">
                            <div className="flex gap-2 min-w-max">
                                <CityChip
                                    label="All"
                                    active={!cityFilter && !nearMe}
                                    onClick={() => { setCityFilter(null); setNearMe(false); }}
                                />
                                <CityChip
                                    label="📍 Near me"
                                    active={nearMe}
                                    onClick={() => { setNearMe(!nearMe); setCityFilter(null); }}
                                />
                                {cityOptions.map((c) => (
                                    <CityChip
                                        key={c}
                                        label={c}
                                        active={cityFilter === c}
                                        onClick={() => {
                                            setNearMe(false);
                                            setCityFilter(cityFilter === c ? null : c);
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
            
            {/* Feed Content */}
            <div className="max-w-2xl mx-auto px-4 py-6">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
                    </div>
                ) : posts.length === 0 ? (
                    <EmptyState activeTab={activeTab} onCreatePost={() => setShowCreateModal(true)} />
                ) : (
                    <div className="space-y-6">
                        {posts.map(post => (
                            <PostCard 
                                key={post.id} 
                                post={post} 
                                currentUserId={user?.id}
                                onLike={handleLike}
                                onDelete={handleDelete}
                                onReport={handleReport}
                                onBlock={handleBlock}
                                onViewComments={() => setSelectedPost(post)}
                            />
                        ))}
                    </div>
                )}
            </div>
            
            {/* Create Post Modal */}
            {showCreateModal && (
                <CreatePostModal 
                    onClose={() => setShowCreateModal(false)}
                    onPostCreated={handlePostCreated}
                />
            )}
            
            {/* Comments Modal */}
            {selectedPost && (
                <CommentsModal 
                    post={selectedPost}
                    onClose={() => setSelectedPost(null)}
                    onPostUpdate={(updatedPost) => {
                        setPosts(posts.map(p => p.id === updatedPost.id ? updatedPost : p));
                        setSelectedPost(updatedPost);
                    }}
                />
            )}
        </div>
    );
}

// Post Card Component
function CityChip({ label, active, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                active
                    ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white border-transparent'
                    : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-700/60'
            }`}
            data-testid={`city-chip-${label.toLowerCase().replace(/\s+/g, '-')}`}
        >
            {label}
        </button>
    );
}


function PostMenu({ post, isOwner, showMenu, setShowMenu, onDelete, onReport, onBlock }) {
    const close = () => setShowMenu(false);
    return (
        <div className="relative">
            <button 
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 text-slate-400 hover:text-white transition-colors"
                data-testid={`post-menu-${post.id}`}
            >
                <MoreHorizontal className="w-5 h-5" />
            </button>
            {showMenu && (
                <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-10 min-w-[160px]">
                    {isOwner ? (
                        <button
                            onClick={() => { onDelete(post.id); close(); }}
                            className="flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-slate-700 w-full text-left text-sm"
                            data-testid={`delete-post-${post.id}`}
                        >
                            <Trash2 className="w-4 h-4" /> Delete
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => { onReport(post.id); close(); }}
                                className="flex items-center gap-2 px-4 py-2 text-amber-300 hover:bg-slate-700 w-full text-left text-sm"
                                data-testid={`report-post-${post.id}`}
                            >
                                <Flag className="w-4 h-4" /> Report post
                            </button>
                            <button
                                onClick={() => { onBlock(post.user_id, post.user_name); close(); }}
                                className="flex items-center gap-2 px-4 py-2 text-rose-400 hover:bg-slate-700 w-full text-left text-sm"
                                data-testid={`block-user-${post.user_id}`}
                            >
                                <UserX className="w-4 h-4" /> Block {post.user_name?.split(' ')[0]}
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function PostCard({ post, currentUserId, onLike, onDelete, onReport, onBlock, onViewComments }) {
    const [showMenu, setShowMenu] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const videoRef = useRef(null);
    const isOwner = post.user_id === currentUserId;
    
    const toggleVideo = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };
    
    const timeAgo = post.created_at 
        ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
        : '';
    
    return (
        <div className="glass-card overflow-hidden" data-testid={`post-${post.id}`}>
            {/* Post Header */}
            <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-amber-500 overflow-hidden">
                        {post.user_photo ? (
                            <img 
                                src={post.user_photo} 
                                alt={post.user_name}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white font-medium">
                                {post.user_name?.[0]?.toUpperCase() || '?'}
                            </div>
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <span className="font-medium text-white">{post.user_name}</span>
                            {post.is_premium && (
                                <BadgeCheck className="w-4 h-4 text-rose-500" />
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>{timeAgo}</span>
                            {post.location && (
                                <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                        <MapPin className="w-3 h-3" />
                                        {post.location}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Post menu: owner gets Delete, others get Report + Block */}
                <PostMenu
                    post={post}
                    isOwner={isOwner}
                    showMenu={showMenu}
                    setShowMenu={setShowMenu}
                    onDelete={onDelete}
                    onReport={onReport}
                    onBlock={onBlock}
                />
            </div>
            
            {/* Media */}
            <div className="relative aspect-square bg-slate-900">
                {post.media_type === 'video' ? (
                    <>
                        <video
                            ref={videoRef}
                            src={post.media_url}
                            className="w-full h-full object-cover"
                            loop
                            playsInline
                            onClick={toggleVideo}
                        />
                        <button 
                            onClick={toggleVideo}
                            className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity"
                        >
                            {isPlaying ? (
                                <Pause className="w-16 h-16 text-white/80" />
                            ) : (
                                <Play className="w-16 h-16 text-white/80" />
                            )}
                        </button>
                    </>
                ) : (
                    <img 
                        src={post.media_url} 
                        alt="Post"
                        className="w-full h-full object-cover"
                    />
                )}
            </div>
            
            {/* Actions */}
            <div className="p-4">
                <div className="flex items-center gap-4 mb-3">
                    <button 
                        onClick={() => onLike(post.id)}
                        className="flex items-center gap-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                        data-testid={`like-btn-${post.id}`}
                    >
                        <Heart 
                            className={`w-6 h-6 ${post.liked_by_me ? 'fill-rose-500 text-rose-500' : ''}`} 
                        />
                        <span className={`text-sm ${post.liked_by_me ? 'text-rose-500' : ''}`}>
                            {post.likes_count || 0}
                        </span>
                    </button>
                    <button 
                        onClick={onViewComments}
                        className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
                        data-testid={`comment-btn-${post.id}`}
                    >
                        <MessageCircle className="w-6 h-6" />
                        <span className="text-sm">{post.comments_count || 0}</span>
                    </button>
                </div>
                
                {/* Caption */}
                {post.caption && (
                    <p className="text-slate-200">
                        <span className="font-medium text-white mr-2">{post.user_name}</span>
                        {post.caption}
                    </p>
                )}
                
                {/* View comments link */}
                {post.comments_count > 0 && (
                    <button 
                        onClick={onViewComments}
                        className="text-sm text-slate-500 mt-2 hover:text-slate-400 transition-colors"
                    >
                        View all {post.comments_count} comments
                    </button>
                )}
            </div>
        </div>
    );
}

// Create Post Modal
function CreatePostModal({ onClose, onPostCreated }) {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [caption, setCaption] = useState('');
    const [location, setLocation] = useState('');
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef(null);
    
    const handleFileSelect = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setPreview(URL.createObjectURL(selectedFile));
        }
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) {
            toast.error('Please select a photo or video');
            return;
        }
        
        // Check file size (10MB limit)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            toast.error('File too large. Maximum size is 10MB.');
            return;
        }
        
        setLoading(true);
        try {
            const response = await postsApi.create(file, caption, location);
            toast.success('Post created!');
            onPostCreated(response.data);
        } catch (error) {
            const message = error.response?.data?.detail || 'Failed to create post. Please try again.';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };
    
    const isVideo = file?.type?.startsWith('video');
    
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto" data-testid="create-post-modal">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h2 className="text-lg font-medium text-white">Create Post</h2>
                    <button 
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {/* File Upload */}
                    {!preview ? (
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center cursor-pointer hover:border-rose-500 transition-colors"
                        >
                            <div className="flex justify-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-full bg-rose-500/20 flex items-center justify-center">
                                    <Image className="w-6 h-6 text-rose-500" />
                                </div>
                                <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                                    <Video className="w-6 h-6 text-amber-500" />
                                </div>
                            </div>
                            <p className="text-slate-300 mb-1">Click to upload photo or video</p>
                            <p className="text-slate-500 text-sm">JPG, PNG, MP4, MOV up to 50MB</p>
                        </div>
                    ) : (
                        <div className="relative rounded-xl overflow-hidden">
                            {isVideo ? (
                                <video 
                                    src={preview} 
                                    className="w-full aspect-square object-cover"
                                    controls
                                />
                            ) : (
                                <img 
                                    src={preview} 
                                    alt="Preview"
                                    className="w-full aspect-square object-cover"
                                />
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    setFile(null);
                                    setPreview(null);
                                }}
                                className="absolute top-2 right-2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        data-testid="file-input"
                    />
                    
                    {/* Caption */}
                    <div>
                        <textarea
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            placeholder="Write a caption..."
                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-500 resize-none focus:outline-none focus:border-rose-500"
                            rows={3}
                            data-testid="caption-input"
                        />
                    </div>
                    
                    {/* Location */}
                    <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                        <Input
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="Add location"
                            className="input-dark pl-10"
                            data-testid="location-input"
                        />
                    </div>
                    
                    {/* Submit */}
                    <Button
                        type="submit"
                        disabled={!file || loading}
                        className="w-full btn-primary"
                        data-testid="submit-post-btn"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Posting...
                            </>
                        ) : (
                            'Share Post'
                        )}
                    </Button>
                </form>
            </div>
        </div>
    );
}

// Comments Modal
function CommentsModal({ post, onClose, onPostUpdate }) {
    const { user } = useAuth();
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [posting, setPosting] = useState(false);
    
    const fetchComments = useCallback(async () => {
        try {
            const response = await postsApi.getComments(post.id);
            setComments(response.data);
        } catch (error) {
            toast.error('Failed to load comments');
        } finally {
            setLoading(false);
        }
    }, [post.id]);
    
    useEffect(() => {
        fetchComments();
    }, [fetchComments]);
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        
        setPosting(true);
        try {
            const response = await postsApi.addComment(post.id, newComment);
            setComments([response.data, ...comments]);
            setNewComment('');
            onPostUpdate({ ...post, comments_count: post.comments_count + 1 });
        } catch (error) {
            toast.error('Failed to post comment');
        } finally {
            setPosting(false);
        }
    };
    
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="glass-card w-full max-w-lg max-h-[80vh] flex flex-col" data-testid="comments-modal">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h2 className="text-lg font-medium text-white">Comments</h2>
                    <button 
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                {/* Comments List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 text-rose-500 animate-spin" />
                        </div>
                    ) : comments.length === 0 ? (
                        <div className="text-center py-8">
                            <MessageCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-400">No comments yet</p>
                            <p className="text-slate-500 text-sm">Be the first to comment!</p>
                        </div>
                    ) : (
                        comments.map(comment => (
                            <div key={comment.id} className="flex gap-3" data-testid={`comment-${comment.id}`}>
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-amber-500 flex-shrink-0 overflow-hidden">
                                    {comment.user_photo ? (
                                        <img 
                                            src={comment.user_photo} 
                                            alt={comment.user_name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-white text-xs font-medium">
                                            {comment.user_name?.[0]?.toUpperCase() || '?'}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <p className="text-slate-200">
                                        <span className="font-medium text-white mr-2">{comment.user_name}</span>
                                        {comment.text}
                                    </p>
                                    <span className="text-xs text-slate-500">
                                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                
                {/* Comment Input */}
                <form onSubmit={handleSubmit} className="p-4 border-t border-white/10">
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-amber-500 flex-shrink-0 overflow-hidden">
                            {user?.photo_url ? (
                                <img 
                                    src={user.photo_url} 
                                    alt={user.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-white text-xs font-medium">
                                    {user?.name?.[0]?.toUpperCase() || '?'}
                                </div>
                            )}
                        </div>
                        <div className="flex-1 flex gap-2">
                            <Input
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Add a comment..."
                                className="input-dark flex-1"
                                data-testid="comment-input"
                            />
                            <Button 
                                type="submit" 
                                disabled={!newComment.trim() || posting}
                                className="btn-primary px-3"
                                data-testid="submit-comment-btn"
                            >
                                {posting ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Send className="w-5 h-5" />
                                )}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Empty State
function EmptyState({ activeTab, onCreatePost }) {
    return (
        <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-500/20 to-amber-500/20 flex items-center justify-center mx-auto mb-6">
                {activeTab === 'feed' ? (
                    <Users className="w-10 h-10 text-rose-400" />
                ) : (
                    <Compass className="w-10 h-10 text-amber-400" />
                )}
            </div>
            <h3 className="text-xl font-medium text-white mb-2">
                {activeTab === 'feed' ? 'No posts from your people yet' : 'No posts to explore'}
            </h3>
            <p className="text-slate-400 mb-6 max-w-sm mx-auto">
                {activeTab === 'feed' 
                    ? 'When people you\'ve crossed paths with share moments, they\'ll appear here.'
                    : 'Be the first to share something amazing!'}
            </p>
            <Button onClick={onCreatePost} className="btn-primary" data-testid="empty-create-post-btn">
                <Plus className="w-4 h-4 mr-2" />
                Create First Post
            </Button>
        </div>
    );
}
