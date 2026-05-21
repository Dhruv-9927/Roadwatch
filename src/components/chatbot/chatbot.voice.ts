// ROADWATCH CHATBOT — Voice Hooks
// Wraps Web Speech API for TTS + STT.
// Gracefully degrades when the browser doesn't support it.

import { useState, useEffect, useRef, useCallback } from 'react';
import type { TTSConfig, STTConfig } from './chatbot.types';

// ── TTS ────────────────────────────────────────────────────────────────────

export function useTTS(config: TTSConfig) {
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const speak = useCallback((text: string, lang?: string) => {
    if (!supported) return;

    // Strip emojis, markdown, and action JSON for cleaner speech
    const clean = text
      .replace(/\{[^}]*"action"[^}]*\}/g, '')
      .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
      .replace(/[*#_]/g, '') // Remove markdown symbols
      .trim();

    window.speechSynthesis.cancel();
    
    setTimeout(() => {
      const u       = new SpeechSynthesisUtterance(clean);
      u.lang        = lang ?? config.lang;
      u.rate        = config.rate;
      u.pitch       = config.pitch;
      u.volume      = config.volume;
      if (config.voice) u.voice = config.voice;

      u.onstart  = () => setSpeaking(true);
      u.onend    = () => setSpeaking(false);
      u.onerror  = (e) => {
        console.error('TTS Error:', e);
        setSpeaking(false);
      };
      
      utterRef.current = u;
      window.speechSynthesis.speak(u);
    }, 50);
  }, [config, supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  // Cleanup on unmount
  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [supported]);

  return { speak, stop, speaking, supported };
}

// ── STT ────────────────────────────────────────────────────────────────────

// @ts-ignore - webkitSpeechRecognition not in lib.dom.d.ts
const SpeechRecognitionCtor: any =
  typeof window !== 'undefined'
    ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    : undefined;

export function useSTT(config: STTConfig) {
  const recognizerRef  = useRef<any>(null);
  const [listening,  setListening]  = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error,      setError]      = useState<string | null>(null);
  const supported = Boolean(SpeechRecognitionCtor);

  const start = useCallback((onFinal: (text: string) => void) => {
    if (!supported || !config.enabled) {
      setError("Speech recognition not supported in this browser.");
      return;
    }

    try {
      if (recognizerRef.current) {
        recognizerRef.current.abort();
      }

      const rec = new SpeechRecognitionCtor();
      // Use continuous to bypass Chrome's aggressive no-speech timeout bug
      rec.continuous    = true; 
      rec.interimResults = true;
      rec.lang           = config.lang || 'en-IN';

      let latestTranscript = '';
      let hasFiredFinal = false;

      rec.onstart = () => { 
        setListening(true); 
        setError(null); 
        setTranscript('Listening...');
      };
      
      rec.onend = () => {
        setListening(false);
        // Fallback: if stopped manually and we have interim text, send it
        if (!hasFiredFinal && latestTranscript.trim() && latestTranscript !== 'Listening...') {
          hasFiredFinal = true;
          onFinal(latestTranscript.trim());
        }
      };
      
      rec.onerror = (e: any) => {
        setListening(false);
        if (e.error === 'not-allowed') {
          setError('Microphone permission denied. Please allow it.');
        } else if (e.error === 'no-speech') {
          // Ignore no-speech visually so it doesn't look broken, just silently stop
          setTranscript('');
        } else {
          setError(`Voice error: ${e.error}`);
        }
      };

      rec.onresult = (e: any) => {
        let interim = '';
        let final = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const chunk = e.results[i][0].transcript;
          if (e.results[i].isFinal) final += chunk;
          else interim += chunk;
        }
        
        latestTranscript = final || interim;
        setTranscript(latestTranscript);
        
        if (final.trim() && !hasFiredFinal) {
          hasFiredFinal = true;
          rec.stop(); // Auto-stop on first complete sentence
          onFinal(final.trim());
        }
      };

      recognizerRef.current = rec;
      rec.start();
    } catch (err) {
      console.error("Speech Recognition failed to start:", err);
      setError("Speech recognition failed. Check microphone permissions.");
      setListening(false);
    }
  }, [config, supported]);

  const stop = useCallback(() => {
    if (recognizerRef.current) {
      recognizerRef.current.stop();
    }
    setListening(false);
  }, []);

  const clear = useCallback(() => setTranscript(''), []);

  useEffect(() => () => {
    if (recognizerRef.current) {
      recognizerRef.current.abort();
    }
  }, []);

  return { start, stop, clear, listening, transcript, error, supported };
}

// ── Available voices for the language picker ──────────────────────────────

export function getAvailableVoices(lang?: string): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const voices = window.speechSynthesis.getVoices();
  if (!lang) return voices;
  return voices.filter((v) => v.lang.startsWith(lang.split('-')[0]));
}
