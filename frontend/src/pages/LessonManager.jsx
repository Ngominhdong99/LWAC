import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trash2, FileText, Headphones, Edit3, Mic, BookOpen, X, Save, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import API_URL from '../api';
import ConfirmModal from '../components/ConfirmModal';

const LessonManager = () => {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editModal, setEditModal] = useState(null); // { id, title, chapter, type, questionCount }
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const fetchLessons = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/lessons/`);
      setLessons(res.data);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load lessons');
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
          toast.success('Lesson deleted successfully');
        } catch (e) {
          console.error(e);
          toast.error('Failed to delete lesson.');
        }
      }
    });
  };

  const handleOpenQuickEdit = (lesson) => {
    const totalQuestions = lesson.exercises?.reduce((sum, ex) => sum + (ex.questions?.length || 0), 0) || lesson.questions?.length || 0;
    setEditModal({
      id: lesson.id,
      title: lesson.title,
      chapter: lesson.chapter,
      type: lesson.type,
      questionCount: totalQuestions,
      exerciseCount: lesson.exercises?.length || 0
    });
  };

  const handleQuickSave = async () => {
    if (!editModal) return;
    setSaving(true);
    try {
      await axios.put(`${API_URL}/lessons/${editModal.id}`, {
        title: editModal.title,
        chapter: editModal.chapter
      });
      setLessons(lessons.map(l => l.id === editModal.id ? { ...l, title: editModal.title, chapter: editModal.chapter } : l));
      toast.success('Lesson updated!');
      setEditModal(null);
    } catch (e) {
      console.error(e);
      toast.error('Failed to update lesson.');
    } finally {
      setSaving(false);
    }
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

  const getTypeBadgeColor = (type) => {
    switch (type) {
      case 'reading': return 'bg-blue-100 text-blue-700';
      case 'listening': return 'bg-amber-100 text-amber-700';
      case 'writing': return 'bg-emerald-100 text-emerald-700';
      case 'speaking': return 'bg-purple-100 text-purple-700';
      default: return 'bg-slate-100 text-slate-600';
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
                <th className="text-center px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Content</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lessons.map(lesson => {
                const totalQuestions = lesson.exercises?.reduce((sum, ex) => sum + (ex.questions?.length || 0), 0) || lesson.questions?.length || 0;
                const exerciseCount = lesson.exercises?.length || 0;

                return (
                  <tr key={lesson.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 w-12 h-12 shadow-sm border border-slate-100">
                        {getIcon(lesson.type)}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-800">{lesson.title}</p>
                      <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full mt-1 ${getTypeBadgeColor(lesson.type)}`}>
                        {lesson.type}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-slate-600">
                      {lesson.chapter}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {(lesson.type === 'reading' || lesson.type === 'listening') ? (
                        <div>
                          {exerciseCount > 0 && (
                            <span className="inline-flex items-center justify-center px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold mr-1">
                              {exerciseCount} Ex
                            </span>
                          )}
                          <span className="inline-flex items-center justify-center px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold">
                            {totalQuestions} Q
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm italic">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button 
                          onClick={() => handleOpenQuickEdit(lesson)} 
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                          title="Quick Edit"
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
                );
              })}
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

      {/* Quick Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800">Quick Edit</h3>
                <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full mt-1 ${getTypeBadgeColor(editModal.type)}`}>
                  {editModal.type}
                </span>
              </div>
              <button onClick={() => setEditModal(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Title</label>
                <input 
                  value={editModal.title}
                  onChange={e => setEditModal({ ...editModal, title: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Chapter / Section</label>
                <input 
                  value={editModal.chapter}
                  onChange={e => setEditModal({ ...editModal, chapter: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-medium"
                />
              </div>
              
              {/* Summary */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-sm text-slate-600">
                {editModal.exerciseCount > 0 && <p>📋 <b>{editModal.exerciseCount}</b> exercises</p>}
                {editModal.questionCount > 0 && <p>❓ <b>{editModal.questionCount}</b> questions total</p>}
                {editModal.questionCount === 0 && editModal.exerciseCount === 0 && <p className="text-slate-400 italic">No content yet</p>}
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => { setEditModal(null); navigate(`/coach/builder/${editModal.id}`); }}
                className="flex items-center space-x-1.5 text-sm text-slate-600 hover:text-primary-700 font-medium px-3 py-2 rounded-lg hover:bg-primary-50 transition-colors"
              >
                <ExternalLink size={15} />
                <span>Full Edit</span>
              </button>
              <button
                onClick={handleQuickSave}
                disabled={saving}
                className="flex items-center space-x-1.5 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2 rounded-lg font-bold shadow-sm transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                ) : (
                  <><Save size={16} /> <span>Save</span></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
