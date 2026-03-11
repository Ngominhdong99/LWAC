import React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Volume2, Plus, Check, HelpCircle } from 'lucide-react';
import { useState } from 'react';
import axios from 'axios';
import AskTeacherPopup from './AskTeacherPopup';
import { useAuth } from '../contexts/AuthContext';

const SmartHoverWord = ({ word, meaning, ipa, audioUrl, lessonId }) => {
  const [saved, setSaved] = useState(false);
  const [showAsk, setShowAsk] = useState(false);
  const { user } = useAuth();

  const playAudio = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch(e => console.error("Audio playback failed", e));
    } else {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  const saveToVocabVault = async () => {
    try {
      await axios.post(`http://127.0.0.1:8000/vocab/${user?.id || 1}`, {
        word, meaning, ipa, audio_url: audioUrl, source_lesson_id: lessonId || null
      });
      setSaved(true);
    } catch (error) {
      console.error("Failed to save vocab", error);
    }
  };

  return (
    <>
      <Popover.Root>
        <Popover.Trigger asChild>
          <span className="relative inline-block cursor-help font-medium text-primary-700 pb-0.5 border-b-2 border-primary-300 hover:bg-primary-50 transition-colors">
            {word}
          </span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="glass rounded-xl p-4 w-72 shadow-xl animate-in fade-in zoom-in-95 duration-200 z-50 text-slate-800" sideOffset={8}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="text-lg font-bold text-slate-900 leading-tight">{word}</h4>
                <p className="text-sm text-primary-600 font-medium font-mono">{ipa}</p>
              </div>
              <button onClick={playAudio} className="p-2 bg-primary-50 text-primary-600 rounded-full hover:bg-primary-100 hover:scale-105 transition-all shadow-sm" title="Listen">
                <Volume2 size={18} />
              </button>
            </div>
            <div className="my-3 py-3 border-t border-slate-100/50">
              <p className="text-sm font-medium leading-relaxed">{meaning}</p>
            </div>
            <div className="space-y-2">
              <button onClick={saveToVocabVault}
                className={`w-full flex items-center justify-center space-x-2 py-2 rounded-lg text-sm font-semibold transition-all ${saved ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white shadow-sm'}`}>
                {saved ? <><Check size={16} /><span>Saved to Vault</span></> : <><Plus size={16} /><span>Save to Vault</span></>}
              </button>
              {user?.role === 'student' && (
                <button onClick={() => setShowAsk(true)}
                  className="w-full flex items-center justify-center space-x-2 py-2 rounded-lg text-sm font-semibold bg-violet-50 text-violet-600 hover:bg-violet-100 border border-violet-200 transition-all">
                  <HelpCircle size={16} /><span>Ask Teacher</span>
                </button>
              )}
            </div>
            <Popover.Arrow className="fill-white/70 backdrop-blur-md" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {showAsk && <AskTeacherPopup questionText={`About the word "${word}": ${meaning}`} lessonId={lessonId} onClose={() => setShowAsk(false)} />}
    </>
  );
};

export default SmartHoverWord;
