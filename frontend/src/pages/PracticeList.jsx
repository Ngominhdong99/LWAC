import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, PenTool, Headphones, CheckCircle, Eye, PlayCircle } from 'lucide-react';
import API_URL from '../api';

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
                const response = await axios.get(`${API_URL}/coach/students/${user.id}/assignments`);
                const mapped = response.data.map(a => {
                  const lessonId = a.lesson_id;
                  const type = a.lesson_type;
                  // Check localStorage for in-progress work
                  const storageKey = `lwac_${type}_${user.id}_${lessonId}`;
                  let hasProgress = false;
                  try {
                    const saved = localStorage.getItem(storageKey);
                    if (saved) {
                      if (type === 'writing') {
                        hasProgress = saved.trim().length > 0;
                      } else {
                        const parsed = JSON.parse(saved);
                        hasProgress = (parsed.answers && Object.keys(parsed.answers).length > 0) || 
                                      (parsed.fillAnswers && Object.keys(parsed.fillAnswers).length > 0);
                      }
                    }
                  } catch (e) { /* ignore */ }
                  return {
                    id: lessonId,
                    title: a.lesson_title,
                    type: type,
                    status: a.status,
                    score: a.score,
                    assignment_id: a.id,
                    allow_retake: a.allow_retake || false,
                    hasProgress
                  };
                });
                setLessons(mapped);
            } catch (error) {
                console.error("Error fetching assignments:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAssignments();
    }, [user]);

    const getTestPath = (lesson) => {
        if (lesson.type === 'writing') return `/writing/${lesson.id}`;
        if (lesson.type === 'listening') return `/listening/${lesson.id}`;
        return `/reading/${lesson.id}`;
    };

    const handleStartTest = (lesson) => {
        navigate(getTestPath(lesson));
    };

    const handleViewResult = (lesson) => {
        navigate(`${getTestPath(lesson)}?view=true`);
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
                    const isInProgress = !isCompleted && lesson.hasProgress;

                    return (
                    <div key={lesson.assignment_id} className={`bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow cursor-pointer flex flex-col h-full group ${isCompleted ? 'opacity-80' : ''} ${isInProgress ? 'border-l-4 border-l-blue-400' : ''}`}>
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
                            {isInProgress && (
                              <span className="text-xs font-bold text-blue-500 flex items-center">
                                <PlayCircle size={14} className="mr-1" />
                                In Progress
                              </span>
                            )}
                            {!isCompleted && !isInProgress && <span className="text-xs font-bold text-amber-500">Pending</span>}
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-primary-700 transition-colors">{lesson.title}</h2>
                        <p className="text-slate-500 text-sm mb-6 flex-grow">
                          {isCompleted ? 'You have completed this test.' : isInProgress ? 'You have unsaved progress. Continue your test.' : 'Waiting for you to complete.'}
                        </p>
                        
                        {isCompleted ? (
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleViewResult(lesson)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 font-medium rounded-xl bg-primary-100 text-primary-700 hover:bg-primary-200 transition-all"
                            >
                              <Eye size={15} /> View
                            </button>
                            <button 
                              onClick={() => lesson.allow_retake && handleStartTest(lesson)}
                              disabled={!lesson.allow_retake}
                              title={!lesson.allow_retake ? 'Coach must allow retake' : 'Retake this test'}
                              className={`flex-1 py-2.5 font-medium rounded-xl transition-all ${
                                lesson.allow_retake
                                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer'
                                  : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                              }`}
                            >
                              Retake
                            </button>
                          </div>
                        ) : isInProgress ? (
                          <button 
                            onClick={() => handleStartTest(lesson)}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 font-medium rounded-xl bg-blue-100 text-blue-700 hover:bg-blue-200 transition-all"
                          >
                            <PlayCircle size={15} /> Continue Test
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleStartTest(lesson)}
                            className="w-full py-2.5 font-medium rounded-xl bg-primary-100 text-primary-700 hover:bg-primary-200 transition-all"
                          >
                            Start Test
                          </button>
                        )}
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
