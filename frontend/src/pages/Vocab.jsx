import React, { useState, useEffect } from 'react';
import { Search, Volume2, Trash2 } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const VocabVault = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [vocabList, setVocabList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVocab = async () => {
      try {
        const targetUserId = user?.id || 1;
        const response = await axios.get(`http://127.0.0.1:8000/vocab/${targetUserId}`);
        const fetchedVocab = response.data.map(v => ({
           id: v.id,
           word: v.word,
           meaning: v.meaning,
           ipa: v.ipa,
           source: v.source_lesson_id ? `Lesson ID: ${v.source_lesson_id}` : 'General Practice',
           audioUrl: v.audio_url
        }));
        setVocabList(fetchedVocab.reverse()); // Show newest first
      } catch (error) {
        console.error("Failed to load vocab from backend:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchVocab();
  }, []);

  const filteredVocab = vocabList.filter(v => 
    v.word.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.meaning.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const playPronunciation = (word) => {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const removeVocab = async (id) => {
    try {
      await axios.delete(`http://127.0.0.1:8000/vocab/${id}`);
      setVocabList(vocabList.filter(v => v.id !== id));
    } catch(err) {
      console.error("Failed to delete vocab", err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-secondary">
      <div className="p-6 md:p-8 max-w-5xl mx-auto w-full flex-1">
        <header className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Vocab Vault</h1>
              <p className="text-slate-500 mt-1">Review and manage the words you've learned.</p>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search your vault..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-64 pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-sm transition-shadow"
              />
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20 md:pb-6">
          {loading ? (
            <div className="col-span-full py-16 flex justify-center items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : filteredVocab.map((vocab) => (
            <div key={vocab.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group flex flex-col h-full">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">{vocab.word}</h3>
                  {vocab.ipa && (
                    <p className="text-primary-600 font-mono text-sm tracking-wide bg-primary-50 inline-block px-2 py-0.5 rounded-md mt-1">
                      {vocab.ipa}
                    </p>
                  )}
                </div>
                <div className="flex space-x-1">
                  <button 
                    onClick={() => playPronunciation(vocab.word)}
                    className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-full transition-colors"
                  >
                    <Volume2 size={18} />
                  </button>
                  <button 
                    onClick={() => removeVocab(vocab.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              
              <p className="text-slate-700 font-medium mb-4 flex-grow">{vocab.meaning}</p>
              
              <div className="text-xs text-slate-400 border-t border-slate-100 pt-3 mt-auto flex justify-between items-center">
                <span>From: <span className="text-slate-500 italic">{vocab.source}</span></span>
              </div>
            </div>
          ))}

          {!loading && filteredVocab.length === 0 && (
            <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-slate-300">
              <p className="text-lg text-slate-500 font-medium">No words found.</p>
              <p className="text-sm text-slate-400 mt-1">Try a different search term or add more words while reading.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VocabVault;
