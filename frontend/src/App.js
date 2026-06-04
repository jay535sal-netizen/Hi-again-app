import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { useEffect } from "react";
import Navbar from "./components/Navbar";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import LocationHistory from "./pages/LocationHistory";
import Crossings from "./pages/Crossings";
import Connections from "./pages/Connections";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import Donate from "./pages/Donate";
import Premium from "./pages/Premium";
import Feed from "./pages/Feed";
import WhoViewedMe from "./pages/WhoViewedMe";
import Referrals from "./pages/Referrals";
import Achievements from "./pages/Achievements";
import Gatherings from "./pages/Gatherings";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import DeleteAccount from "./pages/DeleteAccount";
import Discover from "./pages/Discover";
import { Loader2 } from "lucide-react";

// Referral link redirect component
function ReferralRedirect() {
    const { referralCode } = useParams();
    const navigate = useNavigate();
    
    useEffect(() => {
        // Redirect to register with referral code
        navigate(`/register?ref=${referralCode}`, { replace: true });
    }, [referralCode, navigate]);
    
    return (
        <div className="min-h-screen bg-midnight flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        </div>
    );
}

// Protected Route wrapper
function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-midnight flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return (
        <>
            <Navbar />
            {children}
        </>
    );
}

// Public Route wrapper (redirects to dashboard if logged in)
function PublicRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-midnight flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            </div>
        );
    }

    if (user) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}

// Landing with navbar for non-logged in users
function LandingWithNav() {
    const { user } = useAuth();
    
    return (
        <>
            {!user && <Navbar />}
            <Landing />
        </>
    );
}

function AppRoutes() {
    return (
        <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingWithNav />} />
            <Route
                path="/login"
                element={
                    <PublicRoute>
                        <Login />
                    </PublicRoute>
                }
            />
            <Route
                path="/register"
                element={
                    <PublicRoute>
                        <Register />
                    </PublicRoute>
                }
            />
            <Route
                path="/forgot-password"
                element={
                    <PublicRoute>
                        <ForgotPassword />
                    </PublicRoute>
                }
            />
            
            {/* Referral Link Redirect */}
            <Route
                path="/r/:referralCode"
                element={<ReferralRedirect />}
            />

            {/* Protected Routes */}
            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/locations"
                element={
                    <ProtectedRoute>
                        <LocationHistory />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/crossings"
                element={
                    <ProtectedRoute>
                        <Crossings />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/connections"
                element={
                    <ProtectedRoute>
                        <Connections />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/feed"
                element={
                    <ProtectedRoute>
                        <Feed />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/profile"
                element={
                    <ProtectedRoute>
                        <Profile />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/who-viewed-me"
                element={
                    <ProtectedRoute>
                        <WhoViewedMe />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/referrals"
                element={
                    <ProtectedRoute>
                        <Referrals />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/achievements"
                element={
                    <ProtectedRoute>
                        <Achievements />
                    </ProtectedRoute>
                }
            />

            {/* Public Donate Route */}
            <Route
                path="/donate"
                element={
                    <>
                        <Navbar />
                        <Donate />
                    </>
                }
            />
            <Route
                path="/donate/success"
                element={
                    <>
                        <Navbar />
                        <Donate />
                    </>
                }
            />

            {/* Premium Route */}
            <Route
                path="/premium"
                element={
                    <>
                        <Navbar />
                        <Premium />
                    </>
                }
            />
            <Route
                path="/subscription/success"
                element={
                    <>
                        <Navbar />
                        <Premium />
                    </>
                }
            />

            {/* Legal Pages */}
            <Route
                path="/privacy"
                element={
                    <>
                        <Navbar />
                        <Privacy />
                    </>
                }
            />
            <Route
                path="/terms"
                element={
                    <>
                        <Navbar />
                        <Terms />
                    </>
                }
            />
            <Route
                path="/delete-account"
                element={
                    <>
                        <Navbar />
                        <DeleteAccount />
                    </>
                }
            />
            <Route
                path="/data-deletion"
                element={<Navigate to="/delete-account" replace />}
            />

            {/* User Profile Page */}
            <Route
                path="/user/:userId"
                element={
                    <ProtectedRoute>
                        <Navbar />
                        <UserProfile />
                    </ProtectedRoute>
                }
            />

            {/* Gatherings Page */}
            <Route
                path="/gatherings"
                element={
                    <ProtectedRoute>
                        <Navbar />
                        <Gatherings />
                    </ProtectedRoute>
                }
            />

            {/* Discover Page (People You Might Know) */}
            <Route
                path="/discover"
                element={
                    <ProtectedRoute>
                        <Navbar />
                        <Discover />
                    </ProtectedRoute>
                }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

// Toast styling configuration
const toastOptions = {
    style: {
        background: '#0F172A',
        border: '1px solid #1E293B',
        color: '#F8FAFC',
    },
};

function App() {
    return (
        <div className="App">
            <BrowserRouter>
                <AuthProvider>
                    <AppRoutes />
                    <Toaster 
                        position="top-right" 
                        toastOptions={toastOptions}
                    />
                </AuthProvider>
            </BrowserRouter>
        </div>
    );
}

export default App;
