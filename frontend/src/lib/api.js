import axios from 'axios';
import { Capacitor } from '@capacitor/core';

const IS_NATIVE = Capacitor?.isNativePlatform?.() === true;

// Smart backend URL: if the build-time REACT_APP_BACKEND_URL points to a different
// origin than the page is actually being served from, fall back to same-origin
// (empty prefix). This sidesteps cross-origin CORS+credentials conflicts that
// happen when production deploys bake in the wrong backend URL.
//
// EXCEPTION: on native Capacitor (Android/iOS app), the webview origin is
// `https://localhost` — same-origin fallback would point at nothing. Always
// use the env URL on native.
function resolveBackendUrl() {
    const envUrl = process.env.REACT_APP_BACKEND_URL || '';
    if (typeof window === 'undefined') return envUrl;
    if (IS_NATIVE) return envUrl; // native app MUST use the real backend URL
    try {
        const pageOrigin = window.location.origin;
        if (!envUrl) return ''; // empty = same-origin
        const envOrigin = new URL(envUrl).origin;
        // If the env URL is a different origin from the page, prefer same-origin
        return envOrigin === pageOrigin ? envUrl : '';
    } catch {
        return envUrl;
    }
}
const BACKEND_URL = resolveBackendUrl();
const API_URL = `${BACKEND_URL}/api`;

// Native-app token storage. httpOnly cookies don't survive cross-origin
// webview→hiagain.xyz hops on Android, so on Capacitor we explicitly carry
// the JWT in the Authorization header (the login endpoint already returns
// `access_token` in the response body for exactly this reason).
const TOKEN_KEY = 'hiagain.native_token';
export function getNativeToken() {
    if (!IS_NATIVE) return null;
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setNativeToken(token) {
    if (!IS_NATIVE) return;
    try {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
    } catch {
        // localStorage unavailable — non-critical
    }
}

// Create axios instance with credentials for httpOnly cookie support (web).
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,  // Enable sending cookies with cross-origin requests (web)
    // ⚠️ Long timeout because user photos and post media are currently stored
    // as base64 data URIs in MongoDB — profile/feed responses can be 5–20 MB.
    // TODO(perf): migrate media to object storage and drop timeout back to 15s.
    timeout: 60000,
});

// On native, attach Bearer token to every request.
api.interceptors.request.use((config) => {
    if (IS_NATIVE) {
        const token = getNativeToken();
        if (token) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

// Auth uses httpOnly cookies on web (sent via withCredentials).
// On native, Authorization: Bearer header carries the token instead.

// Handle 401 errors. We deliberately do NOT auto-redirect to /login here.
// React Router's ProtectedRoute already redirects when user is null, and
// AuthContext is the single source of truth for auth state. Auto-redirecting
// from inside the axios interceptor caused "logged-in for a split second then
// kicked out" bugs whenever a non-critical endpoint (rate limit, premium gate,
// late race-condition request) returned 401 right after a successful login.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Only the canonical auth check (/auth/me) clears auth state.
            const url = error.config?.url || '';
            if (url.includes('/auth/me')) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        }
        return Promise.reject(error);
    }
);

// Auth API
export const authApi = {
    register: (data) => api.post('/auth/register', data),
    login: (data) => api.post('/auth/login', data),
    logout: () => api.post('/auth/logout'),
    getMe: () => api.get('/auth/me'),
    sendVerification: () => api.post('/auth/send-verification'),
    verifyEmail: (code) => api.post('/auth/verify-email', { code }),
    completeOnboarding: () => api.post('/auth/complete-onboarding'),
};

// Locations API
export const locationsApi = {
    getAll: () => api.get('/locations'),
    add: (data) => api.post('/locations', data),
    delete: (id) => api.delete(`/locations/${id}`),
    importTimeline: (file, onProgress) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/locations/import', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: onProgress,
            timeout: 120000, // 2 min for big timeline files
        });
    },
};

// Crossings API
export const crossingsApi = {
    getAll: () => api.get('/crossings'),
    getStats: () => api.get('/crossings/stats'),
    getSuggestions: () => api.get('/suggestions'),
};

// Discover API — People You Might Know
export const discoverApi = {
    getCandidates: () => api.get('/discover'),
};

// Search API — quick user search for navbar
export const searchApi = {
    users: (q, limit = 8) => api.get(`/users/search?q=${encodeURIComponent(q)}&limit=${limit}`),
};

// Email preferences API
export const emailPrefsApi = {
    get: () => api.get('/email-prefs'),
    update: (prefs) => api.patch('/email-prefs', prefs),
};

