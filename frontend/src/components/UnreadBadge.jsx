import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../api';
import { useLocation } from 'react-router-dom';

const UnreadBadge = ({ user, isMobile }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();

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

  if (unreadCount === 0) return null;

  if (isMobile) {
    return (
      <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 shadow-sm">
        {unreadCount > 99 ? '99+' : unreadCount}
      </span>
    );
  }

  return (
    <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 animate-pulse shadow-sm">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  );
};

export default UnreadBadge;
