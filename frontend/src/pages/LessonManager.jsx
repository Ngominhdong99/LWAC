import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trash2, FileText, Headphones, Edit3, Mic, BookOpen, Plus, Save, X } from 'lucide-react';
import API_URL from '../api';

const LessonManager = () => {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [editLesson, setEditLesson] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lessonType, setLessonType] = useState('reading');
  const [title, setTitle] = useState('');
  const [chapter, setChapter] = useState('');
  const [passageText, setPassageText] = useState('');
  const [audioFile, setAudioFile] = useState(null);
  const [task1Min, setTask1Min] = useState(150);
  const [task2Min, setTask2Min] = useState(250);
  const [speakingPrompt, setSpeakingPrompt] = useState('');
  const [questions, setQuestions] = useState([]);

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

  const handleOpenEdit = async (lesson) => {
    try {
      // Fetch full lesson details to get content and questions
      const res = await axios.get(`${API_URL}/lessons/${lesson.id}`);
      const data = res.data;
      setEditLesson(data);
      setTitle(data.title || '');
      setChapter(data.chapter || '');
      setLessonType(data.type || 'reading');
      
      if (data.type === 'reading' || data.type === 'listening') {
        setPassageText(data.content?.passage || '');
        setQuestions(data.questions || []);
      } else if (data.type === 'writing') {
        setPassageText(data.content?.prompt || '');
        setTask1Min(data.content?.task_1_min_words || 150);
        setTask2Min(data.content?.task_2_min_words || 250);
      } else if (data.type === 'speaking') {
        setSpeakingPrompt(data.content?.prompt || '');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to load lesson details for editing.');
    }
  };

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: Date.now(),
        type: 'multiple_choice',
        question_text: '',
        options: { 'A': '', 'B': '', 'C': '', 'D': '' },
        correct_answer: 'A'
      }
    ]);
  };

  const updateQuestion = (id, field, value) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const updateOption = (qId, optKey, value) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) return { ...q, options: { ...q.options, [optKey]: value } };
      return q;
    }));
  };

  const removeQuestion = (id) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleAudioUpload = async () => {
    if (!audioFile) return null;
    const formData = new FormData();
    formData.append('file', audioFile);
    try {
      const res = await axios.post(`${API_URL}/upload/audio`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return res.data.url;
    } catch (e) {
      console.error(e);
      alert('Failed to upload audio');
      return null;
    }
  };

  const handleEditSubmit = async () => {
    if (!title || !chapter) {
      alert("Please provide a Title and Chapter.");
      return;
    }
    setIsSaving(true);
    try {
      let media_url = editLesson.media_url;
      if (lessonType === 'listening' && audioFile) {
        const uploadedUrl = await handleAudioUpload();
        if (uploadedUrl) media_url = uploadedUrl;
      }

      let content = {};
      if (lessonType === 'reading' || lessonType === 'listening') {
         content = { passage: passageText };
      } else if (lessonType === 'writing') {
         content = { prompt: passageText, task_1_min_words: task1Min, task_2_min_words: task2Min };
      } else if (lessonType === 'speaking') {
         content = { prompt: speakingPrompt };
      }

      const lessonPayload = { title, chapter, type: lessonType, content, media_url };

      // Update lesson
      await axios.put(`${API_URL}/lessons/${editLesson.id}`, lessonPayload);
      
      // Update questions
      if (lessonType === 'reading' || lessonType === 'listening') {
        const questionsPayload = questions.map(q => ({
           type: q.type,
           question_text: q.question_text,
           options: q.type === 'multiple_choice' ? q.options : null,
           correct_answer: q.correct_answer
        }));
        await axios.put(`${API_URL}/lessons/${editLesson.id}/questions`, questionsPayload);
      }

      alert("Lesson updated successfully!");
      setEditLesson(null);
      fetchLessons();
    } catch (e) {
      console.error(e);
      alert('Failed to update lesson.');
    } finally {
      setIsSaving(false);
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

      {/* Edit Modal with Builder UI */}
      {editLesson && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-2xl font-bold text-slate-800">Edit Lesson</h3>
                <p className="text-sm text-slate-500 mt-1">Modifying content for: {editLesson.title}</p>
              </div>
              <button onClick={() => setEditLesson(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-8 bg-slate-50">
              
              {/* Type Display (Read-only during edit) */}
              <div className="flex items-center space-x-3 p-4 bg-white rounded-xl border border-slate-200">
                <div className="p-3 bg-primary-50 rounded-lg text-primary-600">
                  {getIcon(lessonType)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-500 uppercase">Lesson Type</p>
                  <p className="font-bold text-slate-800 capitalize">{lessonType}</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Title</label>
                    <input 
                      value={title} 
                      onChange={e => setTitle(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Chapter / Section</label>
                    <input 
                      value={chapter} 
                      onChange={e => setChapter(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-medium"
                    />
                  </div>
                </div>

                <hr className="border-slate-100" />
                
                {lessonType === 'listening' && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Audio Content</label>
                
                <input 
                  type="file" 
                  accept="audio/*"
                  onChange={(e) => setAudioFile(e.target.files[0])}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
                
                {/* Audio Preview Section */}
                <div className="mt-4 space-y-3">
                  {audioFile ? (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-primary-600 flex items-center">
                        <span className="w-2 h-2 bg-primary-600 rounded-full mr-2"></span>
                        New file selected: {audioFile.name}
                      </p>
                      <audio controls src={URL.createObjectURL(audioFile)} className="w-full h-10" />
                    </div>
                  ) : editLesson.media_url ? (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-500 flex items-center">
                        <span className="w-2 h-2 bg-slate-400 rounded-full mr-2"></span>
                        Using existing audio
                      </p>
                      <audio 
                        controls 
                        src={editLesson.media_url.startsWith('/static') ? `${API_URL}${editLesson.media_url}` : editLesson.media_url} 
                        className="w-full h-10" 
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No audio file uploaded yet.</p>
                  )}
                </div>
              </div>
            )}

                {(lessonType === 'reading' || lessonType === 'writing' || lessonType === 'listening') && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      {lessonType === 'writing' ? 'Writing Task Prompt' : 'Reading/Context Passage'}
                    </label>
                    <textarea 
                      value={passageText} 
                      onChange={e => setPassageText(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[200px]"
                    />
                  </div>
                )}

                {lessonType === 'speaking' && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Speaking Prompt/Questions</label>
                    <textarea 
                      value={speakingPrompt} 
                      onChange={e => setSpeakingPrompt(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[150px]"
                    />
                  </div>
                )}

                {lessonType === 'writing' && (
                  <div className="grid grid-cols-2 gap-4">
                       <div>
                         <label className="block text-xs font-semibold text-slate-500 uppercase">Min Words (Task 1)</label>
                         <input type="number" value={task1Min} onChange={e => setTask1Min(Number(e.target.value))} className="w-full px-4 py-2 border rounded-lg" />
                       </div>
                       <div>
                         <label className="block text-xs font-semibold text-slate-500 uppercase">Min Words (Task 2)</label>
                         <input type="number" value={task2Min} onChange={e => setTask2Min(Number(e.target.value))} className="w-full px-4 py-2 border rounded-lg" />
                       </div>
                  </div>
                )}

                {/* Questions Builder */}
                {(lessonType === 'reading' || lessonType === 'listening') && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-800">Questions ({questions.length})</h3>
                      <button 
                        onClick={handleAddQuestion}
                        className="flex items-center space-x-1 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition-colors font-medium"
                      >
                        <Plus size={16} /> <span>Add Question</span>
                      </button>
                    </div>

                    <div className="space-y-4">
                      {questions.map((q, idx) => (
                        <div key={q.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 relative">
                          <button onClick={() => removeQuestion(q.id)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500">
                            <X size={16} />
                          </button>
                          
                          <div className="flex gap-4 mb-4">
                            <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                              {idx + 1}
                            </span>
                            <div className="flex-1 space-y-3 pr-6">
                              <select 
                                value={q.type}
                                onChange={(e) => updateQuestion(q.id, 'type', e.target.value)}
                                className="text-sm border border-slate-200 rounded-md px-2 py-1 bg-white font-medium shadow-sm outline-none"
                              >
                                <option value="multiple_choice">Multiple Choice</option>
                                <option value="fill_blank">Fill in the Blank</option>
                              </select>

                              <input 
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                placeholder="Question text..."
                                value={q.question_text}
                                onChange={(e) => updateQuestion(q.id, 'question_text', e.target.value)}
                              />

                              {q.type === 'multiple_choice' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                  {['A', 'B', 'C', 'D'].map(opt => (
                                    <div key={opt} className="flex items-center space-x-2">
                                      <span className="font-bold text-slate-500 w-4">{opt}</span>
                                      <input 
                                        className="flex-1 px-3 py-1.5 border border-slate-200 rounded-md text-sm"
                                        value={q.options?.[opt] || ''}
                                        onChange={(e) => updateOption(q.id, opt, e.target.value)}
                                        placeholder={`Option ${opt}`}
                                      />
                                    </div>
                                  ))}
                                  <div className="col-span-1 md:col-span-2 mt-2 pt-2 border-t border-slate-200 flex items-center">
                                    <span className="text-sm font-medium text-slate-600 mr-2">Correct Answer:</span>
                                    <select 
                                        value={q.correct_answer} 
                                        onChange={(e) => updateQuestion(q.id, 'correct_answer', e.target.value)}
                                        className="border border-slate-200 rounded text-sm px-2 py-1 bg-white"
                                    >
                                        <option value="A">A</option>
                                        <option value="B">B</option>
                                        <option value="C">C</option>
                                        <option value="D">D</option>
                                    </select>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-2 pt-2 border-t border-slate-200">
                                    <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Exact Correct Answer</label>
                                    <input 
                                      className="w-full max-w-sm px-3 py-1.5 border border-slate-200 rounded-md text-sm font-bold text-green-700 bg-green-50"
                                      value={q.correct_answer}
                                      onChange={(e) => updateQuestion(q.id, 'correct_answer', e.target.value)}
                                      placeholder="e.g. urbanization"
                                    />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {questions.length === 0 && (
                          <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">
                              <p className="text-slate-500 text-sm">No questions currently. Click &quot;Add Question&quot; to begin.</p>
                          </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-white shrink-0 flex justify-end gap-3 rounded-b-2xl">
              <button 
                onClick={() => setEditLesson(null)} 
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button 
                onClick={handleEditSubmit} 
                disabled={isSaving}
                className="flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-8 py-2.5 rounded-xl font-bold shadow-md transition-all disabled:opacity-50"
              >
                {isSaving ? (
                   <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-4"></span>
                ) : (
                  <>
                    <Save size={18} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LessonManager;
