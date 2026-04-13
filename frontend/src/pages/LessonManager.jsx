import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trash2, FileText, Headphones, Edit3, Mic, BookOpen, Search, ChevronDown, ChevronUp, FolderOpen, PenTool, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import API_URL from '../api';
import ConfirmModal from '../components/ConfirmModal';

const TYPE_CONFIG = {
  reading:   { label: 'Reading',   color: 'bg-blue-50 text-blue-700',     icon: FileText,    iconColor: 'text-blue-500' },
  listening: { label: 'Listening', color: 'bg-amber-50 text-amber-700',   icon: Headphones,  iconColor: 'text-amber-500' },
  writing:   { label: 'Writing',   color: 'bg-emerald-50 text-emerald-700', icon: PenTool,   iconColor: 'text-emerald-500' },
  speaking:  { label: 'Speaking',  color: 'bg-purple-50 text-purple-700', icon: Mic,         iconColor: 'text-purple-500' },
};

const getGroupKey = (lesson) => {
  return lesson.chapter || 'Uncategorized';
};

const getChapterSortKey = (lesson) => {
  const ch = lesson.chapter || '';
  const num = ch.match(/(\d+)/);
  return num ? parseInt(num[1], 10) : 9999;
};

const LessonManager = () => {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [collapsedSections, setCollapsedSections] = useState({});
  const navigate = useNavigate();

  const fetchLessons = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/lessons/`);
      setLessons(res.data);
    } catch (e) {
      console.error(e);
      alert('Failed to load lessons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLessons();
  }, []);

  const handleDelete = (id, title) => {
    setConfirmDelete({
      title: 'Delete Lesson?',
      message: `Are you sure you want to delete "${title}"? This will also remove any student assignments and results connected to this lesson.`,
      onConfirm: async () => {
        try {
          await axios.delete(`${API_URL}/lessons/${id}`);
          setLessons(lessons.filter(l => l.id !== id));
        } catch (e) {
          console.error(e);
          alert('Failed to delete lesson.');
        }
      }
    });
  };

  const handleOpenEdit = (lesson) => {
    navigate(`/coach/builder/${lesson.id}`);
  };

  const toggleSection = (key) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Filter + Search
  const filteredLessons = lessons.filter(l => {
    const matchType = filter === 'all' || l.type === filter;
    const matchSearch = !search || 
      l.title?.toLowerCase().includes(search.toLowerCase()) ||
      l.chapter?.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const counts = {
    all: lessons.length,
    reading: lessons.filter(l => l.type === 'reading').length,
    writing: lessons.filter(l => l.type === 'writing').length,
    listening: lessons.filter(l => l.type === 'listening').length,
    speaking: lessons.filter(l => l.type === 'speaking').length,
  };

  // Group by chapter
  const grouped = {};
  filteredLessons.forEach(lesson => {
    const key = getGroupKey(lesson);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(lesson);
  });
  const groupKeys = Object.keys(grouped).sort((a, b) => {
    const minA = Math.min(...grouped[a].map(getChapterSortKey));
    const minB = Math.min(...grouped[b].map(getChapterSortKey));
    return minA - minB;
  });

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 pb-24 md:pb-6 space-y-6 max-w-5xl mx-auto">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Lesson Manager</h1>
          <p className="text-slate-500 mt-1">Manage tests and materials created in Lesson Builder</p>
        </div>
        <div className="bg-primary-50 text-primary-700 px-4 py-2 rounded-xl font-bold shadow-sm">
          {lessons.length} Lessons Total
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all',       label: 'All' },
          { key: 'reading',   label: 'Reading' },
          { key: 'listening', label: 'Listening' },
          { key: 'writing',   label: 'Writing' },
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

      {/* Search Bar */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by title or chapter..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all shadow-sm"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Search result count */}
      {search && (
        <p className="text-sm text-slate-500">
          Found <span className="font-bold text-slate-700">{filteredLessons.length}</span> lesson{filteredLessons.length !== 1 ? 's' : ''} matching "<span className="font-medium text-primary-600">{search}</span>"
        </p>
      )}

      {/* Grouped Sections */}
      <div className="space-y-4">
        {groupKeys.map(groupKey => {
          const groupLessons = grouped[groupKey];
          const isCollapsed = collapsedSections[groupKey];
          const typeBreakdown = [...new Set(groupLessons.map(l => l.type))];

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
                      {groupLessons.length} lesson{groupLessons.length !== 1 ? 's' : ''}
                      <span className="ml-2">
                        {typeBreakdown.map(t => TYPE_CONFIG[t]?.label).join(' · ')}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-medium text-slate-400 hidden sm:inline">
                    {groupLessons.length} item{groupLessons.length !== 1 ? 's' : ''}
                  </span>
                  {isCollapsed ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronUp size={18} className="text-slate-400" />}
                </div>
              </button>

              {/* Section Body */}
              {!isCollapsed && (
                <div className="border-t border-slate-100">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                        <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Title</th>
                        <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Chapter</th>
                        <th className="text-center px-5 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Questions</th>
                        <th className="text-right px-5 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...groupLessons].sort((a, b) => (a.title || '').localeCompare(b.title || '')).map(lesson => {
                        const config = TYPE_CONFIG[lesson.type] || { label: lesson.type, color: 'bg-slate-50 text-slate-600', icon: BookOpen, iconColor: 'text-slate-500' };
                        const Icon = config.icon;

                        return (
                          <tr key={lesson.id} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors group">
                            <td className="px-5 py-3">
                              <span className={`inline-flex items-center space-x-1 px-2 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider ${config.color}`}>
                                <Icon size={12} />
                                <span>{config.label}</span>
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <p className="font-bold text-slate-800 text-sm">{lesson.title}</p>
                            </td>
                            <td className="px-5 py-3 text-sm text-slate-500 hidden sm:table-cell">
                              {lesson.chapter || '-'}
                            </td>
                            <td className="px-5 py-3 text-center hidden md:table-cell">
                              {(lesson.type === 'reading' || lesson.type === 'listening') ? (
                                <span className="inline-flex items-center justify-center px-2 py-0.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold">
                                  {lesson.questions?.length || 0}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">-</span>
                              )}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <div className="flex items-center justify-end space-x-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleOpenEdit(lesson)}
                                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Edit Lesson"
                                >
                                  <Edit3 size={16} />
                                </button>
                                <button
                                  onClick={() => handleDelete(lesson.id, lesson.title)}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete Lesson"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        {filteredLessons.length === 0 && (
          <div className="py-12 text-center text-slate-500 bg-white rounded-2xl border border-dashed border-slate-300">
            {search ? `No lessons matching "${search}".` : filter !== 'all' ? `No ${filter} lessons found.` : 'No lessons found. Use Lesson Builder to create new content.'}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmDelete?.onConfirm}
        title={confirmDelete?.title}
        message={confirmDelete?.message}
        confirmText="Yes, delete it"
        cancelText="Cancel"
        isDestructive={true}
      />
    </div>
  );
};

export default LessonManager;
