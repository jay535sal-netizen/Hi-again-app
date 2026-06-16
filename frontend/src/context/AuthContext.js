import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { authApi, setNativeToken } from '../lib/api';
import { initFirebase, clearFirebaseRegistration } from '../lib/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    // Tracks the most recent successful login so a race-condition /auth/me
    // failure right after login can't blast the user off the page.
    const lastLoginAt = useRef(0);
    const POST_LOGIN_GRACE_MS = 5000;

    const initializeAuth = useCallback(async () => {
        // First check if we have a stored user locally (for quick initial render)
        const storedUser = localStorage.getItem('user');

        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch {
                localStorage.removeItem('user');
            }
        }

        // Always verify with server (cookie will be sent automatically)
        try {
            const res = await authApi.getMe();
            setUser(res.data);
            localStorage.setItem('user', JSON.stringify(res.data));
        } catch (err) {
            const justLoggedIn = Date.now() - lastLoginAt.current < POST_LOGIN_GRACE_MS;
            if (err?.response?.status === 401 && justLoggedIn) {
                // Race: cookie just set, this request raced ahead without it.
                // Trust the user state we already have from login().
                return;
            }
            if (err?.response?.status !== 401) {
                console.warn('Auth check failed:', err?.message || err);
            }
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        initializeAuth();
    }, [initializeAuth]);

    // Initialise Firebase (Crashlytics + FCM push registration) once we have
    // a confirmed user. No-op on web; only runs on native Android.
    useEffect(() => {
        if (!user?.id) return;
        initFirebase(user);
    }, [user?.id]);

    const login = useCallback(async (email, password) => {
        const response = await authApi.login({ email, password });
        const { user: userData, access_token } = response.data;
        // Web: token is in an httpOnly cookie set by the server.
        // Native (Capacitor): cookies don't survive the cross-origin webview hop,
        // so we persist the access_token and send it as a Bearer header.
        if (access_token) setNativeToken(access_token);
        lastLoginAt.current = Date.now();
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        return userData;
    }, []);

    const register = useCallback(async (name, email, password) => {
        const response = await authApi.register({ name, email, password });
        const { user: userData, access_token } = response.data;
        if (access_token) setNativeToken(access_token);
        lastLoginAt.current = Date.now();
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        return userData;
    }, []);

    const logout = useCallback(async () => {
        // Best-effort: unregister the device's push token before clearing auth
        try { await clearFirebaseRegistration(); } catch {
            // non-critical
        }
        try {
            // Call server to clear httpOnly cookie
            await authApi.logout();
        } catch (err) {
            // Continue with local cleanup even if server call fails
            console.warn('Logout request failed (continuing client-side cleanup):', err?.message || err);
        }
        // Clear local storage + native token
        setNativeToken(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    }, []);

    const updateUser = useCallback((updatedData) => {
        setUser(prevUser => {
            const newUser = { ...prevUser, ...updatedData };
            localStorage.setItem('user', JSON.stringify(newUser));
            return newUser;
        });
    }, []);

    const contextValue = useMemo(() => ({
        user,
        loading,
        login,
        register,
        logout,
        updateUser
    }), [user, loading, login, register, logout, updateUser]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
