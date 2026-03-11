import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, PenTool, Headphones, CheckCircle } from 'lucide-react';

const TYPE_CONFIG = {
  reading:   { label: 'Reading',   color: 'bg-primary-50 text-primary-700', icon: BookOpen,   btnHover: 'hover:bg-primary-600' },
  writing:   { label: 'Writing',   color: 'bg-amber-50 text-amber-700',     icon: PenTool,    btnHover: 'hover:bg-amber-600' },
  listening: { label: 'Listening', color: 'bg-violet-50 text-violet-700',   icon: Headphones, btnHover: 'hover:bg-violet-600' },
};

const PracticeList = () => {
    const { user } = useAuth();
    const [lessons, setLessons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) return;
        const fetchAssignments = async () => {
            try {
                const response = await axios.get(`http://127.0.0.1:8000/coach/students/${user.id}/assignments`);
                const mapped = response.data.map(a => ({
                  id: a.lesson_id,
                  title: a.lesson_title,
                  type: a.lesson_type,
                  status: a.status,
                  score: a.score,
                  assignment_id: a.id
                }));
                setLessons(mapped);
            } catch (error) {
                console.error("Error fetching assignments:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAssignments();
    }, [user]);

    const handleStartTest = (lesson) => {
        if (lesson.type === 'writing') {
            navigate(`/writing/${lesson.id}`);
        } else if (lesson.type === 'listening') {
            navigate(`/listening/${lesson.id}`);
        } else {
            navigate(`/reading/${lesson.id}`);
        }
    };

    const filteredLessons = filter === 'all' ? lessons : lessons.filter(l => l.type === filter);
    const counts = {
      all: lessons.length,
      reading: lessons.filter(l => l.type === 'reading').length,
      writing: lessons.filter(l => l.type === 'writing').length,
      listening: lessons.filter(l => l.type === 'listening').length,
    };

    if (loading) return <div className="p-8 flex justify-center items-center h-[calc(100vh-100px)]"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>;

    return (
        <div className="p-6 pb-24 md:pb-6 space-y-6 max-w-7xl mx-auto">
            <header>
                <h1 className="text-3xl font-bold text-slate-800 tracking-tight">My Assignments</h1>
                <p className="text-slate-500 mt-1">Tests assigned to you by your coach.</p>
            </header>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all',       label: 'All' },
                { key: 'reading',   label: 'Reading' },
                { key: 'writing',   label: 'Writing' },
                { key: 'listening', label: 'Listening' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    filter === tab.key
                      ? 'bg-slate-800 text-white shadow-md'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {tab.label} <span className="ml-1 opacity-70">({counts[tab.key]})</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredLessons.map(lesson => {
                    const config = TYPE_CONFIG[lesson.type] || TYPE_CONFIG.reading;
                    const Icon = config.icon;
                    const isCompleted = lesson.status === 'completed';

                    return (
                    <div key={lesson.assignment_id} className={`bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow cursor-pointer flex flex-col h-full group ${isCompleted ? 'opacity-80' : ''}`}>
                        <div className="mb-4 flex justify-between items-center">
                            <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold rounded-md uppercase tracking-wide ${config.color}`}>
                                <Icon size={14} />
                                <span>{config.label}</span>
                            </span>
                            {isCompleted && (
                              <span className="text-xs font-bold text-green-600 flex items-center">
                                <CheckCircle size={14} className="mr-1" />
                                {lesson.score}% Score
                              </span>
                            )}
                            {!isCompleted && <span className="text-xs font-bold text-amber-500">Pending</span>}
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-primary-700 transition-colors">{lesson.title}</h2>
                        <p className="text-slate-500 text-sm mb-6 flex-grow">{isCompleted ? 'You have completed this test.' : 'Waiting for you to complete.'}</p>
                        
                        <button 
                            onClick={() => handleStartTest(lesson)}
                            className={`w-full py-2.5 font-medium rounded-xl transition-all ${isCompleted ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-primary-100 text-primary-700 hover:bg-primary-200'}`}
                        >
                            {isCompleted ? 'Retake Test' : 'Start Test'}
                        </button>
                    </div>
                    );
                })}
                
                {filteredLessons.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-2xl border border-dashed border-slate-300">
                        {filter !== 'all' ? `No assigned ${filter} tests.` : 'You have no assigned tests.'}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PracticeList;
