import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, ArrowRight, Play, Pause, RotateCcw, CheckCircle, Headphones, Volume2 } from 'lucide-react';

const ListeningTest = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lesson, setLesson] = useState(null);
  const [allLessons, setAllLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [fillAnswers, setFillAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    setLesson(null);
    setAnswers({});
    setFillAnswers({});
    setResult(null);
    setLoading(true);
    setPlayCount(0);
    setShowTranscript(false);

    const fetchData = async () => {
      try {
        const [lessonRes, allRes] = await Promise.all([
          axios.get(`http://127.0.0.1:8000/lessons/${id}`),
          axios.get('http://127.0.0.1:8000/lessons/')
        ]);
        setLesson(lessonRes.data);
        setAllLessons(allRes.data.filter(l => l.type === 'listening'));
      } catch (error) {
        console.error("Failed to load lesson", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    return () => {
      window.speechSynthesis.cancel();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [id]);

  const getNextLesson = () => {
    if (!allLessons.length || !lesson) return null;
    const currentIdx = allLessons.findIndex(l => l.id === lesson.id);
    if (currentIdx >= 0 && currentIdx < allLessons.length - 1) return allLessons[currentIdx + 1];
    return null;
  };

  const playAudio = () => {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      } else {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
      return;
    }

    // Max 2 plays like real IELTS
    if (playCount >= 2 && !result) {
      alert("You have already played the audio 2 times (same as real IELTS).");
      return;
    }

    if (lesson?.media_url) {
      // Prioritize actual custom audio upload
      if (!audioRef.current) {
        // media_url contains the full path including origin
        audioRef.current = new Audio(lesson.media_url);
        audioRef.current.onended = () => {
          setIsPlaying(false);
          setPlayCount(prev => prev + 1);
        };
        audioRef.current.onerror = () => {
          console.error("Audio error:", audioRef.current.error);
          setIsPlaying(false);
          alert("Error playing audio file. Please check if it was uploaded correctly.");
        };
      }
      audioRef.current.play().then(() => setIsPlaying(true)).catch(e => {
        console.error(e);
        setIsPlaying(false);
        alert("Autoplay prevention or other error occurred.");
      });
    } else if (lesson?.content?.transcript) {
      const utterance = new SpeechSynthesisUtterance(lesson.content.transcript);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      utterance.pitch = 1;

      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => {
        setIsPlaying(false);
        setPlayCount(prev => prev + 1);
      };
      utterance.onerror = () => setIsPlaying(false);

      window.speechSynthesis.speak(utterance);
    } else {
      alert("No audio available for this lesson.");
    }
  };

  const handleAnswerSelect = (questionId, optionKey) => {
    if (result) return;
    setAnswers({ ...answers, [questionId]: optionKey });
  };

  const handleFillChange = (questionId, value) => {
    if (result) return;
    setFillAnswers({ ...fillAnswers, [questionId]: value });
  };

  const handleSubmit = async () => {
    const totalAnswered = Object.keys(answers).length + Object.keys(fillAnswers).length;
    if (totalAnswered < lesson.questions.length) {
      alert("Please answer all questions before submitting.");
      return;
    }

    setIsSubmitting(true);
    let score = 0;

    lesson.questions.forEach(q => {
      if (q.type === 'multiple_choice') {
        if (answers[q.id] === q.correct_answer) score++;
      } else if (q.type === 'fill_blank') {
        const userAns = (fillAnswers[q.id] || '').trim().toLowerCase();
        if (userAns === q.correct_answer.toLowerCase()) score++;
      }
    });

    const normalizedScore = Math.round((score / lesson.questions.length) * 100);

    try {
      const targetUserId = user?.id || 1;
      await axios.post(`http://127.0.0.1:8000/results/${targetUserId}`, {
        lesson_id: lesson.id,
        score: normalizedScore,
        responses: { ...answers, ...fillAnswers }
      });
      setResult({ score: normalizedScore, correct: score, total: lesson.questions.length });
      setShowTranscript(true);
    } catch (error) {
      console.error("Failed to submit results", error);
      alert("Error saving results.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>;
  if (!lesson) return <div className="p-8 text-center text-slate-500">Lesson not found</div>;

  const nextLesson = getNextLesson();
  const answeredCount = Object.keys(answers).length + Object.keys(fillAnswers).length;
  const progressPercent = lesson.questions.length > 0 ? Math.round((answeredCount / lesson.questions.length) * 100) : 0;

  return (
    <div className="h-full flex flex-col bg-secondary">
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
            <span>{playCount}/2</span>
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
            {/* Audio Player Card */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 md:p-8 border border-amber-200 mb-6">
              <div className="flex flex-col items-center space-y-4">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all ${isPlaying ? 'bg-amber-500 scale-110 animate-pulse' : 'bg-amber-400'}`}>
                  <Headphones size={36} className="text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 text-center">{lesson.title}</h3>
                <p className="text-sm text-slate-500 text-center">Listen carefully and answer the questions. You can play the audio up to 2 times.</p>

                <button
                  onClick={playAudio}
                  disabled={playCount >= 2 && !isPlaying && !result}
                  className={`flex items-center space-x-3 px-8 py-3 rounded-xl font-semibold text-lg transition-all shadow-md ${
                    isPlaying
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : playCount >= 2 && !result
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-amber-500 hover:bg-amber-600 text-white hover:scale-105'
                  }`}
                >
                  {isPlaying ? <Pause size={22} /> : <Play size={22} />}
                  <span>{isPlaying ? 'Pause' : playCount === 0 ? 'Play Audio' : `Play Again (${2 - playCount} left)`}</span>
                </button>

                {/* Volume indicator when playing */}
                {isPlaying && (
                  <div className="flex items-center space-x-1">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="w-1 bg-amber-400 rounded-full animate-pulse" style={{ height: `${8 + Math.random() * 16}px`, animationDelay: `${i * 0.1}s` }}></div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Transcript (shown after submit) */}
            {showTranscript && lesson.content.transcript && (
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                <h4 className="font-bold text-slate-700 mb-3 flex items-center space-x-2">
                  <Volume2 size={16} />
                  <span>Transcript</span>
                </h4>
                <p className="text-slate-600 leading-relaxed text-sm italic">{lesson.content.transcript}</p>
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

            {lesson.questions.map((q, idx) => (
              <div key={q.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 transition-all hover:border-amber-200">
                <p className="font-semibold text-slate-800 mb-4 flex">
                  <span className="bg-amber-50 text-amber-600 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-3 flex-shrink-0">{idx + 1}</span>
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
                        cls = 'bg-amber-50 border-amber-500';
                      }

                      return (
                        <label key={key} className={`flex items-start space-x-3 p-3 rounded-xl cursor-pointer border-2 transition-all ${cls}`}>
                          <input type="radio" name={`q-${q.id}`} value={key} disabled={showFeedback} checked={isSelected}
                            onChange={() => handleAnswerSelect(q.id, key)}
                            className="mt-0.5 text-amber-600 focus:ring-amber-500 cursor-pointer disabled:cursor-auto" />
                          <span className="font-medium w-5 flex-shrink-0 text-slate-600">{key}.</span>
                          <span className={showFeedback && isCorrect ? 'text-green-800 font-medium' : showFeedback && isSelected && !isCorrect ? 'text-red-800 line-through' : isSelected ? 'text-amber-800 font-medium' : 'text-slate-700'}>{value}</span>
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
                      className={`w-full px-4 py-2.5 rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-amber-400 ${
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
          ) : (
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
