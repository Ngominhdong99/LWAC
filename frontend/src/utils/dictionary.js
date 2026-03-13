/**
 * Dictionary lookup utility — fetches IPA, English definition,
 * and Vietnamese translation for English words.
 * 
 * Uses:
 * - dictionaryapi.dev for IPA and English definitions
 * - MyMemory API for English → Vietnamese translation
 */
import axios from 'axios';

const DICT_API = 'https://api.dictionaryapi.dev/api/v2/entries/en';
const TRANSLATE_API = 'https://api.mymemory.translated.net/get';

/**
 * Translate text from English to Vietnamese using MyMemory.
 */
async function translateToVietnamese(text) {
  try {
    const res = await axios.get(TRANSLATE_API, {
      params: { q: text, langpair: 'en|vi' },
      timeout: 3000
    });
    const translated = res.data?.responseData?.translatedText;
    if (translated && translated.toLowerCase() !== text.toLowerCase()) {
      return translated;
    }
    return '';
  } catch (e) {
    return '';
  }
}

/**
 * Look up a word and return { ipa, meaning, partOfSpeech }
 * meaning includes both English definition and Vietnamese translation.
 */
export async function lookupWord(word) {
  try {
    const cleanWord = word.trim().split(/\s+/)[0]; // Take first word if multi-word
    if (!cleanWord || cleanWord.length < 2) return { ipa: '', meaning: '', partOfSpeech: '' };

    // Fetch dictionary + translation in parallel
    const [dictRes, viTranslation] = await Promise.all([
      axios.get(`${DICT_API}/${encodeURIComponent(cleanWord.toLowerCase())}`, { timeout: 3000 }).catch(() => null),
      translateToVietnamese(cleanWord)
    ]);

    let ipa = '';
    let enMeaning = '';
    let partOfSpeech = '';

    if (dictRes?.data?.[0]) {
      const entry = dictRes.data[0];

      // Get IPA
      ipa = entry.phonetic
        || entry.phonetics?.find(p => p.text)?.text
        || '';

      // Get first meaning
      const firstMeaning = entry.meanings?.[0];
      partOfSpeech = firstMeaning?.partOfSpeech || '';

      // Combine up to 2 English meanings
      let meanings = [];
      for (const m of (entry.meanings || [])) {
        const def = m.definitions?.[0]?.definition;
        if (def) meanings.push(`(${m.partOfSpeech}) ${def}`);
        if (meanings.length >= 2) break;
      }
      enMeaning = meanings.join(' | ');
    }

    // Build combined meaning: Vietnamese first, then English
    let finalMeaning = '';
    if (viTranslation && enMeaning) {
      finalMeaning = `🇻🇳 ${viTranslation}\n🇬🇧 ${enMeaning}`;
    } else if (viTranslation) {
      finalMeaning = viTranslation;
    } else if (enMeaning) {
      finalMeaning = enMeaning;
    }

    return { ipa, meaning: finalMeaning, partOfSpeech };
  } catch (e) {
    return { ipa: '', meaning: '', partOfSpeech: '' };
  }
}

export default lookupWord;
