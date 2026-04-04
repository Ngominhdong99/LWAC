import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, Sparkles, Loader2, Volume2, Plus, Check } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import API_URL from '../api';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { useToast } from '../components/Toast';
import { speakNatural } from '../utils/tts';
import { lookupWord } from '../utils/dictionary';

const Hub = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [selection, setSelection] = useState(null);
  const [savedSelection, setSavedSelection] = useState(false);
  const toast = useToast();
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const sessionId = useRef(`session_${user?.id || 'anon'}_${Date.now()}`);
  const isInitialLoad = useRef(true);

  // Load chat history on mount
  useEffect(() => {
    if (!user) return;
    const loadHistory = async () => {
      try {
        const res = await axios.get(`${API_URL}/chat/ai/history/${user.id}?limit=30`);
        const mapped = res.data.map(m => ({
          id: m.id,
          dbId: m.id,
          sender: m.role === 'user' ? 'student' : 'ai',
          text: m.message,
          time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
        setMessages(mapped);
        setHasMore(mapped.length >= 30);
      } catch (e) { console.error(e); }
      finally { setLoadingHistory(false); }
    };
    loadHistory();
  }, [user]);

  // Scroll to bottom on initial load and new messages
  useEffect(() => {
    if (isInitialLoad.current && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView();
      isInitialLoad.current = false;
    } else if (!isInitialLoad.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Load older messages on scroll to top
  const handleScroll = useCallback(() => {
    const container = chatContainerRef.current;
    if (!container || !hasMore || loadingHistory) return;
    if (container.scrollTop < 80) {
      const oldestId = messages.length > 0 ? messages[0].dbId : null;
      if (!oldestId) return;
      setLoadingHistory(true);
      const prevHeight = container.scrollHeight;
      axios.get(`${API_URL}/chat/ai/history/${user.id}?limit=20&before_id=${oldestId}`)
        .then(res => {
          const older = res.data.map(m => ({
            id: m.id,
            dbId: m.id,
            sender: m.role === 'user' ? 'student' : 'ai',
            text: m.message,
            time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }));
          if (older.length === 0) { setHasMore(false); return; }
          setHasMore(older.length >= 20);
          setMessages(prev => [...older, ...prev]);
          // Maintain scroll position
          requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight - prevHeight;
          });
        })
        .catch(console.error)
        .finally(() => setLoadingHistory(false));
    }
  }, [hasMore, loadingHistory, messages, user]);

  useEffect(() => {
    const handleSelectionChange = () => {
      if (!chatContainerRef.current) return;
      
      const sel = window.getSelection();
      if (!sel.rangeCount || sel.isCollapsed) {
        setSelection(null);
        return;
      }
      
      const range = sel.getRangeAt(0);
      if (chatContainerRef.current.contains(range.commonAncestorContainer)) {
        // Ensure the selection isn't inside an input or textarea
        let currentElement = range.commonAncestorContainer;
        if (currentElement.nodeType === 3) currentElement = currentElement.parentNode;
        
        const isInteractive = currentElement.closest('button, input, textarea');
        if (isInteractive) {
           setSelection(null);
           return;
        }

        const text = sel.toString().trim();
        if (text) {
          const rect = range.getBoundingClientRect();
          setSelection({
            text,
            rect,
          });
          setSavedSelection(false);
        } else {
          setSelection(null);
        }
      } else {
        setSelection(null);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  const playAudio = (text) => {
    if (text) {
      speakNatural(text);
    }
  };

  const saveToVocabVault = async (text) => {
    if (!text || savedSelection) return;
    try {
      const entry = await lookupWord(text);
      if (!entry) {
        toast.error('Could not find translation for this word.');
        return;
      }
      await axios.post(`${API_URL}/vocab/vault`, {
        user_id: user.id,
        word: entry.word,
        translation: entry.translation,
        ipa: entry.ipa,
        type: entry.type,
      });
      setSavedSelection(true);
      toast.success(`Saved "${text}" to Vault!`);
      setTimeout(() => {
        window.getSelection().empty();
        setSelection(null);
      }, 1000);
    } catch (err) {
      toast.error('Failed to save to Vault.');
      console.error(err);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isAiTyping) return;

    const userMsg = {
      id: Date.now(),
      sender: 'student',
      text: inputMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const currentInput = inputMessage;
    setInputMessage('');
    setMessages(prev => [...prev, userMsg]);
    setIsAiTyping(true);

    try {
      const response = await axios.post(`${API_URL}/chat/`, {
        session_id: sessionId.current,
        message: currentInput,
        user_id: user?.id || null
      });

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'ai',
        text: response.data.reply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } catch (error) {
      console.error("AI Chat error:", error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'ai',
        text: 'Sorry, I couldn\'t connect to the AI service. Please try again.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setIsAiTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] md:h-screen bg-secondary p-4 md:p-6 lg:p-8 max-w-4xl mx-auto w-full">
      <header className="mb-4">
        <div className="flex items-center space-x-3">
          <div className="bg-purple-100 text-purple-600 p-2.5 rounded-xl">
            <Sparkles size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">AI Assistant</h1>
            <p className="text-slate-500 text-sm">Your personal IELTS tutor — ask anything!</p>
          </div>
        </div>
      </header>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {/* Chat Area */}
        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50 relative"
        >
          {/* Floating Action Menu for Text Selection */}
          {selection && (
            <div 
              className="fixed z-[100] animate-in fade-in zoom-in-95 duration-200"
              style={{
                top: Math.max(10, selection.rect.top - 60) + 'px',
                left: selection.rect.left + (selection.rect.width / 2) + 'px',
                transform: 'translateX(-50%)' // Center exactly over the word
              }}
            >
              <div className="bg-slate-900 shadow-xl rounded-xl flex items-center p-1.5 text-white/90 gap-1 ring-1 ring-slate-800/50">
                <button 
                  onClick={() => playAudio(selection.text)}
                  className="p-2 hover:bg-slate-800 hover:text-white rounded-lg transition-colors flex items-center gap-2"
                  title="Listen"
                >
                  <Volume2 size={16} />
                </button>
                <button 
                  onClick={() => saveToVocabVault(selection.text)}
                  className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${savedSelection ? 'text-emerald-400 bg-emerald-400/10' : 'hover:bg-slate-800 hover:text-amber-400'}`}
                  title="Save to Vault"
                >
                  {savedSelection ? <Check size={16} /> : <Plus size={16} />}
                </button>
              </div>
              <div className="w-3 h-3 bg-slate-900 absolute left-1/2 -bottom-1.5 transform -translate-x-1/2 rotate-45 border-r border-b border-slate-800/50"></div>
            </div>
          )}
          {/* Loading older indicator */}
          {loadingHistory && messages.length > 0 && (
            <div className="flex justify-center py-2">
              <Loader2 size={18} className="animate-spin text-purple-400" />
            </div>
          )}

          {/* Empty state */}
          {!loadingHistory && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center space-y-3 my-8 opacity-70">
              <div className="bg-purple-100 text-purple-600 p-4 rounded-full">
                <Bot size={32} />
              </div>
              <p className="text-slate-500 font-medium text-center">I'm your AI IELTS Assistant.<br/>Ask me to explain grammar, translate phrases, or score your writing drafts!</p>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {['Explain passive voice', 'IELTS Writing tips', 'Vocabulary: Education'].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => setInputMessage(suggestion)}
                    className="px-3 py-1.5 bg-purple-50 text-purple-600 rounded-full text-sm font-medium hover:bg-purple-100 transition-colors border border-purple-100"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Initial loading */}
          {loadingHistory && messages.length === 0 && (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="animate-spin text-purple-400" />
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'student' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[80%] md:max-w-[70%] rounded-2xl p-4 shadow-sm ${
                  msg.sender === 'student'
                    ? 'bg-purple-600 text-white rounded-br-none'
                    : 'bg-white border border-slate-200 border-l-4 border-l-purple-500 text-slate-800 rounded-bl-none'
                }`}
              >
                {msg.sender === 'ai' ? (
                  <MarkdownRenderer>{msg.text}</MarkdownRenderer>
                ) : (
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                )}
              </div>
              <span className="text-xs text-slate-400 mt-1 px-1">{msg.time}</span>
            </div>
          ))}

          {isAiTyping && (
            <div className="flex flex-col items-start">
              <div className="bg-white border border-slate-200 border-l-4 border-l-purple-500 rounded-2xl rounded-bl-none p-4 shadow-sm flex items-center space-x-2">
                <Loader2 size={16} className="animate-spin text-purple-500" />
                <span className="text-sm text-slate-500">AI is thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-200">
          <form onSubmit={handleSendMessage} className="flex space-x-3">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask the AI assistant..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              disabled={isAiTyping}
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isAiTyping}
              className={`p-3 rounded-xl flex items-center justify-center transition-all ${
                !inputMessage.trim() || isAiTyping
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700 shadow-md hover:shadow-lg'
              }`}
            >
              <Send size={20} className={inputMessage.trim() ? "translate-x-0.5 -translate-y-0.5" : ""} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Hub;
