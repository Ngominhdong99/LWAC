import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Mic, Square, Play, Pause, Save, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import API_URL from '../api';

const SpeakingTest = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioPlayerRef = useRef(null);

  useEffect(() => {
    const fetchLesson = async () => {
      try {
        const res = await axios.get(`${API_URL}/lessons/${id}`);
        setLesson(res.data);
      } catch (e) {
        console.error("Failed to load speaking test:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchLesson();
    
    // Cleanup
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
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setAudioBlob(audioBlob);
        
        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Failed to start recording:", err);
      alert("Microphone access is required to take the speaking test.");
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
      alert("Please record your answer first.");
      return;
    }

    setLoading(true);
    try {
      // 1. Upload audio blob to static server
      const formData = new FormData();
      // append with a dummy filename, router uses uuid
      formData.append('file', audioBlob, 'speaking_answer.webm'); 
      
      const uploadRes = await axios.post(`${API_URL}/upload/audio`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const uploadedFileUrl = uploadRes.data.url;

      // 2. Submit Result with the audio URL
      await axios.post(`${API_URL}/results/${user?.id || 1}`, {
        lesson_id: parseInt(id),
        score: 0, // Pending grading
        responses: {
          user_audio_url: uploadedFileUrl
        }
      });
      
      navigate('/');
    } catch (e) {
      console.error("Failed to submit speaking test:", e);
      alert("Error submitting your recording. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !lesson) return <div className="p-8 flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>;
  if (!lesson) return <div className="p-8 text-center text-slate-500">Test not found.</div>;

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

            <div className="flex flex-col items-center py-10 space-y-6">
                
                {/* Visualizer / Timer Output */}
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
                        <audio ref={audioPlayerRef} src={audioUrl} controls className="w-full" />
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

            <p className="text-sm text-center text-slate-400 max-w-lg mx-auto">
                Read the prompt carefully. Take a moment to think about your answer, then press Record. When you are finished speaking, press Stop to review your audio.
            </p>
        </div>
      </div>
    </div>
  );
};

export default SpeakingTest;
