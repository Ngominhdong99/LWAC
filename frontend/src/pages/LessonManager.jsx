import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trash2, FileText, Headphones, Edit3, Mic, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import API_URL from '../api';

const LessonManager = () => {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"? This will also remove any student assignments and results connected to this lesson.`)) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/lessons/${id}`);
      setLessons(lessons.filter(l => l.id !== id));
    } catch (e) {
      console.error(e);
      alert('Failed to delete lesson.');
    }
  };

  const handleOpenEdit = (lesson) => {
    navigate(`/coach/builder/${lesson.id}`);
  };

  const getIcon = (type) => {
    switch (type) {
      case 'reading': return <FileText size={20} className="text-blue-500" />;
      case 'listening': return <Headphones size={20} className="text-amber-500" />;
      case 'writing': return <Edit3 size={20} className="text-emerald-500" />;
      case 'speaking': return <Mic size={20} className="text-purple-500" />;
      default: return <BookOpen size={20} className="text-slate-500" />;
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 pb-24 md:pb-6 space-y-6 max-w-5xl mx-auto">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Lesson Manager</h1>
          <p className="text-slate-500 mt-1">Manage tests and materials created in Lesson Builder</p>
        </div>
        <div className="bg-primary-50 text-primary-700 px-4 py-2 rounded-xl font-bold shadow-sm">
          {lessons.length} Lessons Total
        </div>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Title</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Chapter</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Questions</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lessons.map(lesson => (
                <tr key={lesson.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 w-12 h-12 shadow-sm border border-slate-100">
                      {getIcon(lesson.type)}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-800">{lesson.title}</p>
                    <p className="text-xs text-slate-400 capitalize">{lesson.type}</p>
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-slate-600">
                    {lesson.chapter}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {(lesson.type === 'reading' || lesson.type === 'listening') ? (
                      <span className="inline-flex items-center justify-center px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold">
                        {lesson.questions?.length || 0}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-sm italic">-</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end space-x-1">
                      <button 
                        onClick={() => handleOpenEdit(lesson)} 
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                        title="Edit Lesson"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(lesson.id, lesson.title)} 
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                        title="Delete Lesson"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {lessons.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <p className="text-slate-500 font-medium">No lessons found.</p>
                    <p className="text-slate-400 text-sm mt-1">Use Lesson Builder to create new content.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>


    </div>
  );
};

export default LessonManager;
