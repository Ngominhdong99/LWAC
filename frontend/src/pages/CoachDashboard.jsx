import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Users, HelpCircle, TrendingUp, BookOpen, ChevronRight, Plus } from 'lucide-react';

const CoachDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [pendingQuestions, setPendingQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studentsRes, questionsRes] = await Promise.all([
          axios.get('http://127.0.0.1:8000/coach/students'),
          axios.get('http://127.0.0.1:8000/coach/questions?status=pending')
        ]);
        setStudents(studentsRes.data);
        setPendingQuestions(questionsRes.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const avgScore = students.length > 0
    ? Math.round(students.reduce((sum, s) => sum + s.avg_score, 0) / students.length)
    : 0;

  if (loading) return <div className="p-8 flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>;

  return (
    <div className="p-6 pb-24 md:pb-6 space-y-6 max-w-7xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Coach Dashboard</h1>
        <p className="text-slate-500 mt-1">Welcome back, {user?.full_name || 'Coach'}!</p>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="bg-primary-50 p-3 rounded-xl"><Users size={24} className="text-primary-600" /></div>
          <div><p className="text-2xl font-bold text-slate-800">{students.length}</p><p className="text-sm text-slate-500">Students</p></div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="bg-amber-50 p-3 rounded-xl"><HelpCircle size={24} className="text-amber-600" /></div>
          <div><p className="text-2xl font-bold text-slate-800">{pendingQuestions.length}</p><p className="text-sm text-slate-500">Pending Questions</p></div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="bg-green-50 p-3 rounded-xl"><TrendingUp size={24} className="text-green-600" /></div>
          <div><p className="text-2xl font-bold text-slate-800">{avgScore}%</p><p className="text-sm text-slate-500">Avg Score</p></div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Students List */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-800">Students</h2>
            <button onClick={() => navigate('/coach/students')} className="text-sm text-primary-600 hover:text-primary-700 font-semibold flex items-center">
              Manage <ChevronRight size={16} />
            </button>
          </div>
          <div className="space-y-3">
            {students.slice(0, 5).map(s => (
              <div key={s.id} onClick={() => navigate('/coach/students')} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: s.avatar_color }}>
                    {(s.full_name || s.username)[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{s.full_name || s.username}</p>
                    <p className="text-xs text-slate-500">{s.tests_completed} tests • {s.avg_score}% avg</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400" />
              </div>
            ))}
            {students.length === 0 && <p className="text-slate-400 text-sm py-4 text-center">No students yet</p>}
          </div>
        </div>

        {/* Pending Questions */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-800">Pending Questions</h2>
            <button onClick={() => navigate('/coach/questions')} className="text-sm text-primary-600 hover:text-primary-700 font-semibold flex items-center">
              View All <ChevronRight size={16} />
            </button>
          </div>
          <div className="space-y-3">
            {pendingQuestions.slice(0, 5).map(q => (
              <div key={q.id} onClick={() => navigate('/coach/questions')} className="p-3 bg-amber-50 border border-amber-100 rounded-xl hover:bg-amber-100 cursor-pointer transition-colors">
                <p className="font-semibold text-slate-800 text-sm">{q.student_name}</p>
                <p className="text-sm text-slate-600 mt-1 line-clamp-2">{q.question_text}</p>
              </div>
            ))}
            {pendingQuestions.length === 0 && <p className="text-slate-400 text-sm py-4 text-center">No pending questions</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoachDashboard;
