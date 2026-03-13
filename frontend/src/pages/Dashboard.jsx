import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { BookOpen, PenTool, Headphones, ChevronRight, Mic, CalendarCheck, ListTodo, CheckCircle2, Clock } from 'lucide-react';
import API_URL from '../api';

const TYPE_CONFIG = {
  reading:   { label: 'Reading',   color: 'text-primary-600', bg: 'bg-primary-50', icon: BookOpen, chartColor: '#0d9488' },
  writing:   { label: 'Writing',   color: 'text-amber-600',   bg: 'bg-amber-50',   icon: PenTool, chartColor: '#d97706' },
  listening: { label: 'Listening', color: 'text-violet-600',  bg: 'bg-violet-50',  icon: Headphones, chartColor: '#7c3aed' },
  speaking:  { label: 'Speaking',  color: 'text-rose-600',    bg: 'bg-rose-50',    icon: Mic, chartColor: '#e11d48' },
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [allAssignments, setAllAssignments] = useState([]);
  const [vocabCount, setVocabCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const [assignmentsRes, vocabRes] = await Promise.all([
          axios.get(`${API_URL}/coach/students/${user.id}/assignments`),
          axios.get(`${API_URL}/vocab/${user.id}`)
        ]);
        setAllAssignments(assignmentsRes.data || []);
        setVocabCount(vocabRes.data.length);
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

  // Compute stats
  const total = allAssignments.length;
  const completed = allAssignments.filter(a => a.status === 'completed');
  const pending = allAssignments.filter(a => a.status === 'pending');
  const completedCount = completed.length;
  const pendingCount = pending.length;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  // Today stats
  const today = new Date().toISOString().slice(0, 10);
  const assignedToday = allAssignments.filter(a => a.assigned_at && a.assigned_at.slice(0, 10) === today).length;
  const doneToday = completed.filter(a => a.completed_at && a.completed_at.slice(0, 10) === today).length;

  // Breakdown by type (completed)
  const typeBreakdown = {};
  completed.forEach(a => {
    const t = a.lesson_type || 'reading';
    typeBreakdown[t] = (typeBreakdown[t] || 0) + 1;
  });

  // SVG donut chart
  const radius = 70;
  const stroke = 14;
  const circumference = 2 * Math.PI * radius;
  const greenArc = (pct / 100) * circumference;

  if (loading) return <div className="p-8 flex justify-center items-center h-[calc(100vh-100px)]"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>;

  return (
    <div className="p-6 pb-24 md:pb-6 space-y-6 max-w-5xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Welcome back, {user?.full_name?.split(' ')[0] || 'Learner'}! 👋</h1>
        <p className="text-slate-500 mt-1">You have {pendingCount} pending {pendingCount === 1 ? 'task' : 'tasks'}.</p>
      </header>

      {/* Chart + Stats Row */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-5">Progress Overview</h2>
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Donut Chart */}
          <div 
            className="relative cursor-pointer flex-shrink-0"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <svg width="180" height="180" viewBox="0 0 180 180">
              {/* Grey background ring */}
              <circle
                cx="90" cy="90" r={radius}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth={stroke}
              />
              {/* Green progress ring */}
              <circle
                cx="90" cy="90" r={radius}
                fill="none"
                stroke="#22c55e"
                strokeWidth={stroke}
                strokeDasharray={`${greenArc} ${circumference - greenArc}`}
                strokeDashoffset={circumference / 4}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.8s ease' }}
              />
            </svg>
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-slate-800">{completedCount}/{total}</span>
              <span className="text-xs text-slate-500 font-medium">tasks done</span>
            </div>

            {/* Hover Tooltip */}
            {showTooltip && (
              <div className="absolute -right-2 top-1/2 -translate-y-1/2 translate-x-full bg-slate-800 text-white rounded-xl px-4 py-3 shadow-xl z-10 min-w-[160px]">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-slate-800 rotate-45"></div>
                <p className="text-xs font-bold text-slate-300 mb-2 uppercase tracking-wide">Completed by type</p>
                {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
                  <div key={type} className="flex items-center justify-between py-1">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.chartColor }}></span>
                      <span className="text-sm">{cfg.label}</span>
                    </div>
                    <span className="text-sm font-bold">{typeBreakdown[type] || 0}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 flex-1 w-full">
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <div className="flex items-center space-x-2 mb-2">
                <CalendarCheck size={16} className="text-blue-500" />
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Assigned Today</span>
              </div>
              <p className="text-2xl font-black text-slate-800">{assignedToday}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-xl border border-green-100">
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle2 size={16} className="text-green-500" />
                <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">Done Today</span>
              </div>
              <p className="text-2xl font-black text-slate-800">{doneToday}</p>
            </div>
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
              <div className="flex items-center space-x-2 mb-2">
                <Clock size={16} className="text-amber-500" />
                <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Total Pending</span>
              </div>
              <p className="text-2xl font-black text-slate-800">{pendingCount}</p>
            </div>
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
              <div className="flex items-center space-x-2 mb-2">
                <ListTodo size={16} className="text-emerald-500" />
                <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Total Completed</span>
              </div>
              <p className="text-2xl font-black text-slate-800">{completedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <h3 className="text-slate-500 font-medium tracking-wide text-sm uppercase">Pending Tasks</h3>
            <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs font-semibold">To Do</span>
          </div>
          <p className="text-4xl font-bold text-slate-800 mt-4">{pendingCount}</p>
        </div>

        <div onClick={() => navigate('/vocab')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <h3 className="text-slate-500 font-medium tracking-wide text-sm uppercase">Vocab Vault</h3>
            <span className="bg-amber-50 text-amber-600 px-2 py-1 rounded text-xs font-semibold">Saved Words</span>
          </div>
          <p className="text-4xl font-bold text-slate-800 mt-4">{vocabCount}</p>
        </div>
      </div>

      {/* Pending Tasks List */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Your Assigned Tests</h2>
          {pending.length === 0 ? (
            <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              You're all caught up! No pending assignments from your coach at the moment.
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map(a => {
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
