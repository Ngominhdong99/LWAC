import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { HelpCircle, Send, X, CheckCircle, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { createPortal } from 'react-dom';
import API_URL from '../api';

const AskTeacherPopup = ({ questionText, questionId, lessonId, onClose }) => {
  const { user } = useAuth();
  const [question, setQuestion] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [existingQ, setExistingQ] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExisting = async () => {
      if (!user || user.role !== 'student') {
        setLoading(false);
        return;
      }
      try {
        const res = await axios.get(`${API_URL}/chat/my-questions/${user.id}`);
        const found = res.data.find(q => q.context === questionText);
        if (found) {
          setExistingQ(found);
        }
      } catch (err) {
        console.error("Failed to check existing questions", err);
      } finally {
        setLoading(false);
      }
    };
    fetchExisting();
  }, [user, questionText]);

  const handleSubmit = async () => {
    if (!question.trim() || !user) return;
    setSending(true);
    try {
      await axios.post(`${API_URL}/chat/ask-teacher`, {
        student_id: user.id,
        question_text: question,
        context: questionText,
        question_id: questionId || null,
        lesson_id: lessonId || null
      });
      setSent(true);
    } catch (e) {
      console.error(e);
      alert('Failed to send question.');
    }
    finally { setSending(false); }
  };

  const modalContent = (() => {
    if (loading) {
      return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={onClose}>
          <div className="bg-white rounded-2xl p-8 flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        </div>
      );
    }

    if (sent) {
      return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={onClose}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={28} className="text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Question Sent!</h3>
            <p className="text-sm text-slate-500 mb-4">Your coach will reply soon. Check the Teacher Hub for the answer.</p>
            <button onClick={onClose} className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold transition-colors">
              Got it!
            </button>
          </div>
        </div>
      );
    }

    if (existingQ) {
      return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={onClose}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-2">
                <div className="bg-amber-100 p-2 rounded-lg"><MessageCircle size={18} className="text-amber-600" /></div>
                <h3 className="text-lg font-bold text-slate-800">Your Question</h3>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X size={18} /></button>
            </div>
            
            <div className="bg-slate-50 p-3 rounded-xl mb-4 border border-slate-200">
              <p className="text-xs text-slate-400 mb-1 font-medium">Context:</p>
              <p className="text-sm text-slate-700 italic">"{existingQ.context}"</p>
            </div>

            <div className="mb-4">
              <p className="font-semibold text-slate-800 text-sm mb-1">You asked:</p>
              <p className="text-sm text-slate-600 bg-blue-50 p-3 rounded-xl border border-blue-100">{existingQ.question_text}</p>
            </div>

            <div className="mb-4">
              <p className="font-semibold text-slate-800 text-sm mb-1">Coach's Reply:</p>
              {existingQ.status === 'answered' ? (
                <div className="text-sm text-slate-700 bg-green-50 p-3 rounded-xl border border-green-200 whitespace-pre-wrap">
                  {existingQ.answer}
                </div>
              ) : (
                <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-100 italic">
                  Waiting for coach to reply...
                </div>
              )}
            </div>

            <button onClick={onClose} className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors">
              Close
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-2">
              <div className="bg-amber-100 p-2 rounded-lg"><HelpCircle size={18} className="text-amber-600" /></div>
              <h3 className="text-lg font-bold text-slate-800">Ask Your Coach</h3>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X size={18} /></button>
          </div>

          {questionText && (
            <div className="bg-slate-50 p-3 rounded-xl mb-4 border border-slate-200">
              <p className="text-xs text-slate-400 mb-1 font-medium">About this:</p>
              <p className="text-sm text-slate-700 line-clamp-3 italic">"{questionText}"</p>
            </div>
          )}

          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="What would you like to ask your coach?"
            className="w-full h-24 px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
            autoFocus
          />

          <button onClick={handleSubmit} disabled={!question.trim() || sending}
            className={`w-full flex items-center justify-center space-x-2 py-3 rounded-xl font-semibold transition-all ${
              !question.trim() || sending ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 text-white shadow-md'
            }`}>
            <Send size={16} />
            <span>{sending ? 'Sending...' : 'Send to Coach'}</span>
          </button>
        </div>
      </div>
    );
  })();

  return createPortal(modalContent, document.body);
};

export default AskTeacherPopup;
