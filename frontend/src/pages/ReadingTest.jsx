import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import AskTeacherPopup from '../components/AskTeacherPopup';
import { ArrowLeft, ArrowRight, Clock, CheckCircle, Plus, HelpCircle, Volume2, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import API_URL from '../api';
import { speakNatural } from '../utils/tts';
import { lookupWord } from '../utils/dictionary';

const VOCAB_MAP = {
  'consumed': { type: 'v', ipa: '/kənˈsjuːmd/', meaning: 'Được tiêu thụ, ăn uống' },
  'beverage': { type: 'n', ipa: '/ˈbev.ər.ɪdʒ/', meaning: 'Thức uống, đồ uống (trừ nước)' },
  'originating': { type: 'v', ipa: '/əˈrɪdʒ.ən.eɪ.tɪŋ/', meaning: 'Bắt nguồn từ, xuất xứ' },
  'legend': { type: 'n', ipa: '/ˈledʒ.ənd/', meaning: 'Truyền thuyết, huyền thoại' },
  'intrigued': { type: 'adj', ipa: '/ɪnˈtriːɡd/', meaning: 'Bị hấp dẫn, tò mò' },
  'aroma': { type: 'n', ipa: '/əˈrəʊ.mə/', meaning: 'Mùi thơm, hương vị' },
  'accelerated': { type: 'v', ipa: '/əkˈsel.ə.reɪ.tɪd/', meaning: 'Tăng tốc, thúc đẩy' },
  'intermittent': { type: 'adj', ipa: '/ˌɪn.təˈmɪt.ənt/', meaning: 'Gián đoạn, không liên tục' },
  'urbanization': { type: 'n', ipa: '/ˌɜː.bən.aɪˈzeɪ.ʃən/', meaning: 'Đô thị hóa' },
  'degradation': { type: 'n', ipa: '/ˌdeɡ.rəˈdeɪ.ʃən/', meaning: 'Sự suy thoái, xuống cấp' },
  'leverage': { type: 'v', ipa: '/ˈliː.vər.ɪdʒ/', meaning: 'Tận dụng, khai thác' },
  'aristocracy': { type: 'n', ipa: '/ˌær.ɪˈstɒk.rə.si/', meaning: 'Tầng lớp quý tộc' },
  'milestone': { type: 'n', ipa: '/ˈmaɪl.stəʊn/', meaning: 'Cột mốc quan trọng' },
  'renewable': { type: 'adj', ipa: '/rɪˈnjuː.ə.bəl/', meaning: 'Tái tạo được' },
};

const ReadingTest = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isViewMode = searchParams.get('view') === 'true';
  const { user } = useAuth();
  const [lesson, setLesson] = useState(null);
  const [allLessons, setAllLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [fillAnswers, setFillAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textRef = useRef(null);

  // Text selection state
  const [selection, setSelection] = useState(null);
  const [askTeacherText, setAskTeacherText] = useState(null);
  const [savedSelection, setSavedSelection] = useState(false);

  const storageKey = `lwac_reading_${user?.id}_${id}`;

  useEffect(() => {
    setLesson(null);
    setAnswers({});
    setFillAnswers({});
    setResult(null);
    setLoading(true);

    const fetchData = async () => {
      try {
        const [lessonRes, allRes] = await Promise.all([
          axios.get(`${API_URL}/lessons/${id}`),
          axios.get(`${API_URL}/lessons/`)
        ]);
        setLesson(lessonRes.data);
        setAllLessons(allRes.data.filter(l => l.type === 'reading'));

        // View mode: load previous result
        if (isViewMode && user) {
          try {
            const resResults = await axios.get(`${API_URL}/results/${user.id}`);
            const lessonResults = resResults.data.filter(r => r.lesson_id === parseInt(id));
            if (lessonResults.length > 0) {
              const latest = lessonResults[lessonResults.length - 1];
              const questions = lessonRes.data.questions || [];
              const savedMc = {};
              const savedFb = {};
              if (latest.responses) {
                questions.forEach(q => {
                  const val = latest.responses[String(q.id)];
                  if (val !== undefined) {
                    if (q.type === 'multiple_choice') savedMc[q.id] = val;
                    else if (q.type === 'fill_blank') savedFb[q.id] = val;
                  }
                });
              }
              setAnswers(savedMc);
              setFillAnswers(savedFb);
              const correctCount = questions.reduce((acc, q) => {
                if (q.type === 'multiple_choice' && savedMc[q.id] === q.correct_answer) return acc + 1;
                if (q.type === 'fill_blank' && (savedFb[q.id] || '').trim().toLowerCase() === q.correct_answer.toLowerCase()) return acc + 1;
                return acc;
              }, 0);
              setResult({ score: latest.score, correct: correctCount, total: questions.length });
            }
          } catch (e) { console.error('Failed to load result for view mode', e); }
        } else if (!isViewMode) {
          // Restore from localStorage
          try {
            const saved = localStorage.getItem(`lwac_reading_${user?.id}_${id}`);
            if (saved) {
              const parsed = JSON.parse(saved);
              if (parsed.answers) setAnswers(parsed.answers);
              if (parsed.fillAnswers) setFillAnswers(parsed.fillAnswers);
            }
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

  // Auto-save to localStorage
  useEffect(() => {
    if (isViewMode || result) return;
    const hasAnswers = Object.keys(answers).length > 0 || Object.keys(fillAnswers).length > 0;
    if (hasAnswers) {
      localStorage.setItem(storageKey, JSON.stringify({ answers, fillAnswers }));
    }
  }, [answers, fillAnswers]);

  // Save on beforeunload
  useEffect(() => {
    if (isViewMode) return;
    const handleBeforeUnload = () => {
      const hasAnswers = Object.keys(answers).length > 0 || Object.keys(fillAnswers).length > 0;
      if (hasAnswers && !result) {
        localStorage.setItem(storageKey, JSON.stringify({ answers, fillAnswers }));
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [answers, fillAnswers, result, isViewMode]);

  useEffect(() => {
    const handleSelectionChange = () => {
      if (!textRef.current) return;
      
      const sel = window.getSelection();
      if (!sel.rangeCount || sel.isCollapsed) {
        if (!askTeacherText) setSelection(null);
        return;
      }
      
      // Ensure selection is inside the text content area
      const range = sel.getRangeAt(0);
      if (textRef.current.contains(range.commonAncestorContainer)) {
        const text = sel.toString().trim();
        if (text) {
          const rect = range.getBoundingClientRect();
          setSelection({
            text,
            rect,
          });
          setSavedSelection(false);
        } else {
          setSelection(null);
        }
      } else {
        setSelection(null);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [askTeacherText]);

  const getNextLesson = () => {
    if (!allLessons.length || !lesson) return null;
    const currentIdx = allLessons.findIndex(l => l.id === lesson.id);
    if (currentIdx >= 0 && currentIdx < allLessons.length - 1) {
      return allLessons[currentIdx + 1];
    }
    return null;
  };

  const handleAnswerSelect = (questionId, optionKey) => {
    if (result || isViewMode) return;
    setAnswers({ ...answers, [questionId]: optionKey });
  };

  const handleFillChange = (questionId, value) => {
    if (result || isViewMode) return;
    setFillAnswers({ ...fillAnswers, [questionId]: value });
  };

  const handleSubmit = async () => {
    const mcQuestions = lesson.questions.filter(q => q.type === 'multiple_choice');
    const fbQuestions = lesson.questions.filter(q => q.type === 'fill_blank');

    const totalAnswered = Object.keys(answers).length + Object.keys(fillAnswers).length;
    if (totalAnswered < lesson.questions.length) {
      alert("Please answer all questions before submitting.");
      return;
    }

    setIsSubmitting(true);
    let score = 0;

    mcQuestions.forEach(q => {
      if (answers[q.id] === q.correct_answer) score++;
    });
    fbQuestions.forEach(q => {
      const userAns = (fillAnswers[q.id] || '').trim().toLowerCase();
      if (userAns === q.correct_answer.toLowerCase()) score++;
    });

    const normalizedScore = Math.round((score / lesson.questions.length) * 100);

    try {
      const targetUserId = user?.id || 1;
      await axios.post(`${API_URL}/results/${targetUserId}`, {
        lesson_id: lesson.id,
        score: normalizedScore,
        responses: { ...answers, ...fillAnswers }
      });
      setResult({ score: normalizedScore, correct: score, total: lesson.questions.length });
      // Clear auto-saved data after successful submission
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error("Failed to submit results", error);
      alert("Error saving results to server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Selection actions
  const playAudio = (text) => {
    speakNatural(text);
  };

  const saveToVocabVault = async (text) => {
    try {
      let meaning = '';
      let ipa = '';
      const wordKey = text.toLowerCase().trim();

      // Try hardcoded map first
      if (VOCAB_MAP[wordKey]) {
        const entry = VOCAB_MAP[wordKey];
        meaning = entry.type ? `(${entry.type}) ${entry.meaning}` : entry.meaning;
        ipa = entry.ipa || '';
      } else {
        // Auto-lookup from dictionary API
        const lookup = await lookupWord(text);
        meaning = lookup.meaning || 'Saved from reading test';
        ipa = lookup.ipa || '';
      }

      await axios.post(`${API_URL}/vocab/${user?.id || 1}`, {
        word: text,
        meaning,
        ipa,
        source_lesson_id: lesson.id
      });
      setSavedSelection(true);
    } catch (error) {
      console.error("Failed to save vocab", error);
    }
  };

  if (loading) return <div className="p-8 flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>;
  if (!lesson) return <div className="p-8 text-center text-slate-500">Lesson not found</div>;

  const nextLesson = getNextLesson();
  const answeredCount = Object.keys(answers).length + Object.keys(fillAnswers).length;
  const progressPercent = lesson.questions.length > 0 ? Math.round((answeredCount / lesson.questions.length) * 100) : 0;

  return (
    <div className="h-full flex flex-col bg-secondary">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate('/reading')} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 text-center mx-4">
            <h1 className="font-bold text-slate-800 text-sm md:text-base truncate">{lesson.title}</h1>
            <p className="text-xs text-slate-500">{lesson.chapter}</p>
          </div>
          <div className="flex items-center space-x-2 text-primary-600 bg-primary-50 px-3 py-1.5 rounded-full text-sm font-semibold">
            <Clock size={16} />
            <span>{answeredCount}/{lesson.questions.length}</span>
          </div>
        </div>
        <div className="w-full h-1 bg-slate-100">
          <div className="h-full bg-primary-500 transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden pb-16 md:pb-0">
        <section className="flex-1 md:w-1/2 p-4 md:p-8 bg-white md:border-r border-slate-200 shadow-sm relative overflow-y-auto">
          <div className="max-w-prose mx-auto" ref={textRef}>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6 leading-tight select-text">{lesson.title}</h2>
            <div className="space-y-6 text-slate-700 text-base md:text-lg leading-relaxed font-serif selection:bg-primary-200 selection:text-primary-900">
              {lesson.content.paragraphs && lesson.content.paragraphs.map(p => (
                <p key={p.id} className="text-justify select-text">{p.text}</p>
              ))}
            </div>
          </div>
          
          {/* Floating Action Menu for Text Selection */}
          {selection && !askTeacherText && (
            <div 
              className="fixed z-[100] animate-in fade-in zoom-in-95 duration-200"
              style={{
                top: Math.max(10, selection.rect.top - 60) + 'px',
                left: selection.rect.left + (selection.rect.width / 2) + 'px',
                transform: 'translateX(-50%)' // Center exactly over the word
              }}
            >
              <div className="bg-slate-900 shadow-xl rounded-xl flex items-center p-1.5 text-white/90 gap-1 ring-1 ring-slate-800/50">
                {VOCAB_MAP[selection.text.toLowerCase()] && (
                  <div className="px-3 py-1.5 border-r border-slate-700 max-w-[200px] truncate text-sm">
                    {VOCAB_MAP[selection.text.toLowerCase()].meaning}
                  </div>
                )}
                <button 
                  onClick={() => playAudio(selection.text)}
                  className="p-2 hover:bg-slate-800 hover:text-white rounded-lg transition-colors flex items-center gap-2"
                  title="Listen"
                >
                  <Volume2 size={16} />
                </button>
                <button 
                  onClick={() => saveToVocabVault(selection.text)}
                  className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${savedSelection ? 'text-emerald-400 bg-emerald-400/10' : 'hover:bg-slate-800 hover:text-amber-400'}`}
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
                    className="p-2 hover:bg-slate-800 hover:text-violet-400 rounded-lg transition-colors flex items-center gap-2"
                    title="Ask Teacher"
                  >
                    <HelpCircle size={16} />
                  </button>
                )}
              </div>
              <div className="w-3 h-3 bg-slate-900 absolute left-1/2 -bottom-1.5 transform -translate-x-1/2 rotate-45 border-r border-b border-slate-800/50"></div>
            </div>
          )}
        </section>

        <section className="flex-1 md:w-1/2 overflow-y-auto p-4 md:p-8 bg-slate-50 relative z-0">
          <div className="max-w-xl mx-auto space-y-6 pb-24">
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2">
              Questions 1-{lesson.questions.length}
            </h3>


            {lesson.questions.map((q, idx) => (
              <div key={q.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 transition-all hover:border-primary-200">
                <p className="font-semibold text-slate-800 mb-4 flex">
                  <span className="bg-slate-100 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-3 flex-shrink-0">{idx + 1}</span>
                  {q.question_text}
                </p>

                {q.type === 'multiple_choice' && q.options && (
                  <div className="space-y-2 pl-9">
                    {Object.entries(q.options).map(([key, value]) => {
                      const isSelected = answers[q.id] === key;
                      const isCorrect = key === q.correct_answer;
                      const showFeedback = result !== null;

                      let cls = 'bg-slate-50 hover:bg-slate-100 border-transparent';
                      if (showFeedback) {
                        if (isCorrect) cls = 'bg-green-50 border-green-500';
                        else if (isSelected && !isCorrect) cls = 'bg-red-50 border-red-500';
                        else cls = 'bg-slate-50 opacity-60 border-transparent';
                      } else if (isSelected) {
                        cls = 'bg-primary-50 border-primary-500';
                      }

                      return (
                        <label key={key} className={`flex items-start space-x-3 p-3 rounded-xl cursor-pointer border-2 transition-all ${cls}`}>
                          <input type="radio" name={`q-${q.id}`} value={key} disabled={showFeedback} checked={isSelected}
                            onChange={() => handleAnswerSelect(q.id, key)}
                            className="mt-0.5 text-primary-600 focus:ring-primary-500 cursor-pointer disabled:cursor-auto" />
                          <span className="font-medium w-5 flex-shrink-0 text-slate-600">{key}.</span>
                          <span className={showFeedback && isCorrect ? 'text-green-800 font-medium' : showFeedback && isSelected && !isCorrect ? 'text-red-800 line-through' : isSelected ? 'text-primary-800 font-medium' : 'text-slate-700'}>{value}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {q.type === 'fill_blank' && (
                  <div className="pl-9 mt-2">
                    <input
                      type="text"
                      placeholder="Type your answer..."
                      value={fillAnswers[q.id] || ''}
                      onChange={(e) => handleFillChange(q.id, e.target.value)}
                      disabled={result !== null}
                      className={`w-full px-4 py-2.5 rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-primary-400 ${
                        result !== null
                          ? (fillAnswers[q.id] || '').trim().toLowerCase() === q.correct_answer.toLowerCase()
                            ? 'border-green-500 bg-green-50 text-green-800'
                            : 'border-red-500 bg-red-50 text-red-800'
                          : 'border-slate-200 bg-white'
                      }`}
                    />
                    {result !== null && (fillAnswers[q.id] || '').trim().toLowerCase() !== q.correct_answer.toLowerCase() && (
                      <p className="text-sm text-green-600 mt-1 font-medium">Correct answer: {q.correct_answer}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Bottom Action Bar */}
          {result ? (
            <div className="fixed md:absolute bottom-16 md:bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-slate-200 z-10">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 max-w-xl mx-auto">
                <div className="text-lg font-bold text-slate-800">
                  Score: <span className="text-primary-600 text-2xl ml-1">{result.score}%</span>
                  <span className="text-sm font-medium text-slate-500 ml-2">({result.correct}/{result.total})</span>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button onClick={() => navigate('/reading')}
                    className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-3 rounded-xl font-semibold transition-colors">
                    <ArrowLeft size={16} />
                    <span>All Lessons</span>
                  </button>
                  {nextLesson && (
                    <button onClick={() => navigate(`/reading/${nextLesson.id}`)}
                      className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-3 rounded-xl font-semibold shadow-lg transition-colors">
                      <span>Next Lesson</span>
                      <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : !isViewMode && (
            <div className="fixed md:absolute bottom-16 md:bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-slate-200 flex justify-end z-10">
              <button onClick={handleSubmit} disabled={isSubmitting}
                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold shadow-lg transition-transform ${isSubmitting ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800 text-white hover:scale-105'}`}>
                <span>{isSubmitting ? 'Submitting...' : 'Submit Answers'}</span>
                {!isSubmitting && <CheckCircle size={18} />}
              </button>
            </div>
          )}
        </section>
      </div>

      {askTeacherText && (
        <AskTeacherPopup
          questionText={askTeacherText}
          lessonId={lesson.id}
          onClose={() => setAskTeacherText(null)}
        />
      )}
    </div>
  );
};

export default ReadingTest;
