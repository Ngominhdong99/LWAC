import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import { NavLink } from 'react-router-dom';
import { BookOpen, Home, Library, MessageCircle, Users, HelpCircle, LogOut, Send, FileEdit, X, Check, Edit3, Trophy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import API_URL from '../api';

const AVATAR_COLORS = [
  '#0d9488', '#0891b2', '#2563eb', '#7c3aed', '#c026d3',
  '#e11d48', '#ea580c', '#d97706', '#65a30d', '#059669',
  '#475569', '#1e293b', '#6366f1', '#ec4899', '#f43f5e',
];

const MainLayout = () => {
  const { user, logout, isCoach, updateUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showProfile, setShowProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: '', email: '', avatar_color: '' });
  const [saving, setSaving] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Poll unread message count every 10 seconds
  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      try {
        const res = await axios.get(`${API_URL}/chat/unread/${user.id}`);
        setUnreadCount(res.data.unread || 0);
      } catch (e) { /* ignore */ }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 10000);
    return () => clearInterval(interval);
  }, [user]);

  // Reset unread when on chat page
  useEffect(() => {
    const isChatPage = location.pathname === '/chat' || location.pathname === '/coach/chat';
    if (isChatPage) {
      const timer = setTimeout(() => setUnreadCount(0), 1500);
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  // Initialize profile form when opening
  useEffect(() => {
    if (showProfile && user) {
      setProfileForm({
        full_name: user.full_name || '',
        email: user.email || '',
        avatar_color: user.avatar_color || '#0d9488',
      });
    }
  }, [showProfile, user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const res = await axios.put(`${API_URL}/auth/profile/${user.id}`, profileForm);
      updateUser(res.data);
      setShowProfile(false);
    } catch (e) {
      alert('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const studentNav = [
    { icon: Home, label: 'Dashboard', path: '/' },
    { icon: BookOpen, label: 'Practice', path: '/reading' },
    { icon: Send, label: 'AI Assistant', path: '/hub' },
    { icon: MessageCircle, label: 'Chat', path: '/chat', showBadge: true },
    { icon: Trophy, label: 'Rewards', path: '/rewards' },
    { icon: Library, label: 'Vocab Vault', path: '/vocab' },
  ];

  const coachNav = [
    { icon: Home, label: 'Dashboard', path: '/coach' },
    { icon: Users, label: 'Students', path: '/coach/students' },
    { icon: MessageCircle, label: 'Chat', path: '/coach/chat', showBadge: true },
    { icon: HelpCircle, label: 'Questions', path: '/coach/questions' },
    { icon: FileEdit, label: 'Lesson Builder', path: '/coach/builder' },
    { icon: Library, label: 'Manage Lessons', path: '/coach/lessons' },
    { icon: Trophy, label: 'Rewards', path: '/coach/rewards' },
    { icon: Send, label: 'AI Assistant', path: '/hub' },
  ];

  const navItems = isCoach ? coachNav : studentNav;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-secondary flex flex-col md:flex-row pb-16 md:pb-0">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 bg-white border-r border-slate-200">
        <div className="p-6">
          <h1 className="text-2xl font-bold tracking-tighter text-primary-800">
            SIT<span className="text-primary-500">.</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium tracking-wide mt-1">
            Steps with Minh Dong to IELTS
          </p>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/' || item.path === '/coach'}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? 'bg-primary-50 text-primary-700 font-semibold shadow-sm'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-primary-600'
                  }`
                }
              >
                <Icon size={20} />
                <span className="flex-1">{item.label}</span>
                {item.showBadge && unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Section — clickable to open profile */}
        <div className="p-4 border-t border-slate-200">
          <div 
            className="flex items-center space-x-3 mb-3 px-2 cursor-pointer hover:bg-slate-50 rounded-xl py-2 transition-colors"
            onClick={() => setShowProfile(true)}
            title="Edit Profile"
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: user?.avatar_color || '#0d9488' }}>
              {(user?.full_name || user?.username || 'U')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-slate-800 truncate">{user?.full_name || user?.username}</p>
              <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center space-x-2 w-full px-4 py-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors text-sm">
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-slate-200 z-40 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tighter text-primary-800">
          SIT<span className="text-primary-500">.</span>
        </h1>
        <div className="relative">
          <button 
            onClick={() => setShowMobileMenu(prev => !prev)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md"
            style={{ backgroundColor: user?.avatar_color || '#0d9488' }}
          >
            {(user?.full_name || user?.username || 'U')[0].toUpperCase()}
          </button>
          {showMobileMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMobileMenu(false)} />
              <div className="absolute right-0 top-12 bg-white rounded-xl shadow-2xl border border-slate-200 w-52 py-2 z-50">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="font-semibold text-sm text-slate-800 truncate">{user?.full_name || user?.username}</p>
                  <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
                </div>
                <button 
                  onClick={() => { setShowMobileMenu(false); setShowProfile(true); }}
                  className="flex items-center space-x-3 w-full px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Edit3 size={16} />
                  <span>Edit Profile</span>
                </button>
                <button 
                  onClick={() => { setShowMobileMenu(false); handleLogout(); }}
                  className="flex items-center space-x-3 w-full px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 w-full max-w-7xl mx-auto min-h-screen mt-14 md:mt-0">
        <div className="w-full h-full">
            <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav navItems={navItems} unreadCount={unreadCount} />

      {/* Profile Edit Modal */}
      {showProfile && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800">Edit Profile</h3>
              <button onClick={() => setShowProfile(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Avatar Preview + Color Picker */}
              <div className="flex flex-col items-center">
                <div 
                  className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl mb-4 shadow-lg transition-colors"
                  style={{ backgroundColor: profileForm.avatar_color }}
                >
                  {(profileForm.full_name || user?.username || 'U')[0].toUpperCase()}
                </div>
                <p className="text-sm text-slate-500 mb-3">Choose avatar color</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {AVATAR_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setProfileForm(prev => ({ ...prev, avatar_color: color }))}
                      className={`w-8 h-8 rounded-full transition-all border-2 hover:scale-110 ${
                        profileForm.avatar_color === color 
                          ? 'border-slate-800 scale-110 shadow-md' 
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    >
                      {profileForm.avatar_color === color && (
                        <Check size={14} className="text-white mx-auto" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={profileForm.full_name}
                  onChange={e => setProfileForm(prev => ({ ...prev, full_name: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                  placeholder="Your full name"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={e => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                  placeholder="your@email.com"
                />
              </div>

              {/* Username (read-only) */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Username</label>
                <input
                  type="text"
                  value={user?.username || ''}
                  disabled
                  className="w-full px-4 py-2.5 border border-slate-100 rounded-xl bg-slate-50 text-slate-400 text-sm cursor-not-allowed"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-6 border-t border-slate-100 bg-slate-50">
              <button 
                onClick={() => setShowProfile(false)}
                className="flex-1 py-2.5 font-semibold rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex-1 py-2.5 font-semibold rounded-xl bg-primary-600 text-white hover:bg-primary-700 transition-colors text-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainLayout;
