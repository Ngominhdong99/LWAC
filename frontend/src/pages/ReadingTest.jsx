import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import AskTeacherPopup from '../components/AskTeacherPopup';
import { ArrowLeft, ArrowRight, Clock, CheckCircle, Plus, HelpCircle, Volume2, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import MarkdownRenderer from '../components/MarkdownRenderer';
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

// Check if user's answer matches any accepted correct answer (supports pipe-separated alternatives)
const checkSingleBlank = (userAnswer, correctAnswer) => {
  const trimmed = (userAnswer || '').trim().toLowerCase();
  if (!trimmed) return false;
  const acceptedAnswers = (correctAnswer || '').split('|').map(a => a.trim().toLowerCase());
  return acceptedAnswers.some(a => a === trimmed);
};

// Multi-blank: correct_answer uses ; to separate blanks, | for alternatives within each blank
// e.g. "doesn't eat|does not eat ; make"
const getBlankCount = (correctAnswer) => {
  if (!correctAnswer) return 1;
  return correctAnswer.split(';').length;
};

const checkWrittenAnswer = (userAnswer, correctAnswer) => {
  const blankCount = getBlankCount(correctAnswer);
  if (blankCount === 1) return checkSingleBlank(userAnswer, correctAnswer);
  // Multi-blank: userAnswer stored as "ans1;;ans2;;ans3"
  const parts = (correctAnswer || '').split(';');
  const userParts = (userAnswer || '').split(';;');
  return parts.every((part, i) => checkSingleBlank(userParts[i] || '', part));
};

const getBlankAnswerPart = (fillAnswer, blankIndex) => {
  const parts = (fillAnswer || '').split(';;');
  return parts[blankIndex] || '';
};

const setBlankAnswerPart = (fillAnswer, blankIndex, value, totalBlanks) => {
  const parts = (fillAnswer || '').split(';;');
  while (parts.length < totalBlanks) parts.push('');
  parts[blankIndex] = value;
  return parts.join(';;');
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
  const [coachFeedback, setCoachFeedback] = useState(null);
  const textRef = useRef(null);
  const toast = useToast();

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
                    else if (q.type === 'fill_blank' || q.type === 'written_answer') savedFb[q.id] = val;
                  }
                });
              }
              setAnswers(savedMc);
              setFillAnswers(savedFb);
              const correctCount = questions.reduce((acc, q) => {
                if (q.type === 'multiple_choice' && savedMc[q.id] === q.correct_answer) return acc + 1;
                if ((q.type === 'fill_blank' || q.type === 'written_answer') && checkWrittenAnswer((savedFb[q.id] || ''), q.correct_answer)) return acc + 1;
                return acc;
              }, 0);
              setResult({ score: latest.score, correct: correctCount, total: questions.length });
              setCoachFeedback(latest.responses?.coach_notes || null);
            }
          } catch (e) { console.error('Failed to load result for view mode', e); }
        } else if (!isViewMode && user) {
          // Check if already submitted (prevents re-submit on F5)
          try {
            const [resResults, resAssignments] = await Promise.all([
              axios.get(`${API_URL}/results/${user.id}`),
              axios.get(`${API_URL}/coach/students/${user.id}/assignments`)
            ]);
            
            const lessonAssignment = resAssignments.data.find(a => a.lesson_id === parseInt(id));
            const isRetakeAllowed = lessonAssignment?.allow_retake === true;

            const lessonResults = resResults.data.filter(r => r.lesson_id === parseInt(id));
            
            // Only force View mode if they have results AND retake is not allowed
            if (lessonResults.length > 0 && !isRetakeAllowed) {
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
                if ((q.type === 'fill_blank' || q.type === 'written_answer') && checkWrittenAnswer((savedFb[q.id] || ''), (q.correct_answer || ''))) return acc + 1;
                return acc;
              }, 0);
              setResult({ score: latest.score, correct: correctCount, total: questions.length });
              setCoachFeedback(latest.responses?.coach_notes || null);
              localStorage.removeItem(`lwac_reading_${user?.id}_${id}`);
            } else {
              // Restore from localStorage only if not yet submitted or if retaking
              try {
                const saved = localStorage.getItem(`lwac_reading_${user?.id}_${id}`);
                if (saved) {
                  const parsed = JSON.parse(saved);
                  if (parsed.answers) setAnswers(parsed.answers);
                  if (parsed.fillAnswers) setFillAnswers(parsed.fillAnswers);
                }
              } catch (e) { /* ignore */ }
            }
          } catch (e) {
            // If result check fails, fall back to localStorage
            try {
              const saved = localStorage.getItem(`lwac_reading_${user?.id}_${id}`);
              if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.answers) setAnswers(parsed.answers);
                if (parsed.fillAnswers) setFillAnswers(parsed.fillAnswers);
              }
            } catch (e2) { /* ignore */ }
          }
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
    const fbQuestions = lesson.questions.filter(q => q.type === 'fill_blank' || q.type === 'written_answer');

    const totalAnswered = Object.keys(answers).length + Object.keys(fillAnswers).length;
    if (totalAnswered < lesson.questions.length) {
      toast.warning('Please answer all questions before submitting.');
      return;
    }

    setIsSubmitting(true);
    let score = 0;

    mcQuestions.forEach(q => {
      if (answers[q.id] === q.correct_answer) score++;
    });
    fbQuestions.forEach(q => {
      const userAns = (fillAnswers[q.id] || '').trim().toLowerCase();
      if (checkWrittenAnswer(fillAnswers[q.id] || '', q.correct_answer)) score++;
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
      toast.success(`You scored ${normalizedScore}% (${score}/${lesson.questions.length})`, 'Test Submitted!');
      // Clear auto-saved data after successful submission
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error("Failed to submit results", error);
      toast.error('Error saving results to server.');
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

  // Helper: renders a single question card
  const renderQuestion = (q, globalIdx) => {
    const hasInlineBlanks = (q.type === 'fill_blank' || q.type === 'written_answer') && /(_{2,}|\.{3,})/.test(q.question_text || '');

    const renderInlineText = () => {
      if (!hasInlineBlanks) return null;
      const parts = (q.question_text || '').split(/(_{2,}|\.{3,})/g);
      let blankIndex = 0;
      const blankCount = getBlankCount(q.correct_answer);
      const correctParts = (q.correct_answer || '').split(';').map(p => p.trim());

      return parts.map((part, bIdx) => {
        if (/^_{2,}$|^\.{3,}$/.test(part)) {
          const currentBIdx = blankIndex++;
          const userVal = getBlankAnswerPart(fillAnswers[q.id], currentBIdx);
          const correctPart = correctParts[currentBIdx] || '';
          const isBlankCorrect = result !== null && checkSingleBlank(userVal, correctPart);
          const isBlankWrong = result !== null && !checkSingleBlank(userVal, correctPart);

          return (
            <span key={bIdx} className="relative inline-flex items-center">
              <input
                type="text"
                value={userVal}
                disabled={result !== null || isViewMode}
                onChange={(e) => {
                  const newVal = setBlankAnswerPart(fillAnswers[q.id] || '', currentBIdx, e.target.value, blankCount);
                  handleFillChange(q.id, newVal);
                }}
                placeholder={`${globalIdx + 1}.${currentBIdx + 1}`}
                className={`inline-block mx-1 px-2 py-1 border-b-2 bg-transparent focus:bg-slate-50 focus:outline-none transition-all w-28 md:w-36 text-center disabled:opacity-100 ${
                  result !== null
                    ? isBlankCorrect ? 'border-green-500 text-green-700 bg-green-50/50' : 'border-red-500 text-red-700 bg-red-50/50 line-through decoration-red-400'
                    : 'border-slate-300 focus:border-primary-500 text-primary-700 font-semibold'
                }`}
              />
              {isBlankWrong && (
                <span className="text-green-600 font-bold text-xs ml-1 bg-green-50 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                  ✓ {correctPart.split('|').map(a => a.trim()).join(' / ')}
                </span>
              )}
            </span>
          );
        }
        return <span key={bIdx}>{part}</span>;
      });
    };

    return (
      <div key={q.id} id={`question-${q.id}`} className="group scroll-mt-24 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all">
        <div className="flex gap-4">
          <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0 shadow-sm text-sm ${
            result !== null
              ? q.type === 'multiple_choice'
                ? answers[q.id] === q.correct_answer ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                : checkWrittenAnswer(fillAnswers[q.id] || '', q.correct_answer) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              : (answers[q.id] || fillAnswers[q.id]) ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-600'
          }`}>
            {globalIdx + 1}
          </span>
          <div className="flex-1 w-full overflow-hidden">
            {(q.type !== 'fill_blank' || !hasInlineBlanks) && (
              <div className="text-base text-slate-800 font-semibold mb-4 leading-relaxed">{q.question_text}</div>
            )}

            {(() => {
              if (hasInlineBlanks) {
                return (
                  <div className="text-base text-slate-800 font-medium leading-[2.5rem] p-4 bg-slate-50/50 rounded-xl border border-slate-100 text-justify">
                    {renderInlineText()}
                  </div>
                );
              }

              const isMultiBlank = q.correct_answer?.includes(';');

              if (q.type === 'multiple_choice') {
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(q.options || {}).map(([key, val]) => {
                      const isSelected = answers[q.id] === key;
                      const isCorrect = key === q.correct_answer;
                      const showCorrect = result !== null && isCorrect;
                      const showWrong = result !== null && isSelected && !isCorrect;

                      return (
                        <button
                          key={key}
                          onClick={() => handleAnswerSelect(q.id, key)}
                          disabled={result !== null || isViewMode}
                          className={`flex items-start text-left p-3 rounded-xl border-2 transition-all group/opt ${
                            showCorrect ? 'bg-green-50 border-green-500 shadow-sm'
                              : showWrong ? 'bg-red-50 border-red-500 shadow-sm'
                              : isSelected ? 'bg-primary-50 border-primary-500 shadow-sm'
                              : 'border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 mr-3 transition-colors ${
                            showCorrect ? 'bg-green-500 text-white'
                              : showWrong ? 'bg-red-500 text-white'
                              : isSelected ? 'bg-primary-500 text-white'
                              : 'bg-slate-100 text-slate-600 group-hover/opt:bg-slate-200'
                          }`}>
                            {key}
                          </span>
                          <span className={`text-sm mt-0.5 font-medium leading-tight ${
                            showCorrect ? 'text-green-900' : showWrong ? 'text-red-900' : isSelected ? 'text-primary-900' : 'text-slate-700'
                          }`}>{val}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              }

              return (
                <div className="space-y-3 relative">
                  {isMultiBlank ? (
                    (q.correct_answer || '').split(';').map((correctPart, bIdx) => {
                      const userVal = getBlankAnswerPart(fillAnswers[q.id], bIdx);
                      const isBlankCorrect = checkWrittenAnswer(userVal, correctPart);
                      const isBlankWrong = result !== null && !isBlankCorrect;

                      return (
                        <div key={bIdx} className="relative">
                          <div className="absolute left-3 top-3 text-xs font-bold text-slate-400">Blank {bIdx + 1}</div>
                          <input
                            type="text"
                            placeholder={`Answer ${bIdx + 1}`}
                            value={userVal}
                            onChange={(e) => {
                              if (result || isViewMode) return;
                              const currentVals = (fillAnswers[q.id] || '').split(';');
                              const blankCount = getBlankCount(q.correct_answer);
                              while (currentVals.length < blankCount) currentVals.push('');
                              currentVals[bIdx] = e.target.value;
                              setFillAnswers({ ...fillAnswers, [q.id]: currentVals.join(' ; ') });
                            }}
                            disabled={result !== null || isViewMode}
                            className={`w-full pl-16 pr-4 py-2.5 rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-primary-400 ${
                              isBlankCorrect ? 'border-green-500 bg-green-50 text-green-800'
                                : isBlankWrong ? 'border-red-500 bg-red-50 text-red-800'
                                : 'border-slate-200 bg-white'
                            }`}
                          />
                          {isBlankWrong && (
                            <p className="text-sm text-green-600 mt-0.5 font-medium">
                              Correct: {correctPart.split('|').map(a => a.trim()).join(' / ')}
                            </p>
                          )}
                        </div>
                      );
                    })
                  ) : q.type === 'written_answer' ? (
                    <textarea
                      placeholder="Type your answer here..."
                      rows={3}
                      value={fillAnswers[q.id] || ''}
                      onChange={(e) => handleFillChange(q.id, e.target.value)}
                      disabled={result !== null || isViewMode}
                      className={`w-full px-4 py-2.5 rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-primary-400 resize-y ${
                        result !== null
                          ? checkWrittenAnswer(fillAnswers[q.id] || '', q.correct_answer)
                            ? 'border-green-500 bg-green-50 text-green-800'
                            : 'border-red-500 bg-red-50 text-red-800'
                          : 'border-slate-200 bg-white'
                      }`}
                    />
                  ) : (
                    <input
                      type="text"
                      placeholder="Type your answer..."
                      value={fillAnswers[q.id] || ''}
                      onChange={(e) => handleFillChange(q.id, e.target.value)}
                      disabled={result !== null || isViewMode}
                      className={`w-full px-4 py-2.5 rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-primary-400 ${
                        result !== null
                          ? checkWrittenAnswer(fillAnswers[q.id] || '', q.correct_answer)
                            ? 'border-green-500 bg-green-50 text-green-800'
                            : 'border-red-500 bg-red-50 text-red-800'
                          : 'border-slate-200 bg-white'
                      }`}
                    />
                  )}
                  {!isMultiBlank && result !== null && !checkWrittenAnswer(fillAnswers[q.id] || '', q.correct_answer) && (
                    <p className="text-sm text-green-600 mt-1 font-medium">Correct answer: {q.correct_answer.split('|').map(a => a.trim()).join(' / ')}</p>
                  )}
                </div>
              );
            })()}

            {/* Coach note */}
            {coachFeedback?.[String(q.id)] && (
              <div className="mt-3">
                <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-primary-700 uppercase tracking-wider mb-1">💬 Coach's Note</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{coachFeedback[String(q.id)]}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-secondary" ref={textRef}>
      {/* Sticky Header */}
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

      {/* Single Scrollable Exam Paper */}
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-8">

          {/* Exercise-based layout */}
          {lesson.exercises && lesson.exercises.length > 0 ? (
            lesson.exercises.map((ex, exIdx) => {
              const prevQuestionCount = lesson.exercises.slice(0, exIdx).reduce((sum, e) => sum + (e.questions?.length || 0), 0);
              const exerciseQuestions = ex.questions || [];

              return (
                <section key={ex.id} className="space-y-6">
                  {/* Exercise Header */}
                  {lesson.exercises.length > 1 && (
                    <div className="flex items-center gap-3 sticky top-0 bg-secondary/95 backdrop-blur-sm py-3 z-10 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200/60">
                      <span className="w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center text-sm font-bold shadow-sm">{exIdx + 1}</span>
                      <h2 className="text-lg font-bold text-primary-800 tracking-tight">{ex.title || `Exercise ${exIdx + 1}`}</h2>
                      <div className="flex-1 h-px bg-slate-300/50"></div>
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Q{prevQuestionCount + 1}–{prevQuestionCount + exerciseQuestions.length}
                      </span>
                    </div>
                  )}

                  {/* Exercise Image */}
                  {ex.image_url && (
                    <div className="rounded-2xl overflow-hidden shadow-md border border-slate-200">
                      <img
                        src={ex.image_url.startsWith('http') ? ex.image_url : `${API_URL}${ex.image_url}`}
                        alt={ex.title || `Exercise ${exIdx + 1}`}
                        className="w-full object-contain max-h-[500px] bg-slate-50"
                      />
                    </div>
                  )}

                  {/* Reading Passage */}
                  {ex.context && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
                      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                        <div className="w-1 h-5 bg-primary-500 rounded-full"></div>
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Reading Passage</h3>
                      </div>
                      <div className="text-slate-700 text-base md:text-[17px] leading-relaxed md:leading-[1.9] font-serif selection:bg-primary-200 selection:text-primary-900 select-text text-justify">
                        <MarkdownRenderer>{ex.context}</MarkdownRenderer>
                      </div>
                    </div>
                  )}

                  {/* Questions */}
                  {exerciseQuestions.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 px-1">
                        <div className="w-1 h-5 bg-primary-500 rounded-full"></div>
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                          Questions {prevQuestionCount + 1}–{prevQuestionCount + exerciseQuestions.length}
                        </h3>
                      </div>
                      {exerciseQuestions.map((q, qIdx) => renderQuestion(q, prevQuestionCount + qIdx))}
                    </div>
                  )}

                  {/* Exercise Divider */}
                  {exIdx < lesson.exercises.length - 1 && (
                    <div className="flex items-center gap-4 py-2">
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>
                    </div>
                  )}
                </section>
              );
            })
          ) : (
            /* Legacy single-passage layout */
            <section className="space-y-6">
              {/* Image */}
              {lesson.content?.image_url && (
                <div className="rounded-2xl overflow-hidden shadow-md border border-slate-200">
                  <img
                    src={lesson.content.image_url.startsWith('http') ? lesson.content.image_url : `${API_URL}${lesson.content.image_url}`}
                    alt={lesson.title}
                    className="w-full object-contain max-h-[500px] bg-slate-50"
                  />
                </div>
              )}

              {/* Reading Passage */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                  <div className="w-1 h-5 bg-primary-500 rounded-full"></div>
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Reading Passage</h3>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6 leading-tight">{lesson.title}</h2>
                <div className="text-slate-700 text-base md:text-[17px] leading-relaxed md:leading-[1.9] font-serif selection:bg-primary-200 selection:text-primary-900 select-text text-justify">
                  {lesson.content.paragraphs ? (
                    lesson.content.paragraphs.map(p => (
                      <p key={p.id} className="mb-4 select-text">{p.text}</p>
                    ))
                  ) : lesson.content.passage ? (
                    <MarkdownRenderer>{lesson.content.passage}</MarkdownRenderer>
                  ) : null}
                </div>
              </div>

              {/* Questions */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-1 h-5 bg-primary-500 rounded-full"></div>
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                    Questions 1–{lesson.questions.length}
                  </h3>
                </div>
                {lesson.questions.map((q, idx) => renderQuestion(q, idx))}
              </div>
            </section>
          )}
        </div>

        {/* Bottom Action Bar */}
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-slate-200 z-30">
          {result ? (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 max-w-3xl mx-auto">
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
          ) : !isViewMode && (
            <div className="flex justify-end max-w-3xl mx-auto">
              <button onClick={handleSubmit} disabled={isSubmitting}
                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold shadow-lg transition-transform ${isSubmitting ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800 text-white hover:scale-105'}`}>
                <span>{isSubmitting ? 'Submitting...' : 'Submit Answers'}</span>
                {!isSubmitting && <CheckCircle size={18} />}
              </button>
            </div>
          )}
        </div>
      </main>

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

