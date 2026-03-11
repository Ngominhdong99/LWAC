import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import BottomNav from './BottomNav';
import { NavLink } from 'react-router-dom';
import { BookOpen, Home, Library, MessageCircle, Users, HelpCircle, LogOut, Send, FileEdit } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const MainLayout = () => {
  const { user, logout, isCoach } = useAuth();
  const navigate = useNavigate();

  const studentNav = [
    { icon: Home, label: 'Dashboard', path: '/' },
    { icon: BookOpen, label: 'Practice', path: '/reading' },
    { icon: MessageCircle, label: 'Teacher Hub', path: '/hub' },
    { icon: Library, label: 'Vocab Vault', path: '/vocab' },
  ];

  const coachNav = [
    { icon: Home, label: 'Dashboard', path: '/coach' },
    { icon: Users, label: 'Students', path: '/coach/students' },
    { icon: MessageCircle, label: 'Chat', path: '/coach/chat' },
    { icon: HelpCircle, label: 'Questions', path: '/coach/questions' },
    { icon: FileEdit, label: 'Lesson Builder', path: '/coach/builder' },
    { icon: Library, label: 'Manage Lessons', path: '/coach/lessons' },
    { icon: BookOpen, label: 'Practice', path: '/reading' },
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
            LWAC<span className="text-primary-500">.</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium tracking-wide mt-1">
            Learn With Amateur Coach
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
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center space-x-3 mb-3 px-2">
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

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 w-full max-w-7xl mx-auto min-h-screen">
        <div className="w-full h-full">
            <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav navItems={navItems} />
    </div>
  );
};

export default MainLayout;
