import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Send, ArrowLeft, Users, Loader2, Check, CheckCheck, Image as ImageIcon, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import API_URL from '../api';
import Avatar from '../components/Avatar';

// Relative time formatter like Messenger
const timeAgo = (isoString) => {
  if (!isoString) return 'Offline';
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = Math.max(0, Math.floor((now - then) / 1000));
  if (diff < 60) return 'Active just now';
  if (diff < 3600) return `Active ${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `Active ${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return 'Active yesterday';
  return `Active ${Math.floor(diff / 86400)}d ago`;
};

const formatTime = (utcString) => {
  if (!utcString) return '';
  // Ensure UTC interpretation: append Z if not present
  const ts = utcString.endsWith('Z') ? utcString : utcString + 'Z';
  const dateObj = new Date(ts);
  const today = new Date();
  
  // If it's today, just show time. If older, show Date + Time
  if (dateObj.toDateString() === today.toDateString()) {
    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    // Return e.g. "Oct 5, 10:30 AM" or "05/10/2026 10:30"
    return dateObj.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
};

const CoachChat = () => {
  const { studentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(studentId ? parseInt(studentId) : null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [inputMsg, setInputMsg] = useState('');
  const [pendingImage, setPendingImage] = useState(null);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState({});
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);
  const isInitialLoad = useRef(true);
  const typingTimeoutRef = useRef(null);

  // Fetch conversations list + merge all contacts
  const fetchConversations = useCallback(async () => {
    if (!user) return;
    try {
      const convRes = await axios.get(`${API_URL}/chat/conversations/${user.id}`);
      const existingConvos = convRes.data;
      const existingIds = new Set(existingConvos.map(c => c.user_id));
      let allContacts = [...existingConvos];

      if (user.role === 'coach') {
        try {
          const studentsRes = await axios.get(`${API_URL}/coach/students`);
          const newStudents = studentsRes.data
            .filter(s => !existingIds.has(s.id))
            .map(s => ({
              user_id: s.id, username: s.username,
              full_name: s.full_name || s.username,
              avatar_color: s.avatar_color || '#0d9488',
              role: 'student', last_message: '', last_time: ''
            }));
          allContacts = [...allContacts, ...newStudents];
        } catch (e) { console.error('Failed to fetch students', e); }
      } else {
        try {
          const usersRes = await axios.get(`${API_URL}/auth/users`);
          const coaches = usersRes.data
            .filter(u => u.role === 'coach' && !existingIds.has(u.id))
            .map(c => ({
              user_id: c.id, username: c.username,
              full_name: c.full_name || c.username,
              avatar_color: c.avatar_color || '#0d9488',
              role: 'coach', last_message: '', last_time: ''
            }));
          allContacts = [...allContacts, ...coaches];
        } catch (e) { console.error('Failed to fetch coaches', e); }
      }
      setConversations(allContacts);
    } catch (e) { console.error('Failed to fetch conversations', e); }
  }, [user]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // ── Heartbeat: update last_active every 30s ──
  useEffect(() => {
    if (!user) return;
    const ping = () => axios.post(`${API_URL}/chat/heartbeat/${user.id}`).catch(() => {});
    ping();
    const interval = setInterval(ping, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // ── Poll online status for all contacts every 15s ──
  useEffect(() => {
    if (!user || conversations.length === 0) return;
    const ids = conversations.map(c => c.user_id).join(',');
    const fetchStatus = () => {
      axios.get(`${API_URL}/chat/online-status?user_ids=${ids}`)
        .then(res => setOnlineStatus(res.data))
        .catch(() => {});
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [user, conversations]);

  // ── Poll typing status for selected user every 2s ──
  useEffect(() => {
    if (!selectedUserId || !user) return;
    setIsOtherTyping(false);
    const poll = () => {
      axios.get(`${API_URL}/chat/typing/${user.id}/${selectedUserId}`)
        .then(res => setIsOtherTyping(res.data.is_typing))
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [selectedUserId, user]);

  // ── Mark messages as read when viewing a conversation ──
  useEffect(() => {
    if (!selectedUserId || !user) return;
    axios.post(`${API_URL}/chat/mark-read/${user.id}/${selectedUserId}`).catch(() => {});
  }, [selectedUserId, user, messages]);

  // Fetch messages when selecting a user
  useEffect(() => {
    if (!selectedUserId || !user) return;
    isInitialLoad.current = true;
    setHasMore(true);
    const fetchMessages = async () => {
      try {
        const res = await axios.get(`${API_URL}/chat/history/${user.id}/${selectedUserId}?limit=30`);
        setMessages(res.data);
        setHasMore(res.data.length >= 30);
        const found = conversations.find(c => c.user_id === selectedUserId);
        setSelectedUser(found);
      } catch (e) { console.error(e); }
    };
    fetchMessages();
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_URL}/chat/history/${user.id}/${selectedUserId}?limit=30`);
        setMessages(prev => {
          if (res.data.length > 0 && prev.length > 0 && res.data[res.data.length - 1].id !== prev[prev.length - 1].id) {
            return res.data;
          }
          // Also update if is_read status changed (for sent status ticks)
          if (res.data.length > 0 && prev.length > 0) {
            const lastNew = res.data[res.data.length - 1];
            const lastOld = prev[prev.length - 1];
            if (lastNew.is_read !== lastOld.is_read) return res.data;
          }
          if (res.data.length > 0 && prev.length === 0) return res.data;
          return prev;
        });
      } catch (e) { /* ignore poll errors */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedUserId, user, conversations]);

  useEffect(() => {
    if (isInitialLoad.current && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView();
      isInitialLoad.current = false;
    } else if (!isInitialLoad.current && !loadingMore) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (selectedUserId) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [selectedUserId]);

  const handleScroll = useCallback(() => {
    const container = chatContainerRef.current;
    if (!container || !hasMore || loadingMore || messages.length === 0) return;
    if (container.scrollTop < 60) {
      const oldestId = messages[0]?.id;
      if (!oldestId) return;
      setLoadingMore(true);
      const prevHeight = container.scrollHeight;
      axios.get(`${API_URL}/chat/history/${user.id}/${selectedUserId}?limit=20&before_id=${oldestId}`)
        .then(res => {
          if (res.data.length === 0) { setHasMore(false); return; }
          setHasMore(res.data.length >= 20);
          setMessages(prev => [...res.data, ...prev]);
          requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight - prevHeight;
          });
        })
        .catch(console.error)
        .finally(() => setLoadingMore(false));
    }
  }, [hasMore, loadingMore, messages, user, selectedUserId]);

  // ── Send typing signal on input change ──
  const handleInputChange = (e) => {
    setInputMsg(e.target.value);
    if (!selectedUserId || !user) return;
    if (typingTimeoutRef.current) return;
    axios.post(`${API_URL}/chat/typing`, {
      sender_id: user.id, receiver_id: selectedUserId
    }).catch(() => {});
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputMsg.trim() && !pendingImage) return;
    if (!selectedUserId || !user) return;
    setSending(true);
    try {
      if (pendingImage) {
        const formData = new FormData();
        formData.append('file', pendingImage.file);
        const res = await axios.post(`${API_URL}/upload/image`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        const imageUrl = res.data.url;
        await axios.post(`${API_URL}/chat/send`, {
          sender_id: user.id, receiver_id: selectedUserId, message: `[IMAGE]${imageUrl}`
        });
        setPendingImage(null);
      }

      const textMsg = inputMsg.trim();
      if (textMsg) {
        await axios.post(`${API_URL}/chat/send`, {
          sender_id: user.id, receiver_id: selectedUserId, message: textMsg
        });
        setInputMsg('');
      }

      // Refresh messages AND conversation list (for last_message update)
      const [msgRes] = await Promise.all([
        axios.get(`${API_URL}/chat/history/${user.id}/${selectedUserId}?limit=30`),
        fetchConversations(),
      ]);
      setMessages(msgRes.data);
    } catch (e) { console.error(e); }
    finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingImage({
      file,
      preview: URL.createObjectURL(file)
    });
    e.target.value = null; // reset
  };
  
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
       if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
             e.preventDefault();
             setPendingImage({
               file,
               preview: URL.createObjectURL(file)
             });
             break;
          }
       }
    }
  };

  // Message status icon
  const MessageStatus = ({ msg }) => {
    if (msg.sender_id !== user.id) return null; // only show for sent messages
    if (msg.is_read) {
      return <CheckCheck size={14} className="text-blue-500" />;
    }
    return <Check size={14} className="text-slate-400" />;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] md:h-screen bg-secondary p-4 md:p-6 max-w-6xl mx-auto w-full">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Chat</h1>
        <p className="text-slate-500 text-sm">Message {user?.role === 'coach' ? 'your students' : 'your coach'} directly</p>
      </header>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex">
        {/* Left: Conversations List */}
        <div className={`${selectedUserId ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-72 border-r border-slate-200 bg-slate-50`}>
          <div className="p-3 border-b border-slate-200">
            <div className="flex items-center space-x-2 text-sm font-semibold text-slate-600">
              <Users size={16} />
              <span>{user?.role === 'coach' ? 'Students' : 'Coaches'}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.map(c => {
              const status = onlineStatus[String(c.user_id)];
              const isOnline = status?.online === true;
              const lastActiveText = isOnline ? 'Online' : timeAgo(status?.last_active);
              return (
                <button key={c.user_id} onClick={() => setSelectedUserId(c.user_id)}
                  className={`w-full flex items-center space-x-3 p-3 hover:bg-slate-100 transition-colors text-left ${selectedUserId === c.user_id ? 'bg-primary-50 border-r-2 border-primary-500' : ''}`}>
                  <div className="relative flex-shrink-0">
                    <Avatar user={c} size="md" />
                    <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${isOnline ? 'bg-green-500' : 'bg-slate-300'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{c.full_name || c.username}</p>
                    <p className={`text-xs truncate ${isOnline ? 'text-green-500' : 'text-slate-400'}`}>{c.last_message || lastActiveText}</p>
                  </div>
                </button>
              );
            })}
            {conversations.length === 0 && <p className="text-slate-400 text-sm text-center py-8">No contacts found</p>}
          </div>
        </div>

        {/* Right: Chat Area */}
        <div className={`${selectedUserId ? 'flex' : 'hidden md:flex'} flex-col flex-1`}>
          {selectedUserId ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center space-x-3 p-4 border-b border-slate-200 bg-white">
                <button onClick={() => setSelectedUserId(null)} className="md:hidden p-1 text-slate-500">
                  <ArrowLeft size={18} />
                </button>
                {selectedUser && (
                  <>
                    <div className="relative">
                      <Avatar user={selectedUser} className="w-9 h-9 text-sm" />
                      <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${onlineStatus[String(selectedUserId)]?.online ? 'bg-green-500' : 'bg-slate-300'}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 leading-tight">{selectedUser.full_name || selectedUser.username}</p>
                      <p className="text-xs text-slate-400">
                        {isOtherTyping ? (
                          <span className="text-primary-500 font-medium animate-pulse">typing...</span>
                        ) : onlineStatus[String(selectedUserId)]?.online ? (
                          <span className="text-green-500">Online</span>
                        ) : timeAgo(onlineStatus[String(selectedUserId)]?.last_active)}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Messages */}
              <div ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                {loadingMore && (
                  <div className="flex justify-center py-2">
                    <Loader2 size={16} className="animate-spin text-primary-400" />
                  </div>
                )}
                {messages.length === 0 && (
                  <p className="text-center text-slate-400 py-8 text-sm">Start a conversation!</p>
                )}
                {messages.map(msg => (
                  <div key={msg.id} className={`flex flex-col ${msg.sender_id === user.id ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl p-3 shadow-sm text-sm ${
                      msg.sender_id === user.id
                        ? 'bg-primary-600 text-white rounded-br-none'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                    }`}>
                      {msg.message.startsWith('[IMAGE]') ? (
                        <img 
                          src={msg.message.replace('[IMAGE]', '').startsWith('/static') ? `${API_URL}${msg.message.replace('[IMAGE]', '')}` : msg.message.replace('[IMAGE]', '')} 
                          alt="Attachment" 
                          className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(msg.message.replace('[IMAGE]', '').startsWith('/static') ? `${API_URL}${msg.message.replace('[IMAGE]', '')}` : msg.message.replace('[IMAGE]', ''), '_blank')}
                        />
                      ) : (
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-1 mt-1 px-1">
                      <span className="text-xs text-slate-400">
                        {formatTime(msg.created_at)}
                      </span>
                      <MessageStatus msg={msg} />
                    </div>
                  </div>
                ))}
                {/* Typing indicator bubble */}
                {isOtherTyping && (
                  <div className="flex flex-col items-start">
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
                      <div className="flex space-x-1">
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              {pendingImage && (
                <div className="p-3 bg-slate-50 border-t border-slate-200 shadow-inner">
                  <div className="relative inline-block">
                    <img src={pendingImage.preview} alt="Preview" className="h-24 rounded-lg border border-slate-300 object-cover shadow-sm" />
                    <button 
                      type="button"
                      onClick={() => setPendingImage(null)}
                      className="absolute -top-2 -right-2 bg-slate-800 text-white p-1.5 rounded-full hover:bg-red-500 transition-colors shadow-md z-10"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}
              <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex items-center space-x-2">
                <label className={`p-2 text-slate-400 hover:text-primary-600 transition-colors cursor-pointer rounded-xl hover:bg-slate-100 flex-shrink-0 ${sending ? 'opacity-50 pointer-events-none' : ''}`}>
                  <ImageIcon size={22} />
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={sending} />
                </label>
                <input ref={inputRef} onPaste={handlePaste} type="text" value={inputMsg} onChange={handleInputChange}
                  placeholder={pendingImage ? "Add a message with your image..." : "Type a message or paste an image..."} disabled={sending} autoFocus
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                <button type="submit" disabled={(!inputMsg.trim() && !pendingImage) || sending}
                  className={`p-2.5 rounded-xl transition-colors flex-shrink-0 ${(!inputMsg.trim() && !pendingImage) || sending ? 'bg-slate-100 text-slate-400' : 'bg-primary-600 text-white hover:bg-primary-700'}`}>
                  {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <p>Select a conversation to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoachChat;
