import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Save, X, FileText, Headphones, Edit3, Mic, Image, Video, Link, Sparkles, ChevronDown, ChevronUp, Eye, Pencil } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import API_URL from '../api';
import MarkdownRenderer from '../components/MarkdownRenderer';

const LessonBuilder = () => {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [lessonType, setLessonType] = useState('reading'); // reading, listening, writing, speaking
  
  // Base Lesson Fields
  const [title, setTitle] = useState('');
  const [chapter, setChapter] = useState('');
  
  // Reading / General Content
  const [passageText, setPassageText] = useState('');
  
  // Media uploads
  const [audioFile, setAudioFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [existingImageUrl, setExistingImageUrl] = useState('');
  const [existingVideoUrl, setExistingVideoUrl] = useState('');
  const [existingAudioUrl, setExistingAudioUrl] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [audioUrlInput, setAudioUrlInput] = useState('');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  
  // Writing
  const [task1Min, setTask1Min] = useState(150);
  const [task2Min, setTask2Min] = useState(250);
  
  // Speaking
  const [speakingPrompt, setSpeakingPrompt] = useState('');

  // AI Generate Passage State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLevel, setAiLevel] = useState('intermediate');
  const [isGeneratingPassage, setIsGeneratingPassage] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [passagePreview, setPassagePreview] = useState(false);

  // TTS State
  const [ttsScript, setTtsScript] = useState('');
  const [ttsVoice, setTtsVoice] = useState('en-US-AriaNeural');
  const [ttsDialogueMode, setTtsDialogueMode] = useState(false);
  const [ttsVoice2, setTtsVoice2] = useState('en-US-GuyNeural');
  const [isGeneratingTts, setIsGeneratingTts] = useState(false);

  // Questions Array (Reading & Listening only)
  const [questions, setQuestions] = useState([]);

  // AI Parse Questions State
  const [showAiParsePanel, setShowAiParsePanel] = useState(false);
  const [aiParseText, setAiParseText] = useState('');
  const [isParsingQuestions, setIsParsingQuestions] = useState(false);

  useEffect(() => {
    const fetchLesson = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const res = await axios.get(`${API_URL}/lessons/${id}`);
        const data = res.data;
        setTitle(data.title || '');
        setChapter(data.chapter || '');
        setLessonType(data.type || 'reading');
        
        if (data.type === 'reading' || data.type === 'listening') {
          setPassageText(data.content?.passage || '');
          setExistingImageUrl(data.content?.image_url || '');
          setExistingVideoUrl(data.content?.video_url || '');
          if (data.content?.image_url && data.content.image_url.startsWith('http')) setImageUrlInput(data.content.image_url);
          if (data.content?.video_url && data.content.video_url.startsWith('http')) setVideoUrlInput(data.content.video_url);
          setExistingAudioUrl(data.media_url || '');
          if (data.media_url && data.media_url.startsWith('http')) setAudioUrlInput(data.media_url);
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
        toast.error('Failed to load lesson for editing');
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

  const handleParseQuestions = async () => {
    if (!aiParseText.trim()) {
      toast.warning('Please enter some text containing questions and answers.');
      return;
    }
    setIsParsingQuestions(true);
    try {
      const res = await axios.post(`${API_URL}/coach/ai-parse-questions`, {
        raw_text: aiParseText
      });
      if (res.data.questions && res.data.questions.length > 0) {
        const newQuestions = res.data.questions.map((q, i) => ({
          ...q,
          id: Date.now() + i
        }));
        setQuestions(prev => [...prev, ...newQuestions]);
        toast.success(`Successfully extracted ${newQuestions.length} questions!`);
        setShowAiParsePanel(false);
        setAiParseText('');
      } else {
        toast.error(res.data.error || 'No questions could be extracted. Please check the text format.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to parse questions. Please try again.');
    } finally {
      setIsParsingQuestions(false);
    }
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

  const handleMediaUpload = async (file, type) => {
    if (!file) return null;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${API_URL}/upload/${type}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return res.data.url;
    } catch (e) {
      console.error(e);
      toast.error(`Failed to upload ${type}`);
      return null;
    }
  };

  const handleGenerateTTS = async () => {
    if (!ttsScript.trim()) {
      toast.warning('Please enter a script to generate audio.');
      return;
    }
    setIsGeneratingTts(true);
    try {
      const res = await axios.post(`${API_URL}/upload/generate-tts`, {
        text: ttsScript,
        voice: ttsVoice,
        dialogue_mode: ttsDialogueMode,
        voice2: ttsDialogueMode ? ttsVoice2 : undefined
      });
      setAudioUrlInput(res.data.url);
      setAudioFile(null);
      toast.success('Audio generated successfully!');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate audio. Please try again.');
    } finally {
      setIsGeneratingTts(false);
    }
  };

  const handleSaveLesson = async () => {
    if (!title || !chapter) {
      toast.warning('Please provide a Title and Chapter.');
      return;
    }
    setLoading(true);

    try {
      // Audio: URL input takes priority, then file upload, then existing
      let media_url = existingAudioUrl || null;
      if (audioUrlInput.trim()) {
        media_url = audioUrlInput.trim();
      } else if (lessonType === 'listening' && audioFile) {
        media_url = await handleMediaUpload(audioFile, 'audio');
      }

      // Image: URL input takes priority, then file upload, then existing
      let image_url = existingImageUrl || null;
      if (imageUrlInput.trim()) {
        image_url = imageUrlInput.trim();
      } else if (imageFile) {
        image_url = await handleMediaUpload(imageFile, 'image');
      }

      // Video: URL input takes priority, then file upload, then existing
      let video_url = existingVideoUrl || null;
      if (videoUrlInput.trim() && lessonType === 'listening') {
        video_url = videoUrlInput.trim();
      } else if (videoFile && lessonType === 'listening') {
        video_url = await handleMediaUpload(videoFile, 'video');
      }

      // Build specific content payload based on type
      let content = {};
      if (lessonType === 'reading') {
         content = { passage: passageText, image_url };
      } else if (lessonType === 'listening') {
         content = { passage: passageText, image_url, video_url };
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
        await axios.put(`${API_URL}/lessons/${id}`, lessonPayload);
        
        if (lessonType === 'reading' || lessonType === 'listening') {
          const questionsPayload = questions.map(q => ({
             type: q.type,
             question_text: q.question_text,
             options: q.type === 'multiple_choice' ? q.options : null,
             correct_answer: q.correct_answer
          }));
          await axios.put(`${API_URL}/lessons/${id}/questions`, questionsPayload);
        }
        toast.success('Lesson updated successfully!');
        navigate('/coach/lessons');
      } else {
        // Create Mode
        const lessonRes = await axios.post(`${API_URL}/lessons/`, lessonPayload);
        const newLessonId = lessonRes.data.id;

        if ((lessonType === 'reading' || lessonType === 'listening') && questions.length > 0) {
          const questionsPayload = questions.map(q => ({
             type: q.type,
             question_text: q.question_text,
             options: q.type === 'multiple_choice' ? q.options : null,
             correct_answer: q.correct_answer
          }));
          await axios.post(`${API_URL}/lessons/${newLessonId}/questions/bulk`, questionsPayload);
        }

        toast.success('Lesson created successfully!');
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
      toast.error('Failed to save lesson.');
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
        
        {/* Image (Reading + Listening) */}
        {(lessonType === 'reading' || lessonType === 'listening') && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center space-x-2">
              <Image size={16} /> <span>Image</span>
            </label>
            <input 
              type="file" 
              accept="image/*"
              onChange={(e) => { setImageFile(e.target.files[0]); setImageUrlInput(''); }}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <div className="flex items-center space-x-2 mt-2">
              <Link size={14} className="text-slate-400 shrink-0" />
              <input
                type="text"
                value={imageUrlInput}
                onChange={(e) => { setImageUrlInput(e.target.value); if (e.target.value) setImageFile(null); }}
                className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="or paste image URL..."
              />
            </div>
            {imageFile && <p className="text-xs text-slate-500 mt-1">📎 {imageFile.name}</p>}
            {!imageFile && !imageUrlInput && existingImageUrl && (
              <div className="mt-2">
                <p className="text-xs text-green-600 mb-1">✅ Current image:</p>
                <img src={existingImageUrl.startsWith('http') ? existingImageUrl : `${API_URL}${existingImageUrl}`} alt="lesson" className="max-h-32 rounded-lg border" />
              </div>
            )}
            {imageUrlInput && <p className="text-xs text-blue-600 mt-1">🔗 Using URL</p>}
          </div>
        )}

        {/* Listening: Audio + Video */}
        {lessonType === 'listening' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center space-x-2">
                <Headphones size={16} /> <span>Audio</span>
              </label>
              <input 
                type="file" 
                accept="audio/*"
                onChange={(e) => { setAudioFile(e.target.files[0]); setAudioUrlInput(''); }}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
              <div className="flex items-center space-x-2 mt-2">
                <Link size={14} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={audioUrlInput}
                  onChange={(e) => { setAudioUrlInput(e.target.value); if (e.target.value) setAudioFile(null); }}
                  className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="or paste audio URL..."
                />
              </div>
              {audioFile && <p className="text-xs text-slate-500 mt-1">📎 {audioFile.name}</p>}
              {!audioFile && !audioUrlInput && existingAudioUrl && (
                <div className="mt-2">
                  <p className="text-xs text-green-600 mb-1">✅ Current audio:</p>
                  <audio controls src={existingAudioUrl.startsWith('http') ? existingAudioUrl : `${API_URL}${existingAudioUrl}`} className="w-full h-10" />
                </div>
              )}
              {audioUrlInput && <p className="text-xs text-blue-600 mt-1">🔗 Using URL</p>}
              
              {/* AI Voice Studio */}
              <div className="mt-6 pt-4 border-t border-slate-200">
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center space-x-2">
                  <Mic size={16} className="text-amber-500" /> <span>AI Voice Studio</span>
                </label>
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 shadow-sm space-y-3">
                  <p className="text-xs text-amber-700 font-medium pb-2 border-b border-amber-200 flex items-center justify-between">
                    <span>Don't have an audio file? Type your transcript and select an AI voice to generate realistic audio.</span>
                    <label className="flex items-center space-x-2 cursor-pointer bg-white px-2 py-1 rounded border border-amber-200">
                      <input 
                        type="checkbox" 
                        checked={ttsDialogueMode} 
                        onChange={(e) => setTtsDialogueMode(e.target.checked)} 
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs font-bold text-amber-800">Dialogue Mode (Multi-Voice)</span>
                    </label>
                  </p>
                  <textarea 
                    value={ttsScript}
                    onChange={(e) => setTtsScript(e.target.value)}
                    placeholder={ttsDialogueMode ? "Enter conversation:\nLan: Hi Mark!\nMark: Oh, hi Lan." : "Enter the transcript audio you want the AI to read..."}
                    className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm min-h-[100px] focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white leading-relaxed"
                  />
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1 space-y-1">
                      {ttsDialogueMode && <label className="text-xs font-bold text-amber-700">Voice 1</label>}
                      <select 
                        value={ttsVoice}
                        onChange={(e) => setTtsVoice(e.target.value)}
                        className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white font-medium focus:ring-2 focus:ring-amber-500"
                      >
                        <optgroup label="US English">
                          <option value="en-US-AriaNeural">Aria (Female) - Natural</option>
                          <option value="en-US-GuyNeural">Guy (Male) - Professional</option>
                          <option value="en-US-JennyNeural">Jenny (Female) - Friendly</option>
                          <option value="en-US-ChristopherNeural">Christopher (Male) - Confident</option>
                        </optgroup>
                        <optgroup label="UK English">
                          <option value="en-GB-SoniaNeural">Sonia (Female) - Clear</option>
                          <option value="en-GB-RyanNeural">Ryan (Male) - News</option>
                          <option value="en-GB-LibbyNeural">Libby (Female) - Friendly</option>
                          <option value="en-GB-ThomasNeural">Thomas (Male) - Confident</option>
                        </optgroup>
                        <optgroup label="Australian English">
                          <option value="en-AU-NatashaNeural">Natasha (Female) - Lively</option>
                          <option value="en-AU-WilliamNeural">William (Male) - Strong</option>
                        </optgroup>
                      </select>
                    </div>
                    
                    {ttsDialogueMode && (
                      <div className="flex-1 space-y-1">
                        <label className="text-xs font-bold text-amber-700">Voice 2</label>
                        <select 
                          value={ttsVoice2}
                          onChange={(e) => setTtsVoice2(e.target.value)}
                          className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white font-medium focus:ring-2 focus:ring-amber-500"
                        >
                          <optgroup label="US English">
                            <option value="en-US-GuyNeural">Guy (Male) - Professional</option>
                            <option value="en-US-AriaNeural">Aria (Female) - Natural</option>
                            <option value="en-US-JennyNeural">Jenny (Female) - Friendly</option>
                            <option value="en-US-ChristopherNeural">Christopher (Male) - Confident</option>
                          </optgroup>
                          <optgroup label="UK English">
                            <option value="en-GB-SoniaNeural">Sonia (Female) - Clear</option>
                            <option value="en-GB-RyanNeural">Ryan (Male) - News</option>
                            <option value="en-GB-LibbyNeural">Libby (Female) - Friendly</option>
                            <option value="en-GB-ThomasNeural">Thomas (Male) - Confident</option>
                          </optgroup>
                          <optgroup label="Australian English">
                            <option value="en-AU-NatashaNeural">Natasha (Female) - Lively</option>
                            <option value="en-AU-WilliamNeural">William (Male) - Strong</option>
                          </optgroup>
                        </select>
                      </div>
                    )}

                    <div className="flex items-end">
                      <button 
                        onClick={handleGenerateTTS}
                        disabled={isGeneratingTts || !ttsScript.trim()}
                        className="w-full h-[38px] px-4 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50"
                      >
                        {isGeneratingTts ? (
                          <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                        ) : (
                          <><Mic size={16} /> <span>Generate Voice</span></>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center space-x-2">
                <Video size={16} /> <span>Video (optional)</span>
              </label>
              <input 
                type="file" 
                accept="video/*"
                onChange={(e) => { setVideoFile(e.target.files[0]); setVideoUrlInput(''); }}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
              />
              <div className="flex items-center space-x-2 mt-2">
                <Link size={14} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={videoUrlInput}
                  onChange={(e) => { setVideoUrlInput(e.target.value); if (e.target.value) setVideoFile(null); }}
                  className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  placeholder="or paste video URL..."
                />
              </div>
              {videoFile && <p className="text-xs text-slate-500 mt-1">📎 {videoFile.name}</p>}
              {!videoFile && !videoUrlInput && existingVideoUrl && (
                <div className="mt-2 text-center bg-slate-100 rounded-xl p-2 border border-slate-200">
                  <p className="text-xs text-green-600 mb-2 font-bold flex justify-center items-center"><span className="mr-1">✅</span> Current video attached</p>
                  {(() => {
                    const finalUrl = existingVideoUrl.startsWith('http') ? existingVideoUrl : `${API_URL}${existingVideoUrl}`;
                    const ytMatch = finalUrl.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
                    if (ytMatch && ytMatch[2].length === 11) {
                      return <iframe className="w-full aspect-video rounded-lg shadow-sm bg-black" src={`https://www.youtube.com/embed/${ytMatch[2]}`} title="YouTube" frameBorder="0" allowFullScreen></iframe>;
                    }
                    return <video controls className="w-full max-h-48 rounded-lg shadow-sm bg-black mx-auto" src={finalUrl}></video>;
                  })()}
                </div>
              )}
              {videoUrlInput && (
                <div className="mt-2 text-center bg-slate-100 rounded-xl p-2 border border-slate-200">
                  <p className="text-xs text-blue-600 mb-2 font-bold flex justify-center items-center"><span className="mr-1">🔗</span> Using URL</p>
                  {(() => {
                    const ytMatch = videoUrlInput.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
                    if (ytMatch && ytMatch[2].length === 11) {
                      return <iframe className="w-full aspect-video rounded-lg shadow-sm bg-black" src={`https://www.youtube.com/embed/${ytMatch[2]}`} title="YouTube preview" frameBorder="0" allowFullScreen></iframe>;
                    }
                    return <video controls className="w-full max-h-48 rounded-lg shadow-sm bg-black mx-auto" src={videoUrlInput}></video>;
                  })()}
                </div>
              )}
            </div>
          </div>
        )}

        {(lessonType === 'reading' || lessonType === 'writing' || lessonType === 'listening') && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center justify-between">
              <span>{lessonType === 'writing' ? 'Writing Task Prompt' : 'Reading/Context Passage'}</span>
              {lessonType !== 'writing' && (
                <button
                  type="button"
                  onClick={() => setShowAiPanel(!showAiPanel)}
                  className="flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-600 hover:to-indigo-600 transition-all shadow-sm hover:shadow-md"
                >
                  <Sparkles size={13} />
                  <span>AI Generate</span>
                  {showAiPanel ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              )}
            </label>

            {showAiPanel && lessonType !== 'writing' && (
              <div className="mb-3 p-4 border-2 border-dashed border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 rounded-xl space-y-3 animate-in">
                <div className="flex items-center space-x-2 mb-1">
                  <Sparkles size={16} className="text-violet-500" />
                  <p className="text-sm font-bold text-violet-700">AI Content Assistant</p>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">Mô tả bất kỳ nội dung nào bạn cần — bài đọc, bài tập, danh sách từ vựng, đoạn hội thoại, v.v. AI sẽ tạo nội dung theo đúng yêu cầu của bạn.</p>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder={"Ví dụ:\n• Write a 300-word passage about climate change for B2 students\n• Create a dialogue between a doctor and a patient\n• Write 10 fill-in-the-blank sentences about Present Simple tense\n• Generate a list of vocabulary about technology with definitions"}
                  className="w-full px-3 py-2.5 border border-violet-200 rounded-lg text-sm min-h-[100px] focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white leading-relaxed placeholder:text-slate-400"
                />
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-violet-600 mb-1 block">Level</label>
                    <select
                      value={aiLevel}
                      onChange={(e) => setAiLevel(e.target.value)}
                      className="w-full px-3 py-2 border border-violet-200 rounded-lg text-sm bg-white font-medium focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="beginner">🟢 Beginner (A1-A2) — 150-200 words</option>
                      <option value="intermediate">🟡 Intermediate (B1-B2) — 250-400 words</option>
                      <option value="advanced">🔴 Advanced (C1-C2) — 400-600 words</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!aiPrompt.trim()) return;
                        setIsGeneratingPassage(true);
                        try {
                          const res = await axios.post(`${API_URL}/coach/ai-generate-passage`, {
                            description: aiPrompt,
                            lesson_type: lessonType,
                            level: aiLevel,
                          });
                          if (res.data.passage) {
                            setPassageText(res.data.passage);
                            toast.success('Passage generated successfully!');
                            setShowAiPanel(false);
                            setPassagePreview(true);
                          } else {
                            toast.error(res.data.error || 'Failed to generate passage');
                          }
                        } catch (err) {
                          console.error(err);
                          toast.error('AI generation failed. Please try again.');
                        } finally {
                          setIsGeneratingPassage(false);
                        }
                      }}
                      disabled={isGeneratingPassage || !aiPrompt.trim()}
                      className="w-full sm:w-auto h-[38px] px-5 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white font-bold rounded-lg transition-all flex items-center justify-center space-x-2 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGeneratingPassage ? (
                        <><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span><span className="ml-2">Generating...</span></>
                      ) : (
                        <><Sparkles size={15} /> <span>Generate</span></>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="relative">
              {/* Edit / Preview Toggle */}
              <div className="flex border-b border-slate-200 mb-0 rounded-t-lg overflow-hidden bg-slate-50">
                <button
                  type="button"
                  onClick={() => setPassagePreview(false)}
                  className={`flex items-center space-x-1.5 px-4 py-2 text-sm font-semibold transition-colors ${!passagePreview ? 'bg-white text-slate-800 border-b-2 border-primary-500' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Pencil size={14} />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPassagePreview(true)}
                  className={`flex items-center space-x-1.5 px-4 py-2 text-sm font-semibold transition-colors ${passagePreview ? 'bg-white text-slate-800 border-b-2 border-primary-500' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Eye size={14} />
                  <span>Preview</span>
                </button>
              </div>

              {passagePreview ? (
                <div className="w-full px-4 py-3 border border-slate-200 border-t-0 rounded-b-lg bg-white min-h-[200px] max-h-[500px] overflow-y-auto">
                  {passageText.trim() ? (
                    <MarkdownRenderer>{passageText}</MarkdownRenderer>
                  ) : (
                    <p className="text-slate-400 italic text-sm">Nothing to preview yet...</p>
                  )}
                </div>
              ) : (
                <textarea 
                  value={passageText} 
                  onChange={e => setPassageText(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 border-t-0 rounded-b-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[200px]"
                  placeholder="Enter the full text/prompt here..."
                />
              )}
            </div>
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
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowAiParsePanel(!showAiParsePanel)}
                  className={`flex items-center space-x-1 text-sm px-3 py-1.5 rounded-lg transition-colors font-medium border ${showAiParsePanel ? 'bg-violet-100 text-violet-700 border-violet-200' : 'bg-white text-violet-600 hover:bg-violet-50 border-violet-100 shadow-sm'}`}
                >
                  <Sparkles size={16} /> <span className="hidden sm:inline">Import</span>
                </button>
                <button 
                  onClick={handleAddQuestion}
                  className="flex items-center space-x-1 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition-colors font-medium"
                >
                  <Plus size={16} /> <span className="hidden sm:inline">Add Question</span>
                </button>
              </div>
            </div>

            {/* AI Question Parser Panel */}
            {showAiParsePanel && (
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-4 shadow-inner">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center space-x-2 text-violet-700">
                    <Sparkles size={18} />
                    <h4 className="font-bold text-sm">AI Question Import</h4>
                  </div>
                  <button onClick={() => setShowAiParsePanel(false)} className="text-violet-400 hover:text-violet-600">
                    <X size={18} />
                  </button>
                </div>
                <p className="text-xs text-violet-600 mb-3 uppercase tracking-wide font-semibold">Paste raw text containing questions, options, and answers.</p>
                <textarea
                  value={aiParseText}
                  onChange={e => setAiParseText(e.target.value)}
                  className="w-full px-3 py-2 border border-violet-200 rounded-lg text-sm mb-3 focus:ring-2 focus:ring-violet-400 focus:border-transparent min-h-[120px]"
                  placeholder={`e.g. 1. What is the capital of France? \nA) London\nB) Paris \nC) Rome \nAnswer: B`}
                />
                <button
                  onClick={handleParseQuestions}
                  disabled={isParsingQuestions || !aiParseText.trim()}
                  className={`w-full flex items-center justify-center py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm ${
                    isParsingQuestions || !aiParseText.trim()
                      ? 'bg-violet-200 text-violet-400 cursor-not-allowed'
                      : 'bg-violet-600 text-white hover:bg-violet-700 hover:shadow-md'
                  }`}
                >
                  {isParsingQuestions ? (
                    <><Loader2 size={16} className="animate-spin mr-2" /> Extracting Questions...</>
                  ) : (
                    <><Sparkles size={16} className="mr-2" /> Extract & Append Questions</>
                  )}
                </button>
              </div>
            )}


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
                        <option value="written_answer">Written Answer</option>
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
                      ) : q.type === 'written_answer' ? (
                        <div className="mt-2 pt-2 border-t border-slate-200">
                            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Accepted Answer(s)</label>
                            <input 
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-sm font-bold text-green-700 bg-green-50"
                              value={q.correct_answer}
                              onChange={(e) => updateQuestion(q.id, 'correct_answer', e.target.value)}
                              placeholder="e.g. doesn't eat|does not eat ; make"
                            />
                            <p className="text-xs text-slate-400 mt-1">Use <b>|</b> for alternative answers. Use <b>;</b> to separate multiple blanks in one question.</p>
                            <p className="text-xs text-slate-400">Example: <code className="bg-slate-100 px-1 rounded">doesn't eat|does not eat ; make</code> = 2 blanks, first accepts "doesn't eat" or "does not eat"</p>
                        </div>
                      ) : (
                        <div className="mt-2 pt-2 border-t border-slate-200">
                            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Correct Answer(s)</label>
                            <input 
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-sm font-bold text-green-700 bg-green-50"
                              value={q.correct_answer}
                              onChange={(e) => updateQuestion(q.id, 'correct_answer', e.target.value)}
                              placeholder="e.g. doesn't eat ; make"
                            />
                            <p className="text-xs text-slate-400 mt-1">Use <b>;</b> for multiple blanks. Use <b>|</b> for alternatives. E.g. <code className="bg-slate-100 px-1 rounded">ans1 ; ans2a|ans2b</code></p>
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
              
              {questions.length > 0 && (
                <button 
                  onClick={handleAddQuestion}
                  className="mt-2 flex items-center justify-center w-full space-x-2 text-sm bg-slate-50 border-2 border-dashed border-slate-200 hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700 text-slate-600 px-4 py-4 rounded-xl transition-all font-bold"
                >
                  <Plus size={20} /> <span className="text-base">Add Another Question</span>
                </button>
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
