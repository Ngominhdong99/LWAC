import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, PenTool, Headphones, Mic, CheckCircle, Eye, PlayCircle, ChevronDown, ChevronUp, FolderOpen } from 'lucide-react';
import API_URL from '../api';

const TYPE_CONFIG = {
  reading:   { label: 'Reading',   color: 'bg-primary-50 text-primary-700', borderColor: 'border-primary-200', icon: BookOpen,   btnBg: 'bg-primary-100 text-primary-700 hover:bg-primary-200' },
  writing:   { label: 'Writing',   color: 'bg-amber-50 text-amber-700',     borderColor: 'border-amber-200',   icon: PenTool,    btnBg: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
  listening: { label: 'Listening', color: 'bg-violet-50 text-violet-700',   borderColor: 'border-violet-200',  icon: Headphones, btnBg: 'bg-violet-100 text-violet-700 hover:bg-violet-200' },
  speaking:  { label: 'Speaking',  color: 'bg-rose-50 text-rose-700',       borderColor: 'border-rose-200',    icon: Mic,        btnBg: 'bg-rose-100 text-rose-700 hover:bg-rose-200' },
};

// Extract group key from title: "Week 1 - Reading" -> "Week 1", or use chapter field
const getGroupKey = (lesson) => {
  if (lesson.chapter && lesson.chapter.trim()) return lesson.chapter.trim();
  const dashMatch = lesson.title?.match(/^(.+?)\s*[-\u2013\u2014]\s*/);
  if (dashMatch) return dashMatch[1].trim();
  return 'General';
};

const PracticeList = () => {
    const { user } = useAuth();
    const [lessons, setLessons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [collapsedSections, setCollapsedSections] = useState({});
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) return;
        const fetchAssignments = async () => {
            try {
                const response = await axios.get(`${API_URL}/coach/students/${user.id}/assignments`);
                const mapped = response.data.map(a => {
                  const lessonId = a.lesson_id;
                  const type = a.lesson_type;
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
                    chapter: a.lesson_chapter || '',
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
        if (lesson.type === 'speaking') return `/speaking/${lesson.id}`;
        return `/reading/${lesson.id}`;
    };

    const handleStartTest = (lesson) => navigate(getTestPath(lesson));
    const handleViewResult = (lesson) => navigate(`${getTestPath(lesson)}?view=true`);

    const toggleSection = (key) => {
      setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const filteredLessons = filter === 'all' ? lessons : lessons.filter(l => l.type === filter);
    const counts = {
      all: lessons.length,
      reading: lessons.filter(l => l.type === 'reading').length,
      writing: lessons.filter(l => l.type === 'writing').length,
      listening: lessons.filter(l => l.type === 'listening').length,
      speaking: lessons.filter(l => l.type === 'speaking').length,
    };

    // Group filtered lessons by section
    const grouped = {};
    filteredLessons.forEach(lesson => {
      const key = getGroupKey(lesson);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(lesson);
    });
    const groupKeys = Object.keys(grouped);

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
                { key: 'speaking',  label: 'Speaking' },
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

            {/* Grouped Sections */}
            <div className="space-y-5">
              {groupKeys.map(groupKey => {
                const groupLessons = grouped[groupKey];
                const completedCount = groupLessons.filter(l => l.status === 'completed').length;
                const totalCount = groupLessons.length;
                const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                const isCollapsed = collapsedSections[groupKey];

                return (
                  <div key={groupKey} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    {/* Section Header */}
                    <button
                      onClick={() => toggleSection(groupKey)}
                      className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-sm">
                          <FolderOpen size={18} className="text-white" />
                        </div>
                        <div className="text-left">
                          <h2 className="text-lg font-bold text-slate-800">{groupKey}</h2>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {completedCount}/{totalCount} completed
                            {groupLessons.length > 0 && (
                              <span className="ml-2">
                                {[...new Set(groupLessons.map(l => l.type))].map(t => TYPE_CONFIG[t]?.label).join(' \u00b7 ')}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        {/* Mini progress bar */}
                        <div className="hidden sm:flex items-center space-x-2">
                          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${progressPct === 100 ? 'bg-green-500' : 'bg-primary-500'}`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <span className={`text-xs font-bold ${progressPct === 100 ? 'text-green-600' : 'text-slate-500'}`}>{progressPct}%</span>
                        </div>
                        {isCollapsed ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronUp size={18} className="text-slate-400" />}
                      </div>
                    </button>

                    {/* Section Body */}
                    {!isCollapsed && (
                      <div className="px-5 pb-5 pt-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {groupLessons.map(lesson => {
                            const config = TYPE_CONFIG[lesson.type] || TYPE_CONFIG.reading;
                            const Icon = config.icon;
                            const isCompleted = lesson.status === 'completed';
                            const isInProgress = !isCompleted && lesson.hasProgress;

                            // Extract the part after " - " as the display title within the group
                            const displayTitle = lesson.title?.replace(/^.+?\s*[-\u2013\u2014]\s*/, '') || lesson.title;

                            return (
                              <div key={lesson.assignment_id} className={`p-4 rounded-xl border transition-all hover:shadow-md cursor-pointer flex flex-col ${isCompleted ? 'bg-slate-50/50 border-slate-100' : isInProgress ? 'bg-blue-50/30 border-blue-200 border-l-4' : `bg-white ${config.borderColor}`}`}>
                                <div className="flex justify-between items-start mb-3">
                                  <span className={`inline-flex items-center space-x-1 px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider ${config.color}`}>
                                    <Icon size={12} />
                                    <span>{config.label}</span>
                                  </span>
                                  {isCompleted && (
                                    <span className="text-xs font-bold text-green-600 flex items-center bg-green-50 px-2 py-0.5 rounded-md">
                                      <CheckCircle size={12} className="mr-1" />
                                      {lesson.score}%
                                    </span>
                                  )}
                                  {isInProgress && (
                                    <span className="text-xs font-bold text-blue-500 flex items-center bg-blue-50 px-2 py-0.5 rounded-md">
                                      <PlayCircle size={12} className="mr-1" />
                                      In Progress
                                    </span>
                                  )}
                                  {!isCompleted && !isInProgress && <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-md">Pending</span>}
                                </div>

                                <h3 className="text-base font-bold text-slate-800 mb-1 leading-snug">{displayTitle}</h3>
                                {lesson.chapter && lesson.chapter !== groupKey && (
                                  <p className="text-[11px] text-slate-400 mb-3">{lesson.chapter}</p>
                                )}
                                <p className="text-xs text-slate-400 mb-4 flex-grow">
                                  {isCompleted ? 'Completed' : isInProgress ? 'Continue where you left off' : 'Not started yet'}
                                </p>
                                
                                {isCompleted ? (
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => handleViewResult(lesson)}
                                      className="flex-1 flex items-center justify-center gap-1 py-2 text-sm font-semibold rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100 transition-all"
                                    >
                                      <Eye size={14} /> View
                                    </button>
                                    <button 
                                      onClick={() => lesson.allow_retake && handleStartTest(lesson)}
                                      disabled={!lesson.allow_retake}
                                      title={!lesson.allow_retake ? 'Coach must allow retake' : 'Retake this test'}
                                      className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                                        lesson.allow_retake
                                          ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer'
                                          : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                                      }`}
                                    >
                                      Retake
                                    </button>
                                  </div>
                                ) : isInProgress ? (
                                  <button 
                                    onClick={() => handleStartTest(lesson)}
                                    className="w-full flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-all"
                                  >
                                    <PlayCircle size={14} /> Continue
                                  </button>
                                ) : (
                                  <button 
                                    onClick={() => handleStartTest(lesson)}
                                    className={`w-full py-2 text-sm font-semibold rounded-lg transition-all ${config.btnBg}`}
                                  >
                                    Start Test
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredLessons.length === 0 && (
                <div className="py-12 text-center text-slate-500 bg-white rounded-2xl border border-dashed border-slate-300">
                  {filter !== 'all' ? `No assigned ${filter} tests.` : 'You have no assigned tests.'}
                </div>
              )}
            </div>
        </div>
    );
};

export default PracticeList;
