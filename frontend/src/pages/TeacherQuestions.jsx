import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { HelpCircle, CheckCircle, Send, Clock } from 'lucide-react';
import API_URL from '../api';

const TeacherQuestions = () => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [answerText, setAnswerText] = useState({});

  const fetchQuestions = async () => {
    try {
      const url = filter === 'all' ? `${API_URL}/coach/questions` : `${API_URL}/coach/questions?status=${filter}`;
      const res = await axios.get(url);
      setQuestions(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchQuestions(); }, [filter]);

  const handleAnswer = async (id) => {
    const answer = answerText[id];
    if (!answer?.trim()) return;
    try {
      await axios.put(`${API_URL}/coach/questions/${id}/answer`, { answer });
      setAnswerText(prev => ({ ...prev, [id]: '' }));
      fetchQuestions();
    } catch (e) { console.error(e); }
  };

  if (loading) return <div className="p-8 flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>;

  return (
    <div className="p-6 pb-24 md:pb-6 space-y-6 max-w-4xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Student Questions</h1>
        <p className="text-slate-500 mt-1">Answer questions from your students</p>
      </header>

      <div className="flex gap-2">
        {['all', 'pending', 'answered'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all ${filter === f ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {questions.map(q => (
          <div key={q.id} className={`bg-white p-5 rounded-2xl shadow-sm border ${q.status === 'pending' ? 'border-amber-200' : 'border-slate-100'}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${q.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                  {q.status === 'pending' ? <Clock size={18} /> : <CheckCircle size={18} />}
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{q.student_name}</p>
                  <p className="text-xs text-slate-400">{new Date(q.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${q.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                {q.status}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl mb-3">
              <p className="text-slate-700 text-sm font-medium">{q.question_text}</p>
              {q.context && <p className="text-xs text-slate-400 mt-2 italic">Context: {q.context}</p>}
            </div>

            {q.status === 'answered' && q.answer && (
              <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                <p className="text-sm text-green-800"><span className="font-semibold">Your answer:</span> {q.answer}</p>
              </div>
            )}

            {q.status === 'pending' && (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={answerText[q.id] || ''}
                  onChange={e => setAnswerText(prev => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Type your answer..."
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button onClick={() => handleAnswer(q.id)} disabled={!answerText[q.id]?.trim()}
                  className={`p-2.5 rounded-xl transition-colors ${!answerText[q.id]?.trim() ? 'bg-slate-100 text-slate-400' : 'bg-primary-600 text-white hover:bg-primary-700'}`}>
                  <Send size={16} />
                </button>
              </div>
            )}
          </div>
        ))}

        {questions.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <HelpCircle size={48} className="mx-auto mb-3 opacity-30" />
            <p>No {filter !== 'all' ? filter : ''} questions yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherQuestions;
