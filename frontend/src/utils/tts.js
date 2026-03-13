/**
 * Natural TTS utility — picks the best available English voice
 * and applies tuned pitch/rate for natural-sounding speech.
 *
 * Priority order:
 *   1. Google US/UK English (very natural, available in Chrome)
 *   2. Microsoft Online (Natural) voices (Edge/Windows)
 *   3. Any "enhanced" or "premium" voice
 *   4. Any en-US / en-GB female voice
 *   5. Fallback to default
 */

let cachedVoice = null;
let voicesLoaded = false;

const PREFERRED_PATTERNS = [
  /google.*us.*english/i,
  /google.*uk.*english/i,
  /google.*english/i,
  /microsoft.*natural/i,
  /samantha/i,          // macOS natural voice
  /karen/i,             // macOS Australian
  /daniel/i,            // macOS British
  /enhanced/i,
  /premium/i,
];

function pickBestVoice() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  // Try preferred patterns in order
  for (const pattern of PREFERRED_PATTERNS) {
    const match = voices.find(v => pattern.test(v.name) && v.lang.startsWith('en'));
    if (match) return match;
  }

  // Fallback: any en-US or en-GB voice
  const enVoice = voices.find(v => v.lang === 'en-US') || voices.find(v => v.lang.startsWith('en'));
  return enVoice || null;
}

function ensureVoices() {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length) {
      resolve(voices);
      return;
    }
    window.speechSynthesis.onvoiceschanged = () => {
      resolve(window.speechSynthesis.getVoices());
    };
    // Timeout fallback
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 500);
  });
}

/**
 * Speak text with the best available natural voice.
 * @param {string} text - Text to speak
 * @param {object} options - { rate, pitch, onstart, onend, onerror }
 */
export async function speakNatural(text, options = {}) {
  window.speechSynthesis.cancel(); // Stop any ongoing speech

  if (!voicesLoaded) {
    await ensureVoices();
    voicesLoaded = true;
  }

  if (!cachedVoice) {
    cachedVoice = pickBestVoice();
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = options.rate ?? 0.95;   // Slightly slower = more natural
  utterance.pitch = options.pitch ?? 1.0;

  if (cachedVoice) {
    utterance.voice = cachedVoice;
  }

  if (options.onstart) utterance.onstart = options.onstart;
  if (options.onend) utterance.onend = options.onend;
  if (options.onerror) utterance.onerror = options.onerror;

  window.speechSynthesis.speak(utterance);
  return utterance;
}

/**
 * Cancel any ongoing speech.
 */
export function cancelSpeech() {
  window.speechSynthesis.cancel();
}

export default speakNatural;
