import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Send, ArrowLeft, Users, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import API_URL from '../api';

const CoachChat = () => {
  const { studentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(studentId ? parseInt(studentId) : null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [inputMsg, setInputMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);
  const isInitialLoad = useRef(true);

  // Fetch conversations list + merge all contacts
  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      try {
        // 1. Get existing conversations (people we've chatted with)
        const convRes = await axios.get(`${API_URL}/chat/conversations/${user.id}`);
        const existingConvos = convRes.data;
        const existingIds = new Set(existingConvos.map(c => c.user_id));

        let allContacts = [...existingConvos];

        if (user.role === 'coach') {
          // 2. Coach: also fetch ALL students, merge those not yet chatted with
          try {
            const studentsRes = await axios.get(`${API_URL}/coach/students`);
            const newStudents = studentsRes.data
              .filter(s => !existingIds.has(s.id))
              .map(s => ({
                user_id: s.id,
                username: s.username,
                full_name: s.full_name || s.username,
                avatar_color: s.avatar_color || '#0d9488',
                role: 'student',
                last_message: '',
                last_time: ''
              }));
            allContacts = [...allContacts, ...newStudents];
          } catch (e) { console.error('Failed to fetch students', e); }
        } else {
          // 3. Student: fetch ALL coaches, merge those not yet chatted with
          try {
            const usersRes = await axios.get(`${API_URL}/auth/users`);
            const coaches = usersRes.data
              .filter(u => u.role === 'coach' && !existingIds.has(u.id))
              .map(c => ({
                user_id: c.id,
                username: c.username,
                full_name: c.full_name || c.username,
                avatar_color: c.avatar_color || '#0d9488',
                role: 'coach',
                last_message: '',
                last_time: ''
              }));
            allContacts = [...allContacts, ...coaches];
          } catch (e) { console.error('Failed to fetch coaches', e); }
        }

        setConversations(allContacts);
      } catch (e) {
        console.error('Failed to fetch conversations', e);
      }
    };
    fetchAll();
  }, [user]);

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
          if (res.data.length > 0 && prev.length === 0) {
            return res.data;
          }
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

  // Focus input when selecting a user
  useEffect(() => {
    if (selectedUserId) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [selectedUserId]);

  // Load older messages on scroll to top
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

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputMsg.trim() || !selectedUserId || !user) return;
    setSending(true);
    try {
      await axios.post(`${API_URL}/chat/send`, {
        sender_id: user.id, receiver_id: selectedUserId, message: inputMsg
      });
      setInputMsg('');
      const res = await axios.get(`${API_URL}/chat/history/${user.id}/${selectedUserId}?limit=30`);
      setMessages(res.data);
    } catch (e) { console.error(e); }
    finally {
      setSending(false);
      // Re-focus input after sending
      setTimeout(() => inputRef.current?.focus(), 50);
    }
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
            {conversations.map(c => (
              <button key={c.user_id} onClick={() => setSelectedUserId(c.user_id)}
                className={`w-full flex items-center space-x-3 p-3 hover:bg-slate-100 transition-colors text-left ${selectedUserId === c.user_id ? 'bg-primary-50 border-r-2 border-primary-500' : ''}`}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ backgroundColor: c.avatar_color || '#0d9488' }}>
                  {(c.full_name || c.username)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{c.full_name || c.username}</p>
                  <p className="text-xs text-slate-400 truncate">{c.last_message || 'No messages yet'}</p>
                </div>
              </button>
            ))}
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
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: selectedUser.avatar_color || '#0d9488' }}>
                      {(selectedUser.full_name || selectedUser.username)[0].toUpperCase()}
                    </div>
                    <p className="font-semibold text-slate-800">{selectedUser.full_name || selectedUser.username}</p>
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
                      <p className="leading-relaxed">{msg.message}</p>
                    </div>
                    <span className="text-xs text-slate-400 mt-1 px-1">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex space-x-2">
                <input ref={inputRef} type="text" value={inputMsg} onChange={e => setInputMsg(e.target.value)}
                  placeholder="Type a message..." disabled={sending} autoFocus
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                <button type="submit" disabled={!inputMsg.trim() || sending}
                  className={`p-2.5 rounded-xl transition-colors ${!inputMsg.trim() || sending ? 'bg-slate-100 text-slate-400' : 'bg-primary-600 text-white hover:bg-primary-700'}`}>
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
