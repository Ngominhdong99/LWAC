import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Save, X, FileText, Headphones, Edit3, Mic } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';

const LessonBuilder = () => {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [lessonType, setLessonType] = useState('reading'); // reading, listening, writing, speaking
  
  // Base Lesson Fields
  const [title, setTitle] = useState('');
  const [chapter, setChapter] = useState('');
  
  // Reading / General Content
  const [passageText, setPassageText] = useState('');
  
  // Listening
  const [audioFile, setAudioFile] = useState(null);
  
  // Writing
  const [task1Min, setTask1Min] = useState(150);
  const [task2Min, setTask2Min] = useState(250);
  
  // Speaking
  const [speakingPrompt, setSpeakingPrompt] = useState('');

  // Questions Array (Reading & Listening only)
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    const fetchLesson = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const res = await axios.get(`http://127.0.0.1:8000/lessons/${id}`);
        const data = res.data;
        setTitle(data.title || '');
        setChapter(data.chapter || '');
        setLessonType(data.type || 'reading');
        
        if (data.type === 'reading' || data.type === 'listening') {
          setPassageText(data.content?.passage || '');
          if (data.questions) setQuestions(data.questions);
        } else if (data.type === 'writing') {
          setPassageText(data.content?.prompt || '');
          setTask1Min(data.content?.task_1_min_words || 150);
          setTask2Min(data.content?.task_2_min_words || 250);
        } else if (data.type === 'speaking') {
          setSpeakingPrompt(data.content?.prompt || '');
        }
      } catch (e) {
        console.error(e);
        alert('Failed to load lesson for editing');
      } finally {
        setLoading(false);
      }
    };
    fetchLesson();
  }, [id]);

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: Date.now(),
        type: 'multiple_choice', // or 'fill_blank'
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
      if (q.id === qId) {
        return { ...q, options: { ...q.options, [optKey]: value } };
      }
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
      const res = await axios.post('http://127.0.0.1:8000/upload/audio', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return res.data.url;
    } catch (e) {
      console.error(e);
      alert('Failed to upload audio');
      return null;
    }
  };

  const handleSaveLesson = async () => {
    if (!title || !chapter) {
      alert("Please provide a Title and Chapter.");
      return;
    }
    setLoading(true);

    try {
      let media_url = null;
      if (lessonType === 'listening' && audioFile) {
        media_url = await handleAudioUpload();
      }

      // Build specific content payload based on type
      let content = {};
      if (lessonType === 'reading' || lessonType === 'listening') {
         content = { passage: passageText };
      } else if (lessonType === 'writing') {
         content = { 
             prompt: passageText,
             task_1_min_words: task1Min,
             task_2_min_words: task2Min
         };
      } else if (lessonType === 'speaking') {
         content = {
            prompt: speakingPrompt
         };
      }

      const lessonPayload = {
        title,
        chapter,
        type: lessonType,
        content,
        media_url
      };

      if (id) {
        // Edit Mode
        await axios.put(`http://127.0.0.1:8000/lessons/${id}`, lessonPayload);
        
        if (lessonType === 'reading' || lessonType === 'listening') {
          const questionsPayload = questions.map(q => ({
             type: q.type,
             question_text: q.question_text,
             options: q.type === 'multiple_choice' ? q.options : null,
             correct_answer: q.correct_answer
          }));
          await axios.put(`http://127.0.0.1:8000/lessons/${id}/questions`, questionsPayload);
        }
        alert("Lesson updated successfully!");
        navigate('/coach/lessons');
      } else {
        // Create Mode
        const lessonRes = await axios.post('http://127.0.0.1:8000/lessons/', lessonPayload);
        const newLessonId = lessonRes.data.id;

        if ((lessonType === 'reading' || lessonType === 'listening') && questions.length > 0) {
          const questionsPayload = questions.map(q => ({
             type: q.type,
             question_text: q.question_text,
             options: q.type === 'multiple_choice' ? q.options : null,
             correct_answer: q.correct_answer
          }));
          await axios.post(`http://127.0.0.1:8000/lessons/${newLessonId}/questions/bulk`, questionsPayload);
        }

        alert("Lesson created successfully!");
        setTitle('');
        setChapter('');
        setPassageText('');
        setSpeakingPrompt('');
        setAudioFile(null);
        setQuestions([]);
        setTask1Min(150);
        setTask2Min(250);
      }
    } catch (error) {
      console.error(error);
      alert("Failed to save lesson.");
    } finally {
      setLoading(false);
    }
  };

  const renderTypeSelector = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {[
        { id: 'reading', icon: FileText, label: 'Reading' },
        { id: 'listening', icon: Headphones, label: 'Listening' },
        { id: 'writing', icon: Edit3, label: 'Writing' },
        { id: 'speaking', icon: Mic, label: 'Speaking' }
      ].map(type => (
        <button
          key={type.id}
          onClick={() => setLessonType(type.id)}
          className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center space-y-2 transition-all ${
            lessonType === type.id 
              ? 'border-primary-500 bg-primary-50 text-primary-700' 
              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
          }`}
        >
          <type.icon size={24} />
          <span className="font-semibold">{type.label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-4xl mx-auto pb-24">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{id ? 'Edit Lesson' : 'Lesson Builder'}</h1>
        <p className="text-slate-500 mt-1">{id ? 'Modify the contents of your existing lesson.' : 'Create custom material across 4 IELTS skills.'}</p>
      </header>

      {renderTypeSelector()}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Title</label>
            <input 
              value={title} 
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-medium"
              placeholder="e.g. Cambridge 15 Test 1"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Chapter / Section</label>
            <input 
              value={chapter} 
              onChange={e => setChapter(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-medium"
              placeholder="e.g. Reading Passage 1"
            />
          </div>
        </div>

        {/* Dynamic Builder Core */}
        <hr className="border-slate-100" />
        
        {lessonType === 'listening' && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Audio Upload</label>
            <input 
              type="file" 
              accept="audio/*"
              onChange={(e) => setAudioFile(e.target.files[0])}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
            {audioFile && <p className="text-xs text-slate-500 mt-2">Selected: {audioFile.name}</p>}
          </div>
        )}

        {(lessonType === 'reading' || lessonType === 'writing' || lessonType === 'listening') && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center justify-between">
              <span>{lessonType === 'writing' ? 'Writing Task Prompt' : 'Reading/Context Passage'}</span>
            </label>
            <textarea 
              value={passageText} 
              onChange={e => setPassageText(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[200px]"
              placeholder="Enter the full text/prompt here..."
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
              placeholder="e.g. Describe a time you..."
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
                    <div className="flex-1 space-y-3">
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
                                value={q.options[opt]}
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
                      <p className="text-slate-500 text-sm">No questions added yet. Click &quot;Add Question&quot; to begin.</p>
                  </div>
              )}
            </div>
          </div>
        )}

      </div>

      <div className="flex justify-end pt-4">
        <button 
          onClick={handleSaveLesson}
          disabled={loading}
          className="flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-all disabled:opacity-50"
        >
          {loading ? (
             <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-4"></span>
          ) : (
            <>
              <Save size={20} />
              <span>{id ? 'Save Changes' : 'Publish Lesson'}</span>
            </>
          )}
        </button>
      </div>

    </div>
  );
};

export default LessonBuilder;
