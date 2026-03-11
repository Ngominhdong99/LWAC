import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Sparkles, Loader2 } from 'lucide-react';
import axios from 'axios';

const Hub = () => {
  const [teacherMessages, setTeacherMessages] = useState([
    { id: 1, sender: 'teacher', text: 'Hi Learner! How was your reading practice today?', time: '10:00 AM' },
    { id: 2, sender: 'student', text: 'It was good, but the History of Tea passage had a lot of new words.', time: '10:05 AM' },
    { id: 3, sender: 'teacher', text: 'That\'s normal! Make sure you use the Smart Hover feature to add them to your Vocab Vault.', time: '10:07 AM' }
  ]);

  const [aiMessages, setAiMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [activeTab, setActiveTab] = useState('teacher'); // 'teacher' or 'ai'
  const [isAiTyping, setIsAiTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const sessionId = useRef(`session_${Date.now()}`);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [teacherMessages, aiMessages, activeTab]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const userMsg = {
      id: Date.now(),
      sender: 'student',
      text: inputMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const currentInput = inputMessage;
    setInputMessage('');

    if (activeTab === 'teacher') {
      setTeacherMessages(prev => [...prev, userMsg]);
      // Mock teacher response
      setTimeout(() => {
        setTeacherMessages(prev => [...prev, {
          id: Date.now() + 1,
          sender: 'teacher',
          text: 'Got it! I will review your scores shortly.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      }, 1000);
    } else {
      // AI Tab: Call real backend API
      setAiMessages(prev => [...prev, userMsg]);
      setIsAiTyping(true);

      try {
        const response = await axios.post('http://127.0.0.1:8000/chat/', {
          session_id: sessionId.current,
          message: currentInput
        });

        setAiMessages(prev => [...prev, {
          id: Date.now() + 1,
          sender: 'ai',
          text: response.data.reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      } catch (error) {
        console.error("AI Chat error:", error);
        setAiMessages(prev => [...prev, {
          id: Date.now() + 1,
          sender: 'ai',
          text: 'Sorry, I couldn\'t connect to the AI service. Please try again.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      } finally {
        setIsAiTyping(false);
      }
    }
  };

  const currentMessages = activeTab === 'teacher' ? teacherMessages : aiMessages;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] md:h-screen bg-secondary p-4 md:p-6 lg:p-8 max-w-6xl mx-auto w-full">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Communication Hub</h1>
        <p className="text-slate-500 mt-1">Chat directly with your coach or get instant AI help.</p>
      </header>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          <button
            onClick={() => setActiveTab('teacher')}
            className={`flex-1 flex justify-center items-center space-x-2 py-4 font-semibold transition-colors ${
              activeTab === 'teacher' 
                ? 'text-primary-700 bg-white border-b-2 border-primary-500' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            <User size={18} />
            <span>Coach Chat</span>
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex-1 flex justify-center items-center space-x-2 py-4 font-semibold transition-colors ${
              activeTab === 'ai' 
                ? 'text-purple-700 bg-white border-b-2 border-purple-500' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Sparkles size={18} className={activeTab === 'ai' ? 'text-purple-500' : ''} />
            <span>AI Assistant</span>
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50">
          {activeTab === 'ai' && aiMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center space-y-3 my-8 opacity-70">
              <div className="bg-purple-100 text-purple-600 p-4 rounded-full">
                <Bot size={32} />
              </div>
              <p className="text-slate-500 font-medium text-center">I'm your AI IELTS Assistant.<br/>Ask me to explain grammar, translate phrases, or score your writing drafts!</p>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {['Explain passive voice', 'IELTS Writing tips', 'Vocabulary: Education'].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => { setInputMessage(suggestion); }}
                    className="px-3 py-1.5 bg-purple-50 text-purple-600 rounded-full text-sm font-medium hover:bg-purple-100 transition-colors border border-purple-100"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentMessages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex flex-col ${msg.sender === 'student' ? 'items-end' : 'items-start'}`}
            >
              <div 
                className={`max-w-[80%] md:max-w-[70%] rounded-2xl p-4 shadow-sm ${
                  msg.sender === 'student' 
                    ? activeTab === 'ai'
                      ? 'bg-purple-600 text-white rounded-br-none'
                      : 'bg-primary-600 text-white rounded-br-none'
                    : msg.sender === 'ai'
                      ? 'bg-white border border-slate-200 border-l-4 border-l-purple-500 text-slate-800 rounded-bl-none'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                }`}
              >
                <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              </div>
              <span className="text-xs text-slate-400 mt-1 px-1">{msg.time}</span>
            </div>
          ))}

          {isAiTyping && (
            <div className="flex flex-col items-start">
              <div className="bg-white border border-slate-200 border-l-4 border-l-purple-500 rounded-2xl rounded-bl-none p-4 shadow-sm flex items-center space-x-2">
                <Loader2 size={16} className="animate-spin text-purple-500" />
                <span className="text-sm text-slate-500">Coach is thinking...</span>
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
              placeholder={activeTab === 'teacher' ? "Message your coach..." : "Ask the AI assistant..."}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              disabled={isAiTyping}
            />
            <button 
              type="submit"
              disabled={!inputMessage.trim() || isAiTyping}
              className={`p-3 rounded-xl flex items-center justify-center transition-all ${
                !inputMessage.trim() || isAiTyping
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                  : activeTab === 'teacher'
                    ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-md hover:shadow-lg'
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
