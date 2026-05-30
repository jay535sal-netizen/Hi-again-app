import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MapPin, History, Users, User, LogOut, Menu, X, Coffee, Crown, Newspaper, Eye, Gift, Trophy, PartyPopper, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Avatar, AvatarFallback } from './ui/avatar';
import { getInitials } from '../lib/utils';
import UserSearch from './UserSearch';

const LOGO_IMAGE = "https://customer-assets.emergentagent.com/job_b7b92905-43c7-452b-8604-2f29be040573/artifacts/ye6z93sn_4173.jpg";

export default function Navbar() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const navItems = [
        { path: '/dashboard', label: 'Dashboard', icon: MapPin },
        { path: '/feed', label: 'Feed', icon: Newspaper },
        { path: '/discover', label: 'Discover', icon: Sparkles },
        { path: '/gatherings', label: 'Gatherings', icon: PartyPopper },
        { path: '/crossings', label: 'Crossings', icon: History },
        { path: '/connections', label: 'Connections', icon: Users },
    ];

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const isActive = (path) => location.pathname === path;

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5" data-testid="navbar">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link 
                        to={user ? '/dashboard' : '/'} 
                        className="flex items-center gap-2 group"
                        data-testid="nav-logo"
                    >
                        <img 
                            src={LOGO_IMAGE} 
                            alt="Hi Again Logo" 
                            className="w-8 h-8 object-contain transition-transform duration-300 group-hover:scale-110"
                        />
                        <span className="font-heading font-normal text-xl text-white">
                            Hi Again
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    {user && (
                        <div className="hidden md:flex items-center gap-1">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        data-testid={`nav-${item.label.toLowerCase()}`}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                                            isActive(item.path)
                                                ? 'bg-rose-500/20 text-rose-400'
                                                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                                        }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </div>
                    )}

                    {/* Right side */}
                    <div className="flex items-center gap-3">
                        {/* User Search (desktop / tablet) */}
                        {user ? (
                            <div className="hidden lg:block">
                                <UserSearch />
                            </div>
                        ) : null}

                        {/* Premium Button */}
                        <Link to="/premium" className="hidden sm:block">
                            <Button 
                                size="sm"
                                className="bg-gradient-to-r from-rose-500 to-orange-500 text-white rounded-full hover:opacity-90"
                                data-testid="nav-premium"
                            >
                                <Crown className="w-4 h-4 mr-2" />
                                Premium
                            </Button>
                        </Link>

                        {user ? (
                            <>
                                {/* Desktop User Menu */}
                                <div className="hidden md:block">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button 
                                                variant="ghost" 
                                                className="flex items-center gap-2 hover:bg-slate-800/50"
                                                data-testid="user-menu-trigger"
                                            >
                                                <Avatar className="w-8 h-8 border border-rose-500/30">
                                                    <AvatarFallback className="bg-slate-800 text-rose-400 text-sm">
                                                        {getInitials(user.name)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="text-sm text-slate-300">{user.name}</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent 
                                            align="end" 
                                            className="w-56 bg-slate-900 border-slate-800"
                                        >
                                            <DropdownMenuItem asChild>
                                                <Link 
                                                    to="/profile" 
                                                    className="flex items-center gap-2 cursor-pointer"
                                                    data-testid="nav-profile"
                                                >
                                                    <User className="w-4 h-4" />
                                                    Profile
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild>
                                                <Link 
                                                    to="/who-viewed-me" 
                                                    className="flex items-center gap-2 cursor-pointer text-amber-400"
                                                    data-testid="nav-who-viewed"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                    Who Viewed Me
                                                    <span className="ml-auto text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">VIP</span>
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild>
                                                <Link 
                                                    to="/referrals" 
                                                    className="flex items-center gap-2 cursor-pointer text-emerald-400"
                                                    data-testid="nav-referrals"
                                                >
                                                    <Gift className="w-4 h-4" />
                                                    Invite Friends
                                                    <span className="ml-auto text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Earn</span>
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild>
                                                <Link 
                                                    to="/donate" 
                                                    className="flex items-center gap-2 cursor-pointer text-rose-400"
                                                    data-testid="nav-donate-menu"
                                                >
                                                    <Coffee className="w-4 h-4" />
                                                    Support Us
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild>
                                                <Link 
                                                    to="/achievements" 
                                                    className="flex items-center gap-2 cursor-pointer text-amber-400"
                                                    data-testid="nav-achievements"
                                                >
                                                    <Trophy className="w-4 h-4" />
                                                    Achievements
                                                    <span className="ml-auto text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">New</span>
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator className="bg-slate-800" />
                                            <DropdownMenuItem 
                                                onClick={handleLogout}
                                                className="flex items-center gap-2 cursor-pointer text-red-400 focus:text-red-400"
                                                data-testid="nav-logout"
                                            >
                                                <LogOut className="w-4 h-4" />
                                                Logout
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                {/* Mobile menu button */}
                                <button
                                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                    className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
                                    data-testid="mobile-menu-toggle"
                                >
                                    {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                                </button>
                            </>
                        ) : (
                            <div className="flex items-center gap-3">
                                <Link to="/login">
                                    <Button 
                                        variant="ghost" 
                                        className="text-slate-300 hover:text-white"
                                        data-testid="nav-login"
                                    >
                                        Sign In
                                    </Button>
                                </Link>
                                <Link to="/register">
                                    <Button 
                                        className="gradient-sunset text-white rounded-full px-6 hover:opacity-90 transition-opacity"
                                        data-testid="nav-register"
                                    >
                                        Get Started
                                    </Button>
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile Navigation */}
            {user && mobileMenuOpen && (
                <div className="md:hidden glass border-t border-white/5" data-testid="mobile-menu">
                    <div className="px-4 py-4 space-y-2">
                        {/* Mobile search */}
                        <div className="pb-2">
                            <UserSearch compact />
                        </div>
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                                        isActive(item.path)
                                            ? 'bg-rose-500/20 text-rose-400'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                                    }`}
                                >
                                    <Icon className="w-5 h-5" />
                                    {item.label}
                                </Link>
                            );
                        })}
                        <Link
                            to="/profile"
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all duration-300"
                        >
                            <User className="w-5 h-5" />
                            Profile
                        </Link>
                        <Link
                            to="/who-viewed-me"
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-amber-400 hover:bg-amber-500/10 transition-all duration-300"
                        >
                            <Eye className="w-5 h-5" />
                            Who Viewed Me
                            <span className="ml-auto text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">VIP</span>
                        </Link>
                        <Link
                            to="/referrals"
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-emerald-400 hover:bg-emerald-500/10 transition-all duration-300"
                        >
                            <Gift className="w-5 h-5" />
                            Invite Friends
                            <span className="ml-auto text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Earn</span>
                        </Link>
                        <Link
                            to="/donate"
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-all duration-300"
                        >
                            <Coffee className="w-5 h-5" />
                            Support Us
                        </Link>
                        <Link
                            to="/achievements"
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-amber-400 hover:bg-amber-500/10 transition-all duration-300"
                        >
                            <Trophy className="w-5 h-5" />
                            Achievements
                            <span className="ml-auto text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">New</span>
                        </Link>
                        <button
                            onClick={() => {
                                setMobileMenuOpen(false);
                                handleLogout();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all duration-300"
                        >
                            <LogOut className="w-5 h-5" />
                            Logout
                        </button>
                    </div>
                </div>
            )}
        </nav>
    );
}
