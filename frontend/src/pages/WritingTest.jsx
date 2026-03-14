import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import AskTeacherPopup from '../components/AskTeacherPopup';
import { ArrowLeft, ArrowRight, Clock, CheckCircle, PenTool, Loader2, Volume2, Plus, HelpCircle, Check } from 'lucide-react';
import API_URL from '../api';
import { speakNatural } from '../utils/tts';
import { lookupWord } from '../utils/dictionary';

const WritingTest = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isViewMode = searchParams.get('view') === 'true';
  const { user } = useAuth();
  const [essay, setEssay] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [allWritingLessons, setAllWritingLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const textRef = useRef(null);
  const [selection, setSelection] = useState(null);
  const [askTeacherText, setAskTeacherText] = useState(null);
  const [savedSelection, setSavedSelection] = useState(false);

  const storageKey = `lwac_writing_${user?.id}_${id}`;

  useEffect(() => {
    setEssay('');
    setResult(null);
    setLoading(true);
    const fetchData = async () => {
      try {
        const [lessonRes, allRes] = await Promise.all([
          axios.get(`${API_URL}/lessons/${id}`),
          axios.get(`${API_URL}/lessons/`)
        ]);
        setLesson(lessonRes.data);
        setAllWritingLessons(allRes.data.filter(l => l.type === 'writing'));

        // View mode: load previous result
        if (isViewMode && user) {
          try {
            const resResults = await axios.get(`${API_URL}/results/${user.id}`);
            const lessonResults = resResults.data.filter(r => r.lesson_id === parseInt(id));
            if (lessonResults.length > 0) {
              const latest = lessonResults[lessonResults.length - 1];
              if (latest.responses?.user_essay) {
                setEssay(latest.responses.user_essay);
              }
              setResult({
                score_normalized: latest.score,
                evaluation: latest.responses?.evaluation || {}
              });
            }
          } catch (e) { console.error('Failed to load result for view mode', e); }
        } else if (!isViewMode) {
          // Restore from localStorage
          try {
            const saved = localStorage.getItem(storageKey);
            if (saved) setEssay(saved);
          } catch (e) { /* ignore */ }
        }
      } catch (error) {
        console.error("Failed to load lesson", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // Auto-save essay to localStorage
  useEffect(() => {
    if (isViewMode || result) return;
    if (essay.trim()) {
      localStorage.setItem(storageKey, essay);
    }
  }, [essay]);

  // Save on beforeunload
  useEffect(() => {
    if (isViewMode) return;
    const handleBeforeUnload = () => {
      if (essay.trim() && !result) {
        localStorage.setItem(storageKey, essay);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [essay, result, isViewMode]);

  // Text selection handler on prompt area
  useEffect(() => {
    const handleSelectionChange = () => {
      if (!textRef.current) return;
      const sel = window.getSelection();
      if (!sel.rangeCount || sel.isCollapsed) {
        if (!askTeacherText) setSelection(null);
        return;
      }
      const range = sel.getRangeAt(0);
      if (textRef.current.contains(range.commonAncestorContainer)) {
        const text = sel.toString().trim();
        if (text) {
          const rect = range.getBoundingClientRect();
          setSelection({ text, rect });
          setSavedSelection(false);
        } else {
          setSelection(null);
        }
      } else {
        setSelection(null);
      }
    };

    // Prevent native context menu on text area (mobile)
    const preventContextMenu = (e) => {
      if (textRef.current && textRef.current.contains(e.target)) {
        e.preventDefault();
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('contextmenu', preventContextMenu);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('contextmenu', preventContextMenu);
    };
  }, [askTeacherText]);

  const playAudio = (text) => speakNatural(text);

  const saveToVocabVault = async (text) => {
    try {
      const lookup = await lookupWord(text);
      await axios.post(`${API_URL}/vocab/${user?.id || 1}`, {
        word: text,
        meaning: lookup.meaning || 'Saved from writing test',
        ipa: lookup.ipa || '',
        source_lesson_id: lesson?.id
      });
      setSavedSelection(true);
    } catch (error) { console.error('Failed to save vocab', error); }
  };

  const getNextLesson = () => {
    if (!allWritingLessons.length || !lesson) return null;
    const idx = allWritingLessons.findIndex(l => l.id === lesson.id);
    if (idx >= 0 && idx < allWritingLessons.length - 1) return allWritingLessons[idx + 1];
    return null;
  };

  const handleSubmit = async () => {
    if (!essay.trim()) return;
    
    setIsSubmitting(true);
    try {
      const targetUserId = user?.id || 1;
      const question = lesson.content?.prompt || lesson.title;
      const response = await axios.post(`${API_URL}/quiz/submit/writing`, {
        user_id: targetUserId,
        lesson_id: lesson.id,
        question_text: question,
        user_response: essay
      });
      setResult(response.data);
      // Clear auto-saved data after successful submission
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error("Submission failed:", error);
      alert("Failed to submit essay. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>;
  if (!lesson) return <div className="p-8 text-center text-slate-500">Lesson not found</div>;

  const prompt = lesson.content?.prompt || lesson.title;
  const tips = lesson.content?.tips || [];
  const taskType = lesson.content?.task_type || 'Writing Task';
  const nextLesson = getNextLesson();

  return (
    <div className="h-full flex flex-col bg-secondary min-h-screen">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <button 
            onClick={() => navigate('/reading')}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 text-center mx-4">
            <h1 className="font-bold text-slate-800 text-sm md:text-base truncate">{lesson.title} - Auto Grade</h1>
            <p className="text-xs text-slate-500">{lesson.chapter}</p>
          </div>
          <div className="flex items-center space-x-2 text-primary-600 bg-primary-50 px-3 py-1.5 rounded-full text-sm font-semibold">
            <Clock size={16} />
            <span>40:00</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden pb-16 md:pb-0">
        
        {/* Left Side: Prompt Area */}
        <section className="flex-1 md:w-1/2 p-4 md:p-8 bg-white md:border-r border-slate-200 shadow-sm relative z-0 overflow-y-auto">
          <div className="max-w-prose mx-auto" ref={textRef}>
            <div className="inline-flex items-center justify-center space-x-2 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full text-sm font-semibold mb-6">
              <PenTool size={16} />
              <span>{taskType}</span>
            </div>
            
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-4 leading-tight">Prompt</h2>
                <p className="text-slate-700 text-base md:text-lg leading-relaxed font-medium">
                {prompt}
                </p>
                {tips.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-200">
                    <ul className="list-disc list-inside text-sm text-slate-500 space-y-2">
                        {tips.map((tip, i) => (<li key={i}>{tip}</li>))}
                    </ul>
                </div>
                )}
            </div>

            {/* Floating Action Menu for Text Selection */}
            {selection && !askTeacherText && (
              <div 
                className="fixed z-[100] animate-in fade-in zoom-in-95 duration-200"
                style={{
                  top: Math.max(10, selection.rect.top - 60) + 'px',
                  left: selection.rect.left + (selection.rect.width / 2) + 'px',
                  transform: 'translateX(-50%)'
                }}
              >
                <div className="bg-slate-900 shadow-xl rounded-xl flex items-center p-1.5 text-white/90 gap-1 ring-1 ring-slate-800/50">
                  <button 
                    onClick={() => playAudio(selection.text)}
                    className="p-2 hover:bg-slate-800 hover:text-white rounded-lg transition-colors"
                    title="Listen"
                  >
                    <Volume2 size={16} />
                  </button>
                  <button 
                    onClick={() => saveToVocabVault(selection.text)}
                    className={`p-2 rounded-lg transition-colors ${savedSelection ? 'text-emerald-400 bg-emerald-400/10' : 'hover:bg-slate-800 hover:text-amber-400'}`}
                    title="Save to Vault"
                  >
                    {savedSelection ? <Check size={16} /> : <Plus size={16} />}
                  </button>
                  {user?.role === 'student' && (
                    <button 
                      onClick={() => {
                        setAskTeacherText(selection.text);
                        window.getSelection().empty();
                      }}
                      className="p-2 hover:bg-slate-800 hover:text-violet-400 rounded-lg transition-colors"
                      title="Ask Teacher"
                    >
                      <HelpCircle size={16} />
                    </button>
                  )}
                </div>
                <div className="w-3 h-3 bg-slate-900 absolute left-1/2 -bottom-1.5 transform -translate-x-1/2 rotate-45 border-r border-b border-slate-800/50"></div>
              </div>
            )}

            {/* Evaluation Results */}
            {result && (
              <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center">
                  <span className="bg-primary-500 w-2 h-6 rounded-full mr-3"></span>
                  AI Evaluation
                </h3>
                
                <div className="bg-gradient-to-br from-primary-50 to-teal-50 p-6 rounded-2xl border border-primary-100 shadow-sm mb-6">
                  <div className="flex items-center justify-between mb-4">
                     <span className="text-primary-800 font-semibold tracking-wide uppercase text-sm">Estimated Band</span>
                     <span className="text-3xl font-black text-primary-600">{result.evaluation.estimated_band.toFixed(1)}</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed text-sm md:text-base">
                    {result.evaluation.feedback}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(result.evaluation.criteria_scores).map(([crit, score]) => (
                    <div key={crit} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                      <span className="text-xs text-slate-500 font-medium tracking-wide uppercase mb-2">{crit}</span>
                      <span className="text-xl font-bold text-slate-800">{score.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
          </div>
        </section>

        {/* Right Side: Writing Area */}
        <section className="flex-1 md:w-1/2 p-4 md:p-8 bg-slate-50 relative z-0 flex flex-col">
          <div className="flex-1 max-w-xl mx-auto w-full flex flex-col space-y-4 pb-20 md:pb-24">
            
            <div className="flex justify-between items-center px-1">
                <h3 className="text-lg font-bold text-slate-800">Your Essay</h3>
                <span className={`text-sm font-medium ${essay.trim().split(/\s+/).length < 250 ? 'text-amber-500' : 'text-primary-600'}`}>
                    {essay.trim() ? essay.trim().split(/\s+/).length : 0} words
                </span>
            </div>
            
            <textarea
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
              disabled={isSubmitting || result !== null}
              placeholder="Start typing your response here..."
              className="flex-1 w-full bg-white border border-slate-200 rounded-2xl p-6 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none shadow-inner text-slate-700 leading-relaxed transition-all"
            />
          </div>

          {result ? (
            <div className="fixed md:absolute bottom-16 md:bottom-8 left-0 right-0 px-4 md:px-8 bg-transparent flex justify-end z-10 w-full md:max-w-xl md:mx-auto">
              <div className="flex gap-2 w-full">
                <button onClick={() => navigate('/reading')}
                  className="flex-1 flex items-center justify-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-3 rounded-xl font-semibold transition-colors">
                  <ArrowLeft size={16} />
                  <span>All Lessons</span>
                </button>
                {nextLesson && (
                  <button onClick={() => navigate(`/writing/${nextLesson.id}`)}
                    className="flex-1 flex items-center justify-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-3 rounded-xl font-semibold shadow-lg transition-colors">
                    <span>Next Essay</span>
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="fixed md:absolute bottom-16 md:bottom-8 left-0 right-0 px-4 md:px-8 bg-transparent flex justify-end z-10 w-full md:max-w-xl md:mx-auto">
                <button 
                onClick={handleSubmit}
                disabled={isSubmitting || !essay.trim() || isViewMode}
                className={`flex items-center space-x-2 px-8 py-4 rounded-xl font-bold shadow-lg transition-all w-full md:w-auto justify-center ${
                    isSubmitting || !essay.trim() 
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed hidden md:flex' 
                    : 'bg-primary-600 hover:bg-primary-700 text-white hover:scale-105 hover:shadow-xl'
                }`}
                >
                {isSubmitting ? (
                    <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Grading...</span>
                    </>
                ) : (
                    <>
                    <span>Submit & Auto Grade</span>
                    <CheckCircle size={20} className={essay.trim() ? "translate-x-0.5" : ""} />
                    </>
                )}
                </button>
            </div>
          )}
        </section>

      </div>
      {askTeacherText && <AskTeacherPopup questionText={`About: "${askTeacherText}"`} lessonId={lesson?.id} onClose={() => setAskTeacherText(null)} />}
    </div>
  );
};

export default WritingTest;
