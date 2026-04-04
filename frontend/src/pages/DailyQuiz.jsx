import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../api';
import { useAuth } from '../contexts/AuthContext';
import { Trophy, CheckCircle, XCircle, ArrowRight, BookOpen, CalendarCheck, HelpCircle } from 'lucide-react';
import { useToast } from '../components/Toast';

const DailyQuiz = () => {
  const { user } = useAuth();
  const toast = useToast();
  
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [hasDoneToday, setHasDoneToday] = useState(false);
  
  const [selectedOption, setSelectedOption] = useState(null);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const res = await axios.get(`${API_URL}/daily_quiz/questions/${user.id}`);
        if (res.data.completed) {
          setHasDoneToday(true);
          setScore(res.data.score);
        } else {
          setQuestions(res.data.questions);
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load daily quiz.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuestions();
  }, [toast]);

  const handleOptionClick = (option) => {
    if (showResult) return; // Prevent multiple clicks
    
    setSelectedOption(option);
    setShowResult(true);
    
    const currentQ = questions[currentIndex];
    const isCorrect = option === currentQ.correct_word;
    
    if (isCorrect) {
      setScore(prev => prev + 1);
    }
    
    // Auto advance
    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setSelectedOption(null);
        setShowResult(false);
      } else {
        finishQuiz(score + (isCorrect ? 1 : 0));
      }
    }, 1500);
  };

  const finishQuiz = async (finalScore) => {
    try {
      setLoading(true);
      await axios.post(`${API_URL}/daily_quiz/submit?user_id=${user.id}&score=${finalScore}`);
      setIsCompleted(true);
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit score.");
      // Still show completed screen
      setIsCompleted(true); 
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-secondary">
        <div className="animate-pulse flex flex-col items-center">
          <BookOpen className="text-primary-400 mb-4 h-12 w-12" />
          <p className="text-slate-500 font-medium">Preparing your daily words...</p>
        </div>
      </div>
    );
  }

  if (hasDoneToday) {
    return (
      <div className="flex flex-col h-full bg-secondary p-4 md:p-8">
        <div className="max-w-2xl mx-auto w-full bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden text-center p-12">
          <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={48} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">You're all set!</h1>
          <p className="text-slate-600 text-lg mb-8">
            You have already completed your daily vocabulary quiz for today. 
            Come back tomorrow to keep your streak going!
          </p>
          <div className="inline-flex items-center space-x-2 bg-primary-50 text-primary-700 px-6 py-3 rounded-2xl font-semibold text-lg">
            <Trophy className="text-yellow-500" />
            <span>Today's Score: {score} / 20</span>
          </div>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="flex flex-col h-full bg-secondary p-4 md:p-8">
        <div className="max-w-2xl mx-auto w-full bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden text-center p-12 relative overflow-hidden">
          {/* Confetti decoration */}
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-50 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-yellow-200 via-transparent to-transparent"></div>
          
          <div className="w-24 h-24 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6 relative z-10">
            <Trophy size={48} />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-4 relative z-10">Awesome job!</h1>
          <p className="text-slate-600 text-lg mb-8 relative z-10">
            You completed your daily vocabulary challenge. Consistency is the key to IELTS success!
          </p>
          
          <div className="flex justify-center gap-6 relative z-10">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 min-w-[140px]">
              <p className="text-slate-500 text-sm font-semibold mb-1">Score</p>
              <p className="text-3xl font-bold text-primary-600">{score}<span className="text-lg text-slate-400">/20</span></p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!questions || questions.length === 0) {
    return (
      <div className="flex flex-col h-full bg-secondary p-4 md:p-8 items-center justify-center text-center">
        <HelpCircle size={48} className="text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-700">Not enough words</h2>
        <p className="text-slate-500 max-w-md mt-2">There aren't enough words in the system to create a daily quiz right now.</p>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  
  return (
    <div className="flex flex-col h-[calc(100vh-64px)] md:h-screen bg-secondary p-4 md:p-8">
      <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className="bg-primary-100 text-primary-600 p-2.5 rounded-xl">
              <CalendarCheck size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Daily Quiz</h1>
              <p className="text-sm font-medium text-slate-500">Pick the correct English word</p>
            </div>
          </div>
          
          <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-2">
            <span className="text-sm font-semibold text-slate-500">Question</span>
            <span className="text-lg font-bold text-primary-600">{currentIndex + 1}</span>
            <span className="text-sm font-medium text-slate-400">/ 20</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-200 h-2 rounded-full mb-8 overflow-hidden">
          <div 
            className="bg-primary-500 h-full transition-all duration-500 ease-out" 
            style={{ width: `${((currentIndex) / questions.length) * 100}%` }}
          />
        </div>

        {/* Question Card */}
        <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-10 flex flex-col">
          <div className="flex-1 flex items-center justify-center">
            <h2 className="text-2xl md:text-4xl font-bold text-slate-800 text-center leading-tight mb-8">
              {currentQ.meaning}
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-auto">
            {currentQ.options.map((option, idx) => {
              const isCorrectOption = option === currentQ.correct_word;
              const isSelected = selectedOption === option;
              
              let buttonStyle = "bg-slate-50 border-slate-200 text-slate-700 hover:bg-primary-50 hover:border-primary-200 hover:text-primary-700";
              let icon = null;
              
              if (showResult) {
                if (isCorrectOption) {
                  // Correct answer always lights up Green
                  buttonStyle = "bg-green-50 border-green-400 text-green-700 shadow-[0_0_0_2px_rgba(74,222,128,0.3)]";
                  icon = <CheckCircle size={20} className="text-green-500" />;
                } else if (isSelected && !isCorrectOption) {
                  // Selected wrong answer lights up Red
                  buttonStyle = "bg-red-50 border-red-400 text-red-700";
                  icon = <XCircle size={20} className="text-red-500" />;
                } else {
                  // Unselected wrong answers fade out
                  buttonStyle = "bg-slate-50 border-slate-200 text-slate-400 opacity-60";
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleOptionClick(option)}
                  disabled={showResult}
                  className={`relative w-full text-left px-6 py-5 rounded-2xl border-2 font-bold text-lg md:text-xl transition-all duration-200 flex flex-col ${buttonStyle} ${showResult ? 'cursor-default transition-transform-none' : 'active:scale-95 cursor-pointer'}`}
                >
                  <span className="flex-1 pr-6">{option}</span>
                  {icon && (
                    <div className="absolute right-6 top-1/2 -translate-y-1/2">
                      {icon}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyQuiz;
