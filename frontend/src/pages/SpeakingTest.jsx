import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Mic, Square, Play, Pause, Save, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import API_URL from '../api';

const SpeakingTest = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isViewMode = searchParams.get('view') === 'true';
  const { user } = useAuth();
  const toast = useToast();
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  
  // View mode: saved audio from previous submission
  const [savedAudioUrl, setSavedAudioUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [coachFeedback, setCoachFeedback] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const recordedMimeTypeRef = useRef('audio/webm');

  // Detect the best supported audio MIME type for recording
  const getSupportedMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/wav',
    ];
    for (const type of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return ''; // fallback: let browser decide
  };

  // Map MIME type to file extension for upload
  const getFileExtension = (mimeType) => {
    if (mimeType.includes('webm')) return '.webm';
    if (mimeType.includes('mp4')) return '.mp4';
    if (mimeType.includes('ogg')) return '.ogg';
    if (mimeType.includes('wav')) return '.wav';
    return '.webm';
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API_URL}/lessons/${id}`);
        setLesson(res.data);

        // View mode or check if already submitted: load previous result
        if (user) {
          try {
            const [resResults, resAssignments] = await Promise.all([
              axios.get(`${API_URL}/results/${user.id}`),
              axios.get(`${API_URL}/coach/students/${user.id}/assignments`)
            ]);
            
            const lessonAssignment = resAssignments.data.find(a => a.lesson_id === parseInt(id));
            const isRetakeAllowed = lessonAssignment?.allow_retake === true;
            
            const lessonResults = resResults.data.filter(r => r.lesson_id === parseInt(id));
            if (lessonResults.length > 0) {
              const latest = lessonResults[lessonResults.length - 1];
              if (!isViewMode && isRetakeAllowed) {
                 // Do not load results blocking the UI; let them retake
                 // We don't set submitted to true.
              } else {
                // Force view mode if not rectake allowed, or naturally in view mode
                if (latest.responses?.user_audio_url) {
                  const audioSrc = latest.responses.user_audio_url.startsWith('/static')
                    ? `${API_URL}${latest.responses.user_audio_url}`
                    : latest.responses.user_audio_url;
                  setSavedAudioUrl(audioSrc);
                }
                setResult({
                  score_normalized: latest.score,
                  evaluation: latest.responses?.evaluation || {}
                });
                setCoachFeedback(latest.responses?.feedback || []);
                if (!isViewMode) {
                  // Already submitted before and not allowed to retake — mark as submitted so they can't get double points
                  setSubmitted(true);
                }
              }
            }
          } catch (e) { console.error('Failed to load previous result', e); }
        }
      } catch (e) {
        console.error("Failed to load speaking test:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [id]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Use the best supported MIME type for this device/browser
      const mimeType = getSupportedMimeType();
      const recorderOptions = mimeType ? { mimeType } : {};
      mediaRecorderRef.current = new MediaRecorder(stream, recorderOptions);
      recordedMimeTypeRef.current = mediaRecorderRef.current.mimeType || mimeType || 'audio/webm';
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const actualMime = recordedMimeTypeRef.current;
        const blob = new Blob(audioChunksRef.current, { type: actualMime });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      // Use timeslice (1s) to collect data periodically — more reliable on mobile
      mediaRecorderRef.current.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Failed to start recording:", err);
      toast.warning('Microphone access is required to take the speaking test.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const resetRecording = () => {
    setAudioUrl(null);
    setAudioBlob(null);
    setRecordingTime(0);
  };

  const handleSubmit = async () => {
    if (!audioBlob) {
      toast.warning('Please record your answer first.');
      return;
    }

    setLoading(true);
    try {
      const ext = getFileExtension(recordedMimeTypeRef.current);
      const formData = new FormData();
      formData.append('file', audioBlob, `speaking_answer${ext}`);
      
      const uploadRes = await axios.post(`${API_URL}/upload/audio`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const uploadedFileUrl = uploadRes.data.url;

      await axios.post(`${API_URL}/results/${user?.id || 1}`, {
        lesson_id: parseInt(id),
        score: 0,
        responses: {
          user_audio_url: uploadedFileUrl
        }
      });
      
      setSubmitted(true);
      setSavedAudioUrl(uploadedFileUrl.startsWith('/static') ? `${API_URL}${uploadedFileUrl}` : uploadedFileUrl);
    } catch (e) {
      console.error("Failed to submit speaking test:", e);
      toast.error('Error submitting your recording. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !lesson) return <div className="p-8 flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>;
  if (!lesson) return <div className="p-8 text-center text-slate-500">Test not found.</div>;

  // Determine if we should show read-only view
  const isReadOnly = isViewMode || submitted;

  return (
    <div className="flex flex-col h-full bg-secondary">
      <div className="p-6 md:p-8 max-w-4xl mx-auto w-full flex-1">
        <header className="mb-8 flex items-center justify-between">
          <div>
             <button onClick={() => navigate(-1)} className="flex items-center text-slate-500 hover:text-primary-600 transition-colors mb-4 cursor-pointer">
                <ArrowLeft size={16} className="mr-1" /> Back
             </button>
             <h1 className="text-3xl font-bold tracking-tight text-slate-900">{lesson.title}</h1>
             <p className="text-slate-500 mt-1">{lesson.chapter} • Speaking</p>
          </div>
          {isViewMode && (
            <span className="bg-primary-50 text-primary-700 px-4 py-2 rounded-xl text-sm font-bold">
              View Mode
            </span>
          )}
        </header>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-8">
            <div className="bg-primary-50 text-primary-900 p-6 rounded-xl border border-primary-100">
                <h3 className="font-bold text-lg mb-2 flex items-center">
                    <Mic className="mr-2" size={20} /> Prompt
                </h3>
                <p className="text-primary-800 whitespace-pre-wrap leading-relaxed text-lg">
                    {lesson.content?.prompt}
                </p>
            </div>

            {/* Submitted / View Mode — show saved audio only */}
            {isReadOnly && savedAudioUrl ? (
              <div className="flex flex-col items-center py-10 space-y-6">
                <div className="flex items-center space-x-3 text-green-600 mb-2">
                  <CheckCircle size={28} />
                  <span className="text-xl font-bold">{isViewMode ? 'Your Submission' : 'Submitted Successfully!'}</span>
                </div>
                <div className="w-full max-w-md">
                  <p className="text-sm text-slate-500 mb-3 text-center font-medium">Your recorded answer:</p>
                  <audio src={savedAudioUrl} controls className="w-full" />
                </div>

                <div className="w-full max-w-xl text-left">
                  {/* Evaluation Results */}
                  {result && result.evaluation?.estimated_band !== undefined && (
                    <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                        {Object.entries(result.evaluation.criteria_scores || {}).map(([crit, score]) => (
                          <div key={crit} className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                            <span className="text-xs text-slate-500 font-medium tracking-wide uppercase mb-2">{crit}</span>
                            <span className="text-xl font-bold text-slate-800">{Number(score).toFixed(1)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Coach Feedback */}
                  {coachFeedback && coachFeedback.length > 0 && (
                    <div className="mt-8 bg-amber-50 rounded-2xl p-6 border border-amber-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <h4 className="font-bold text-amber-800 mb-4 flex items-center">
                        <span className="text-xl mr-2">👨‍🏫</span>
                        Coach's Feedback
                      </h4>
                      <div className="space-y-4">
                        {coachFeedback.map((fb, idx) => (
                          <div key={idx} className="bg-white/60 p-4 rounded-xl border border-amber-100">
                            {fb.quote && fb.quote !== 'General comment' && (
                              <p className="italic text-slate-500 mb-2 border-l-2 border-amber-300 pl-3">"{fb.quote}"</p>
                            )}
                            <p className="text-amber-900 leading-relaxed whitespace-pre-wrap">{fb.comment}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/reading')}
                    className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors"
                  >
                    All Lessons
                  </button>
                </div>
              </div>
            ) : isReadOnly && !savedAudioUrl ? (
              <div className="flex flex-col items-center py-10 space-y-4">
                <CheckCircle size={32} className="text-green-500" />
                <p className="text-lg font-bold text-slate-800">Already Submitted</p>
                <p className="text-sm text-slate-500">Your recording has been submitted.</p>
                <button
                  onClick={() => navigate('/reading')}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors"
                >
                  All Lessons
                </button>
              </div>
            ) : (
              /* Normal recording mode */
              <div className="flex flex-col items-center py-10 space-y-6">
                <div className={`text-5xl font-mono font-bold tracking-tighter ${isRecording ? 'text-red-500 animate-pulse' : 'text-slate-700'}`}>
                    {formatTime(recordingTime)}
                </div>

                {!audioUrl ? (
                    <div className="flex space-x-4">
                        {!isRecording ? (
                            <button 
                                onClick={startRecording}
                                className="flex flex-col items-center justify-center w-24 h-24 bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-full transition-colors"
                            >
                                <Mic size={32} />
                                <span className="text-xs font-bold mt-1">Record</span>
                            </button>
                        ) : (
                            <button 
                                onClick={stopRecording}
                                className="flex flex-col items-center justify-center w-24 h-24 bg-red-100 hover:bg-red-200 text-red-600 rounded-full transition-colors animate-pulse"
                            >
                                <Square size={32} />
                                <span className="text-xs font-bold mt-1">Stop</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="w-full max-w-md space-y-6 flex flex-col items-center">
                        <audio src={audioUrl} controls className="w-full" />
                        <div className="flex space-x-4 w-full">
                            <button 
                                onClick={resetRecording}
                                disabled={loading}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                            >
                                Re-record
                            </button>
                            <button 
                                onClick={handleSubmit}
                                disabled={loading}
                                className="flex-1 py-3 flex items-center justify-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-lg transition-colors disabled:opacity-50"
                            >
                                {loading ? <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span> : <><Save size={20} /> <span>Submit Test</span></>}
                            </button>
                        </div>
                    </div>
                )}
              </div>
            )}

            <p className="text-sm text-center text-slate-400 max-w-lg mx-auto">
                {isReadOnly 
                  ? 'This is your submitted recording. You cannot re-record after submission.'
                  : 'Read the prompt carefully. Take a moment to think about your answer, then press Record. When you are finished speaking, press Stop to review your audio.'
                }
            </p>
        </div>
      </div>
    </div>
  );
};

export default SpeakingTest;
