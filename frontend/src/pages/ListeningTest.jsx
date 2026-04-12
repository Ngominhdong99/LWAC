import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { ArrowLeft, ArrowRight, Play, Pause, RotateCcw, CheckCircle, Headphones, Volume2 } from 'lucide-react';
import API_URL from '../api';
import { speakNatural, cancelSpeech } from '../utils/tts';

// Check if user's answer matches any accepted correct answer (supports pipe-separated alternatives)
const checkSingleBlank = (userAnswer, correctAnswer) => {
  const trimmed = (userAnswer || '').trim().toLowerCase();
  if (!trimmed) return false;
  const acceptedAnswers = (correctAnswer || '').split('|').map(a => a.trim().toLowerCase());
  return acceptedAnswers.some(a => a === trimmed);
};

const getBlankCount = (correctAnswer) => {
  if (!correctAnswer) return 1;
  return correctAnswer.split(';').length;
};

const checkWrittenAnswer = (userAnswer, correctAnswer) => {
  const blankCount = getBlankCount(correctAnswer);
  if (blankCount === 1) return checkSingleBlank(userAnswer, correctAnswer);
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

const ListeningTest = () => {
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
  const [playingAudio, setPlayingAudio] = useState(null); // 'global' or exerciseId
  const [playCounts, setPlayCounts] = useState({}); // { 'global': count, id: count }
  const [showTranscript, setShowTranscript] = useState(false);
  const audioRef = useRef(null);
  const [audioSrc, setAudioSrc] = useState(null);
  const [coachFeedback, setCoachFeedback] = useState(null);
  const toast = useToast();

  const playCountKey = `lwac_listening_plays_${user?.id}_${id}`;

  useEffect(() => {
    setLesson(null);
    setAnswers({});
    setFillAnswers({});
    setResult(null);
    setLoading(true);
    setPlayCounts({});
    setShowTranscript(false);

    const fetchData = async () => {
      try {
        const [lessonRes, allRes] = await Promise.all([
          axios.get(`${API_URL}/lessons/${id}`),
          axios.get(`${API_URL}/lessons/`)
        ]);
        setLesson(lessonRes.data);
        setAllLessons(allRes.data.filter(l => l.type === 'listening'));

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
              setShowTranscript(true);
            }
          } catch (e) { console.error('Failed to load result for view mode', e); }
        } else if (!isViewMode && user) {
          // Restore play counts from localStorage
          try {
            const savedPlays = localStorage.getItem(playCountKey);
            if (savedPlays) {
               try {
                  const dict = JSON.parse(savedPlays);
                  if (typeof dict === 'object') setPlayCounts(dict);
                  else setPlayCounts({ 'global': parseInt(savedPlays) || 0 }); // Legacy string parsing
               } catch(ex) {
                  setPlayCounts({ 'global': parseInt(savedPlays) || 0 });
               }
            }
          } catch (e) { /* ignore */ }

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
              setShowTranscript(true);
            } else {
              // Restore answers from localStorage only if not yet submitted or retake
              try {
                const saved = localStorage.getItem(`lwac_listening_${user?.id}_${id}`);
                if (saved) {
                  const parsed = JSON.parse(saved);
                  if (parsed.answers) setAnswers(parsed.answers);
                  if (parsed.fillAnswers) setFillAnswers(parsed.fillAnswers);
                }
              } catch (e) { /* ignore */ }
            }
          } catch (e) {
            try {
              const saved = localStorage.getItem(`lwac_listening_${user?.id}_${id}`);
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

    return () => {
      cancelSpeech();
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [id]);

  // Auto-save to localStorage
  useEffect(() => {
    if (isViewMode || result) return;
    const hasAnswers = Object.keys(answers).length > 0 || Object.keys(fillAnswers).length > 0;
    if (hasAnswers) {
      localStorage.setItem(`lwac_listening_${user?.id}_${id}`, JSON.stringify({ answers, fillAnswers }));
    }
  }, [answers, fillAnswers]);

  // Persist play counts to localStorage
  useEffect(() => {
    if (Object.keys(playCounts).length > 0) {
      localStorage.setItem(playCountKey, JSON.stringify(playCounts));
    }
  }, [playCounts]);

  // Save on beforeunload
  useEffect(() => {
    if (isViewMode) return;
    const handleBeforeUnload = () => {
      const hasAnswers = Object.keys(answers).length > 0 || Object.keys(fillAnswers).length > 0;
      if (hasAnswers && !result) {
        localStorage.setItem(`lwac_listening_${user?.id}_${id}`, JSON.stringify({ answers, fillAnswers }));
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [answers, fillAnswers, result, isViewMode]);

  const getNextLesson = () => {
    if (!allLessons.length || !lesson) return null;
    const currentIdx = allLessons.findIndex(l => l.id === lesson.id);
    if (currentIdx >= 0 && currentIdx < allLessons.length - 1) return allLessons[currentIdx + 1];
    return null;
  };

  const playAudio = (audioId, url, transcript) => {
    if (playingAudio === audioId) {
      if (audioRef.current) audioRef.current.pause();
      else cancelSpeech();
      setPlayingAudio(null);
      return;
    }

    // Stop currently playing audio first
    if (playingAudio) {
      if (audioRef.current) audioRef.current.pause();
      else cancelSpeech();
    }

    const currentCount = playCounts[audioId] || 0;
    // Max 2 plays like real IELTS
    if (currentCount >= 2 && !result) {
      toast.warning('You have already played this audio 2 times (same as real IELTS).');
      return;
    }

    if (url) {
      let audioUrl = url;
      if (audioUrl.startsWith('/static')) audioUrl = `${API_URL}${audioUrl}`;
      setAudioSrc(audioUrl);
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play().then(() => setPlayingAudio(audioId)).catch(e => {
            console.error("Playback Error:", e);
            setPlayingAudio(null);
            toast.warning('Could not play audio. Please tap the play button again.');
          });
        }
      }, 100);
    } else if (transcript) {
      speakNatural(transcript, {
        rate: 0.9,
        onstart: () => setPlayingAudio(audioId),
        onend: () => {
          setPlayingAudio(null);
          setPlayCounts(prev => ({ ...prev, [audioId]: (prev[audioId] || 0) + 1 }));
        },
        onerror: () => setPlayingAudio(null),
      });
    } else {
      toast.info('No audio available for this exercise.');
    }
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
    const totalAnswered = Object.keys(answers).length + Object.keys(fillAnswers).length;
    if (totalAnswered < lesson.questions.length) {
      toast.warning('Please answer all questions before submitting.');
      return;
    }

    setIsSubmitting(true);
    let score = 0;

    lesson.questions.forEach(q => {
      if (q.type === 'multiple_choice') {
        if (answers[q.id] === q.correct_answer) score++;
      } else if (q.type === 'fill_blank' || q.type === 'written_answer') {
        const userAns = (fillAnswers[q.id] || '').trim().toLowerCase();
        if (checkWrittenAnswer(fillAnswers[q.id] || '', q.correct_answer || '')) score++;
      }
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
      setShowTranscript(true);
      toast.success(`You scored ${normalizedScore}% (${score}/${lesson.questions.length})`, 'Test Submitted!');
      // Clear auto-saved data after successful submission
      localStorage.removeItem(`lwac_listening_${user?.id}_${id}`);
      localStorage.removeItem(playCountKey);
    } catch (error) {
      console.error("Failed to submit results", error);
      toast.error('Error saving results.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>;
  if (!lesson) return <div className="p-8 text-center text-slate-500">Lesson not found</div>;

  const nextLesson = getNextLesson();
  const answeredCount = Object.keys(answers).length + Object.keys(fillAnswers).length;
  const progressPercent = lesson.questions.length > 0 ? Math.round((answeredCount / lesson.questions.length) * 100) : 0;
  const hasAudio = !!(lesson.media_url || lesson.content?.transcript || (lesson.exercises && lesson.exercises.some(ex => ex.audio_url)));

  const displayExercises = lesson?.exercises && lesson.exercises.length > 0 
    ? lesson.exercises 
    : [{
        id: 'global-fallback',
        title: '',
        context: lesson?.content?.passage || '',
        image_url: lesson?.content?.image_url || '',
        audio_url: lesson?.media_url || '',
        video_url: lesson?.content?.video_url || '',
        transcript: lesson?.content?.transcript || '',
        isFallback: true,
        questions: lesson?.questions || []
      }];
  return (
    <div className="h-full flex flex-col bg-secondary">
      {/* Hidden audio element for mobile compatibility */}
      <audio
        ref={audioRef}
        src={audioSrc}
        preload="auto"
        onEnded={() => { 
          if(playingAudio) {
            setPlayCounts(prev => ({ ...prev, [playingAudio]: (prev[playingAudio] || 0) + 1 }));
          }
          setPlayingAudio(null); 
        }}
        onError={() => { setPlayingAudio(null); console.error('Audio element error'); }}
        style={{ display: 'none' }}
      />
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate('/reading')} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 text-center mx-4">
            <h1 className="font-bold text-slate-800 text-sm md:text-base truncate">{lesson.title}</h1>
            <p className="text-xs text-slate-500">{lesson.chapter} &bull; Listening</p>
          </div>
          <div className="flex items-center space-x-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full text-sm font-semibold">
            <Headphones size={16} />
            <span>Limited Plays</span>
          </div>
        </div>
        <div className="w-full h-1 bg-slate-100">
          <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden pb-16 md:pb-0">
        {/* Left: Audio Player & Transcript */}
        <section className="md:w-1/2 overflow-y-auto p-4 md:p-8 bg-white md:border-r border-slate-200 shadow-sm relative z-0">
          <div className="max-w-prose mx-auto">
            {/* Exercise-based Left Side */}
            <div className="space-y-8">
              {displayExercises.map((ex, exIdx) => (
                <div key={ex.id} className="space-y-4">
                  {displayExercises.length > 1 && !ex.isFallback && (
                    <div className="flex items-center space-x-2 sticky top-0 bg-white/90 backdrop-blur-sm py-2 z-10">
                      <span className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">{exIdx + 1}</span>
                      <h3 className="text-lg font-bold text-amber-800">{ex.title || `Exercise ${exIdx + 1}`}</h3>
                    </div>
                  )}

                  {ex.context && (
                    <div className="mb-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                      <h4 className="font-bold text-slate-800 mb-3">Context / Background</h4>
                      <div className="text-slate-700 text-sm md:text-base leading-relaxed">
                        <MarkdownRenderer>{ex.context}</MarkdownRenderer>
                      </div>
                    </div>
                  )}

                  {ex.audio_url && (
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-200 mb-6">
                      <div className="flex flex-col items-center space-y-4">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all ${playingAudio === ex.id ? 'bg-amber-500 scale-110 animate-pulse' : 'bg-amber-400'}`}>
                          <Headphones size={28} className="text-white" />
                        </div>
                        
                        <button
                          onClick={() => playAudio(ex.id, ex.audio_url, null)}
                          disabled={(playCounts[ex.id] || 0) >= 2 && playingAudio !== ex.id && !result}
                          className={`flex items-center space-x-3 px-6 py-2.5 rounded-xl font-semibold text-base transition-all shadow-md ${
                            playingAudio === ex.id
                              ? 'bg-red-500 hover:bg-red-600 text-white'
                              : (playCounts[ex.id] || 0) >= 2 && !result
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-amber-500 hover:bg-amber-600 text-white hover:scale-105'
                          }`}
                        >
                          {playingAudio === ex.id ? <Pause size={20} /> : <Play size={20} />}
                          <span>{playingAudio === ex.id ? 'Pause' : (playCounts[ex.id] || 0) === 0 ? 'Play Audio' : `Play Again (${2 - (playCounts[ex.id] || 0)} left)`}</span>
                        </button>

                        {/* Volume indicator when playing */}
                        {playingAudio === ex.id && (
                          <div className="flex items-center space-x-1">
                            {[1,2,3,4,5].map(i => (
                              <div key={i} className="w-1 bg-amber-400 rounded-full animate-pulse" style={{ height: `${8 + Math.random() * 16}px`, animationDelay: `${i * 0.1}s` }}></div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {ex.image_url && (
                    <div className="mb-4">
                      <img 
                        src={ex.image_url.startsWith('http') ? ex.image_url : `${API_URL}${ex.image_url}`} 
                        alt="Exercise"
                        className="w-full rounded-xl shadow-md border border-slate-200"
                      />
                    </div>
                  )}

                  {/* Transcript for this exercise (shown after submit) */}
                  {showTranscript && ex.transcript && (
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 mt-4">
                      <h4 className="font-bold text-slate-700 mb-3 flex items-center space-x-2">
                        <Volume2 size={16} />
                        <span>Transcript</span>
                      </h4>
                      <div className="text-slate-600 text-sm italic">
                        <MarkdownRenderer>{ex.transcript}</MarkdownRenderer>
                      </div>
                    </div>
                  )}

                  {exIdx < displayExercises.length - 1 && (
                    <hr className="border-slate-200 my-6" />
                  )}
                </div>
              ))}
            </div>

            {/* Video Player (if provided globally) */}
            {lesson.content?.video_url && (
              <div className="bg-slate-900 rounded-2xl overflow-hidden mb-6 border border-slate-700 mt-6">
                {(() => {
                  const url = lesson.content.video_url;
                  const finalUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
                  const ytMatch = finalUrl.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
                  if (ytMatch && ytMatch[2].length === 11) {
                    return (
                      <iframe
                        className="w-full aspect-video"
                        src={`https://www.youtube.com/embed/${ytMatch[2]}`}
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      ></iframe>
                    );
                  }
                  return (
                    <video controls className="w-full" src={finalUrl}>
                      Your browser does not support the video tag.
                    </video>
                  );
                })()}
              </div>
            )}

            {!showTranscript && (
              <div className="text-center py-8 text-slate-400 text-sm">
                <p>The transcript will be revealed after you submit your answers.</p>
              </div>
            )}
          </div>
        </section>

        {/* Right: Questions */}
        <section className="flex-1 md:w-1/2 overflow-y-auto p-4 md:p-8 bg-slate-50 relative z-0">
          <div className="max-w-xl mx-auto space-y-6 pb-24">
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2">Questions 1-{lesson.questions.length}</h3>

            {displayExercises.map((ex, exIdx) => {
              const prevQuestionCount = displayExercises.slice(0, exIdx).reduce((sum, e) => sum + (e.questions?.length || 0), 0);
              return (
                <div key={ex.id}>
                  {displayExercises.length > 1 && !ex.isFallback && (
                    <div className="flex items-center gap-3 mt-6 mb-4">
                      <span className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">{exIdx + 1}</span>
                      <h4 className="text-sm font-bold text-amber-700 uppercase tracking-wider">{ex.title || `Exercise ${exIdx + 1}`}</h4>
                      <div className="flex-1 h-px bg-slate-200"></div>
                    </div>
                  )}
                  {(ex.questions || []).map((q, qIdx) => {
                    const globalIdx = prevQuestionCount + qIdx;
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
                                    : 'border-slate-300 focus:border-amber-500 text-amber-700 font-semibold'
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
                                : checkWrittenAnswer(fillAnswers[q.id] || '', q.correct_answer || '') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              : (answers[q.id] || fillAnswers[q.id]) ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
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

                              const isMultiBlank = (q.correct_answer || '').includes(';');

                              if (q.type === 'multiple_choice') {
                                return (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
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
                                              : isSelected ? 'bg-amber-50 border-amber-500 shadow-sm'
                                              : 'border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50'
                                          }`}
                                        >
                                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 mr-3 transition-colors ${
                                            showCorrect ? 'bg-green-500 text-white'
                                              : showWrong ? 'bg-red-500 text-white'
                                              : isSelected ? 'bg-amber-500 text-white'
                                              : 'bg-slate-100 text-slate-600 group-hover/opt:bg-slate-200'
                                          }`}>
                                            {key}
                                          </span>
                                          <span className={`text-sm mt-0.5 font-medium leading-tight ${
                                            showCorrect ? 'text-green-900' : showWrong ? 'text-red-900' : isSelected ? 'text-amber-900' : 'text-slate-700'
                                          }`}>{val}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                );
                              }

                              return (
                                <div className="space-y-3 relative mt-4">
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
                                            className={`w-full pl-16 pr-4 py-2.5 rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-amber-400 ${
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
                                      className={`w-full px-4 py-2.5 rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y ${
                                        result !== null
                                          ? checkWrittenAnswer(fillAnswers[q.id] || '', q.correct_answer || '')
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
                                      className={`w-full px-4 py-2.5 rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                                        result !== null
                                          ? checkWrittenAnswer(fillAnswers[q.id] || '', q.correct_answer || '')
                                            ? 'border-green-500 bg-green-50 text-green-800'
                                            : 'border-red-500 bg-red-50 text-red-800'
                                          : 'border-slate-200 bg-white'
                                      }`}
                                    />
                                  )}
                                  {!isMultiBlank && result !== null && !checkWrittenAnswer(fillAnswers[q.id] || '', q.correct_answer || '') && (
                                    <p className="text-sm text-green-600 mt-1 font-medium">Correct answer: {(q.correct_answer || '').split('|').map(a => a.trim()).join(' / ')}</p>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Coach note for this question */}
                            {coachFeedback?.[String(q.id)] && (
                              <div className="mt-3">
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">💬 Coach's Note</p>
                                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{coachFeedback[String(q.id)]}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          {/* Bottom Action Bar */}
          {result ? (
            <div className="fixed md:absolute bottom-16 md:bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-slate-200 z-10">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 max-w-xl mx-auto">
                <div className="text-lg font-bold text-slate-800">
                  Score: <span className="text-amber-600 text-2xl ml-1">{result.score}%</span>
                  <span className="text-sm font-medium text-slate-500 ml-2">({result.correct}/{result.total})</span>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button onClick={() => navigate('/reading')}
                    className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-3 rounded-xl font-semibold transition-colors">
                    <ArrowLeft size={16} />
                    <span>All Lessons</span>
                  </button>
                  {nextLesson && (
                    <button onClick={() => navigate(`/listening/${nextLesson.id}`)}
                      className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 rounded-xl font-semibold shadow-lg transition-colors">
                      <span>Next</span>
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
    </div>
  );
};

export default ListeningTest;