// Gallery API — profile albums
export const galleryApi = {
    get: (userId) => api.get(`/gallery/${userId}`),
    upload: (file, caption) => {
        const formData = new FormData();
        formData.append('file', file);
        if (caption) formData.append('caption', caption);
        return api.post('/gallery', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
    remove: (photoId) => api.delete(`/gallery/${photoId}`),
    setPrivacy: (privacy) => api.patch('/gallery/privacy', { privacy }),
};

// Connections API
export const connectionsApi = {
    getAll: () => api.get('/connections'),
    create: (data) => api.post('/connections', data),
    update: (id, status) => api.patch(`/connections/${id}?status=${status}`),
};

// Profile API
export const profileApi = {
    update: (data) => api.patch('/profile', data),
    uploadPhoto: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/profile/photo', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
    getViewers: () => api.get('/profile/viewers'),
    getViewersCount: () => api.get('/profile/viewers/count'),
    recordView: (userId) => api.post(`/profile/${userId}/view`),
};

// Feed/Posts API
export const postsApi = {
    getFeed: () => api.get('/posts/feed'),
    getExplore: (city, nearMe = false) => {
        const params = new URLSearchParams();
        if (city) params.set('city', city);
        if (nearMe) params.set('near_me', 'true');
        const qs = params.toString();
        return api.get(`/posts/explore${qs ? '?' + qs : ''}`);
    },
    getPublicTeaser: () => api.get('/posts/public-teaser'),
    getUserPosts: (userId) => api.get(`/posts/user/${userId}`),
    create: (file, caption, location, isPrivate = false) => {
        const formData = new FormData();
        formData.append('file', file);
        if (caption) formData.append('caption', caption);
        if (location) formData.append('location', location);
        formData.append('is_private', isPrivate ? 'true' : 'false');
        return api.post('/posts', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
    like: (postId) => api.post(`/posts/${postId}/like`),
    getComments: (postId) => api.get(`/posts/${postId}/comments`),
    addComment: (postId, text) => api.post(`/posts/${postId}/comments`, { text }),
    delete: (postId) => api.delete(`/posts/${postId}`),
    report: (postId, reason = 'Inappropriate content') => api.post(`/posts/${postId}/report`, { reason }),
    block: (userId) => api.post(`/users/${userId}/block`),
    unblock: (userId) => api.delete(`/users/${userId}/block`),
    blockedList: () => api.get('/users/blocked'),
};

// Subscription API
export const subscriptionApi = {
    getPlans: () => api.get('/subscription/plans'),
    getStatus: () => api.get('/subscription/status'),
    checkout: (plan, originUrl) => api.post('/subscription/checkout', { plan, origin_url: originUrl }),
    activate: (sessionId) => api.get(`/subscription/activate/${sessionId}`),
    redeemPromo: (code) => api.post('/promo/redeem', { code }),
};

// Profile Viewers API (Premium)
export const viewersApi = {
    getViewers: () => api.get('/profile/viewers'),
    getCount: () => api.get('/profile/viewers/count'),
    recordView: (userId) => api.post(`/profile/${userId}/view`),
};

// Media API
export const mediaApi = {
    upload: (file, mediaType = 'post') => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('media_type', mediaType);
        return api.post('/media/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
    getPromoVideo: () => api.get('/media/promo/video'),
    getUrl: (mediaId) => `${API_URL}/api/media/${mediaId}`,
};

// Circle API  
export const circleApi = {
    add: (contacts) => api.post('/circle/add', { contacts }),
    getAll: () => api.get('/circle'),
    remove: (contactId) => api.delete(`/circle/${contactId}`),
};

// Referral API
export const referralApi = {
    getStats: () => api.get('/referrals/stats'),
    getHistory: () => api.get('/referrals/history'),
    validate: (code) => api.post('/referrals/validate', { referral_code: code }),
    apply: (code) => api.post('/referrals/apply', { referral_code: code }),
    getLeaderboard: () => api.get('/referrals/leaderboard'),
};

// GPS Proximity API
export const gpsApi = {
    ping: (latitude, longitude, accuracy) => api.post('/gps/ping', { latitude, longitude, accuracy }),
    getNearby: (latitude, longitude, maxDistance = 1000) => 
        api.get(`/gps/nearby?latitude=${latitude}&longitude=${longitude}&max_distance=${maxDistance}`),
    getHistory: (limit = 50) => api.get(`/gps/history?limit=${limit}`),
    clearHistory: () => api.delete('/gps/history'),
    // Bluetooth Low Energy encounters
    recordBleEncounter: (otherUserId, rssi, distanceEstimate = null) => 
        api.post('/ble/encounter', { other_user_id: otherUserId, rssi, distance_estimate: distanceEstimate }),
    getBleEncounters: (limit = 50) => api.get(`/ble/encounters?limit=${limit}`),
    clearBleEncounters: () => api.delete('/ble/encounters'),
};

// Achievements API
export const achievementsApi = {
    getMine: () => api.get('/achievements'),
    getPublic: (userId) => api.get(`/achievements/${userId}/public`),
    getLeaderboard: (limit = 10) => api.get(`/achievements/leaderboard?limit=${limit}`),
};

export default api;
