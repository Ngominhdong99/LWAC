import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, ArrowRight, Clock, CheckCircle, PenTool, Loader2 } from 'lucide-react';

const WritingTest = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [essay, setEssay] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [allWritingLessons, setAllWritingLessons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setEssay('');
    setResult(null);
    setLoading(true);
    const fetchData = async () => {
      try {
        const [lessonRes, allRes] = await Promise.all([
          axios.get(`http://127.0.0.1:8000/lessons/${id}`),
          axios.get('http://127.0.0.1:8000/lessons/')
        ]);
        setLesson(lessonRes.data);
        setAllWritingLessons(allRes.data.filter(l => l.type === 'writing'));
      } catch (error) {
        console.error("Failed to load lesson", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

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
      const response = await axios.post('http://127.0.0.1:8000/quiz/submit/writing', {
        user_id: targetUserId,
        lesson_id: lesson.id,
        question_text: question,
        user_response: essay
      });
      setResult(response.data);
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
          <div className="max-w-prose mx-auto">
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
                disabled={isSubmitting || !essay.trim()}
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
    </div>
  );
};

export default WritingTest;
