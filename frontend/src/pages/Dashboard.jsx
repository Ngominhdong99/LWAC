import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { BookOpen, PenTool, Headphones, ChevronRight } from 'lucide-react';

const TYPE_CONFIG = {
  reading:   { label: 'Reading',   color: 'text-primary-600', bg: 'bg-primary-50', icon: BookOpen },
  writing:   { label: 'Writing',   color: 'text-amber-600',     bg: 'bg-amber-50', icon: PenTool },
  listening: { label: 'Listening', color: 'text-violet-600',   bg: 'bg-violet-50', icon: Headphones },
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ pending: 0, vocab: 0 });
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const [assignmentsRes, vocabRes] = await Promise.all([
          axios.get(`http://127.0.0.1:8000/coach/students/${user.id}/assignments`),
          axios.get(`http://127.0.0.1:8000/vocab/${user.id}`)
        ]);
        
        const allAssignments = assignmentsRes.data || [];
        const pendingAssigned = allAssignments.filter(a => a.status === 'pending');
        
        setAssignments(pendingAssigned);
        setStats({
          pending: pendingAssigned.length,
          vocab: vocabRes.data.length
        });
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleStartTest = (assignment) => {
      navigate(`/${assignment.lesson_type}/${assignment.lesson_id}`);
  };

  if (loading) return <div className="p-8 flex justify-center items-center h-[calc(100vh-100px)]"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>;

  return (
    <div className="p-6 pb-24 md:pb-6 space-y-6 max-w-5xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Welcome back, {user?.full_name?.split(' ')[0] || 'Learner'}! 👋</h1>
        <p className="text-slate-500 mt-1">You have {stats.pending} pending assigned {stats.pending === 1 ? 'task' : 'tasks'}.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Stat Cards */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <h3 className="text-slate-500 font-medium tracking-wide text-sm uppercase">Assigned Tasks</h3>
            <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs font-semibold">To Do</span>
          </div>
          <p className="text-4xl font-bold text-slate-800 mt-4">{stats.pending}</p>
        </div>

        <div onClick={() => navigate('/vocab')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <h3 className="text-slate-500 font-medium tracking-wide text-sm uppercase">Vocab Vault</h3>
            <span className="bg-amber-50 text-amber-600 px-2 py-1 rounded text-xs font-semibold">Saved Words</span>
          </div>
          <p className="text-4xl font-bold text-slate-800 mt-4">{stats.vocab}</p>
        </div>
      </div>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Your Assigned Tests</h2>
          {assignments.length === 0 ? (
            <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              You're all caught up! No pending assignments from your coach at the moment.
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map(a => {
                const config = TYPE_CONFIG[a.lesson_type] || TYPE_CONFIG.reading;
                const Icon = config.icon;
                return (
                  <div key={a.id} onClick={() => handleStartTest(a)} className="p-4 border border-slate-100 rounded-xl bg-slate-50 hover:bg-primary-50 hover:border-primary-100 transition-colors cursor-pointer flex items-center group">
                      <div className={`p-3 rounded-xl mr-4 ${config.bg} ${config.color}`}>
                        <Icon size={24} />
                      </div>
                      <div className="flex-1">
                          <h3 className="font-semibold text-slate-800 group-hover:text-primary-700 transition-colors uppercase tracking-wide text-xs">{config.label}</h3>
                          <p className="text-slate-700 font-medium mt-0.5">{a.lesson_title}</p>
                      </div>
                      <div className="bg-white w-10 h-10 rounded-full shadow-sm flex items-center justify-center text-primary-600 font-bold group-hover:bg-primary-600 group-hover:text-white transition-colors">
                          <ChevronRight size={20} />
                      </div>
                  </div>
                )
              })}
            </div>
          )}
      </section>
    </div>
  );
};

export default Dashboard;
