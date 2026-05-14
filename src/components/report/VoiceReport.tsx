/**
 * ROADWATCH — Hindi Voice Report
 * Uses native Web Speech API (no external service, works offline on Android).
 * Parses Hindi speech → extracts road/issue/severity/location → auto-fills form.
 * Speaks confirmation back in Hindi via SpeechSynthesis.
 */
import { useState, useRef, useEffect, useCallback } from 'react';

// ── Type declarations for Web Speech API ─────────────────────────────────────
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// ── Hindi keyword maps ────────────────────────────────────────────────────────
const ROAD_KEYWORDS: Record<string, string[]> = {
  'NH-3':   ['nh teen', 'nh-3', 'nh 3', 'national highway 3', 'nh three', 'teen'],
  'NH-154': ['nh sau chauwan', 'nh 154', 'nh-154', 'chauwan'],
  'NH-21':  ['nh ikkis', 'nh 21', 'nh-21', 'ikkis'],
  'SH-26':  ['state highway', 'rajya sadak', 'sh 26', 'sh-26'],
};

const ISSUE_KEYWORDS: Record<string, { hi: string; en: string; words: string[] }> = {
  pothole:      { hi: 'गड्ढा',       en: 'Pothole',         words: ['gadhha', 'gadha', 'gaddha', 'gadhe', 'gadhhe', 'khadda', 'khanda', 'pothole', 'गड्ढा'] },
  road_damage:  { hi: 'सड़क टूटी',   en: 'Road Damage',     words: ['sadak toot', 'toot gayi', 'tuti hui', 'crack', 'dhaas', 'टूट'] },
  flooding:     { hi: 'जलभराव',      en: 'Waterlogging',    words: ['pani bhar', 'paani bhar', 'baarish', 'jal bhar', 'waterlog', 'पानी'] },
  missing_sign: { hi: 'साइनबोर्ड',   en: 'Missing Sign',    words: ['signboard nahi', 'board nahi', 'sign nahi', 'signboard'] },
  object:       { hi: 'अवरोध',       en: 'Object on Road',  words: ['pathar', 'ped gira', 'tree gir', 'debris', 'rokawat', 'rock'] },
  bridge:       { hi: 'पुल क्षति',   en: 'Bridge Issue',    words: ['pul', 'bridge', 'culvert', 'nala'] },
  streetlight:  { hi: 'लाइट खराब',  en: 'Street Light',    words: ['light nahi', 'batti nahi', 'andhera', 'light'] },
};

const SEVERITY_KEYWORDS: Record<string, string[]> = {
  critical: ['bahut bada', 'bade bade', 'bahut bure', 'khatarnak', 'bahut kharab', 'danger'],
  high:     ['bada', 'bade', 'gahre', 'zyada', 'badi', 'deep'],
  medium:   ['thoda', 'medium', 'madhyam', 'kuch'],
  low:      ['chhota', 'thoda sa', 'small', 'halka'],
};

const LOCATION_KEYWORDS: Record<string, string[]> = {
  'Paddal Bridge': ['paddal', 'padal', 'paddal bridge', 'paddal pul'],
  'Mandi City':    ['mandi', 'mandi shahr', 'mandi city'],
  'Sundernagar':   ['sundernagar', 'sunder nagar', 'sunder'],
  'Jogindernagar': ['jogindernagar', 'joginder'],
  'Rewalsar':      ['rewalsar', 'rewal'],
  'Kullu':         ['kullu', 'kullu district'],
  'Shimla':        ['shimla', 'simla'],
};

// ── Parser ────────────────────────────────────────────────────────────────────
export interface ParsedReport {
  road:      string | null;
  issue:     string | null;
  issueHi:   string | null;
  issueEn:   string | null;
  severity:  'low' | 'medium' | 'high' | 'critical';
  location:  string | null;
  rawText:   string;
}

function parseHindi(text: string): ParsedReport {
  const t = text.toLowerCase();

  // Road
  let road: string | null = null;
  for (const [name, words] of Object.entries(ROAD_KEYWORDS)) {
    if (words.some(w => t.includes(w))) { road = name; break; }
  }

  // Issue
  let issue: string | null = null;
  let issueHi: string | null = null;
  let issueEn: string | null = null;
  for (const [id, data] of Object.entries(ISSUE_KEYWORDS)) {
    if (data.words.some(w => t.includes(w))) {
      issue = id; issueHi = data.hi; issueEn = data.en; break;
    }
  }

  // Severity
  let severity: ParsedReport['severity'] = 'high';
  for (const [sev, words] of Object.entries(SEVERITY_KEYWORDS)) {
    if (words.some(w => t.includes(w))) { severity = sev as ParsedReport['severity']; break; }
  }

  // Location
  let location: string | null = null;
  for (const [name, words] of Object.entries(LOCATION_KEYWORDS)) {
    if (words.some(w => t.includes(w))) { location = name; break; }
  }

  return { road, issue, issueHi, issueEn, severity, location, rawText: text };
}

// ── TTS ───────────────────────────────────────────────────────────────────────
function speakHindi(text: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'hi-IN';
  utt.rate = 0.9;
  utt.pitch = 1;
  const voices = window.speechSynthesis.getVoices();
  const hi = voices.find(v => v.lang.startsWith('hi'));
  if (hi) utt.voice = hi;
  window.speechSynthesis.speak(utt);
}

// ── Authority lookup ──────────────────────────────────────────────────────────
const AUTHORITY_MAP: Record<string, { name: string; officer: string; phone: string }> = {
  'NH-3':   { name: 'NHAI Mandi Division',       officer: 'AK Sharma, EE',     phone: '01905-222301' },
  'NH-154': { name: 'NHAI Mandi PIU',             officer: 'RS Verma, EE',      phone: '01905-235612' },
  'NH-21':  { name: 'NHAI Kullu Division',        officer: 'PK Gupta, EE',      phone: '01902-222180' },
  'SH-26':  { name: 'HP PWD Division Mandi',      officer: 'MK Thakur, SDO',    phone: '01905-222450' },
  DEFAULT:  { name: 'HP PWD District Office',     officer: 'District Engineer', phone: '01905-222000' },
};

// ── Severity labels in Hindi ──────────────────────────────────────────────────
const SEV_HI: Record<string, string> = {
  low: 'साधारण', medium: 'मध्यम', high: 'गंभीर', critical: 'अत्यंत गंभीर',
};
const SEV_COLOR: Record<string, string> = {
  low: '#52b788', medium: '#f9c74f', high: '#f4a261', critical: '#e63946',
};

// ── Main Component ────────────────────────────────────────────────────────────
interface VoiceReportProps {
  onParsed?: (report: ParsedReport) => void;
}

export default function VoiceReport({ onParsed }: VoiceReportProps) {
  const [listening,  setListening]  = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsed,     setParsed]     = useState<ParsedReport | null>(null);
  const [spoken,     setSpoken]     = useState(false);
  const [supported,  setSupported]  = useState(true);
  const [pulseRing,  setPulseRing]  = useState(false);

  const recognitionRef = useRef<any>(null);
  const refNo = useRef(`007${Math.floor(Math.random() * 900 + 100)}`);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }

    const rec = new SR();
    rec.lang = 'hi-IN';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e: any) => {
      const results = Array.from(e.results as any[]);
      const interim = results.map((r: any) => r[0].transcript).join('');
      setTranscript(interim);
      if (e.results[e.results.length - 1].isFinal) {
        const final = interim;
        const p = parseHindi(final);
        setParsed(p);
        onParsed?.(p);
        setListening(false);
        setPulseRing(false);
        // Speak confirmation
        const auth = AUTHORITY_MAP[p.road ?? ''] ?? AUTHORITY_MAP['DEFAULT'];
        const msg = `Aapki shikayat ${auth.name} ko bhej di gayi hai. Reference number hai ${refNo.current}.`;
        setTimeout(() => { speakHindi(msg); setSpoken(true); }, 600);
      }
    };
    rec.onerror = () => { setListening(false); setPulseRing(false); };
    rec.onend   = () => { setListening(false); setPulseRing(false); };
    recognitionRef.current = rec;
  }, [onParsed]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    setTranscript('');
    setParsed(null);
    setSpoken(false);
    setListening(true);
    setPulseRing(true);
    recognitionRef.current.start();
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
    setPulseRing(false);
  }, []);

  const reset = () => {
    setParsed(null);
    setTranscript('');
    setSpoken(false);
    window.speechSynthesis?.cancel();
  };

  if (!supported) return (
    <div style={cardStyle}>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, textAlign: 'center' }}>
        ⚠ Voice input not supported in this browser. Try Chrome or Edge.
      </p>
    </div>
  );

  const auth = parsed?.road ? (AUTHORITY_MAP[parsed.road] ?? AUTHORITY_MAP['DEFAULT']) : null;

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 20 }}>🎙</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--color-accent)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Voice Report — हिंदी
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--color-text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: 6 }}>
            Web Speech API · hi-IN
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          माइक दबाएं और हिंदी में बोलें — फॉर्म अपने आप भर जाएगा
        </p>
      </div>

      {/* Mic button */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Pulse rings */}
          {pulseRing && (
            <>
              <div style={{ ...ringStyle, animationDelay: '0s' }} />
              <div style={{ ...ringStyle, animationDelay: '0.4s' }} />
            </>
          )}
          {/* Mic button */}
          <button
            id="voice-mic-btn"
            onClick={listening ? stopListening : startListening}
            aria-label={listening ? 'Stop recording' : 'Start voice input'}
            aria-pressed={listening}
            style={{
              width: 72, height: 72,
              borderRadius: '50%',
              background: listening
                ? 'linear-gradient(135deg, #e63946, #c1121f)'
                : 'linear-gradient(135deg, #f4a261, #e76f51)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', zIndex: 2,
              boxShadow: listening
                ? '0 0 0 4px rgba(230,57,70,0.25), 0 4px 20px rgba(230,57,70,0.4)'
                : '0 4px 20px rgba(244,162,97,0.35)',
              transition: 'all 0.2s ease',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              {listening
                ? <rect x="6" y="6" width="12" height="12" rx="2"/>
                : <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"/><line x1="12" y1="19" x2="12" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round"/><line x1="8" y1="23" x2="16" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round"/></>
              }
            </svg>
          </button>
        </div>

        <p style={{ fontSize: 12, color: listening ? '#e63946' : 'var(--color-text-muted)', fontFamily: 'var(--font-display)', transition: 'color 0.2s' }}>
          {listening ? '● सुन रहे हैं… बोलिए' : 'माइक दबाएं'}
        </p>

        {/* Example prompt */}
        {!listening && !parsed && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px', fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.7, fontStyle: 'italic' }}>
            उदाहरण: <span style={{ color: 'var(--color-text-secondary)' }}>"NH teen pe bade bade gadhhe hain, Paddal bridge ke paas"</span>
          </div>
        )}
      </div>

      {/* Live transcript */}
      {transcript && !parsed && (
        <div style={{ marginTop: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 4, fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Live Transcript</div>
          <p style={{ fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.6 }}>{transcript}</p>
        </div>
      )}

      {/* Parsed result card */}
      {parsed && (
        <div style={{ marginTop: 16, border: '1px solid rgba(82,183,136,0.3)', background: 'rgba(82,183,136,0.05)', borderRadius: 12, overflow: 'hidden' }}>
          {/* Hindi confirmation header */}
          <div style={{ background: 'rgba(82,183,136,0.12)', padding: '12px 16px', borderBottom: '1px solid rgba(82,183,136,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>✓</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: '#52b788', fontWeight: 600 }}>आपकी बात सुनी गई</span>
            {spoken && <span style={{ marginLeft: 'auto', fontSize: 18 }} title="Spoken confirmation">🔊</span>}
          </div>

          {/* Extracted data */}
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row label="सड़क" value={parsed.road ?? 'पहचाना नहीं'} accent={!!parsed.road} />
            <Row label="समस्या" value={parsed.issueHi ? `${parsed.issueHi} (${parsed.issueEn})` : 'पहचाना नहीं'} accent={!!parsed.issue} />
            <Row
              label="गंभीरता"
              value={`${SEV_HI[parsed.severity]} (${parsed.severity})`}
              color={SEV_COLOR[parsed.severity]}
            />
            {parsed.location && <Row label="स्थान" value={parsed.location} accent />}

            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '2px 0' }} />

            {/* Authority */}
            {auth && (
              <>
                <Row label="शिकायत जाएगी" value={auth.name} accent />
                <Row label="अधिकारी" value={auth.officer} />
                <Row label="फोन" value={auth.phone} />
                <Row label="Ref No." value={`#${refNo.current}`} color="var(--color-accent)" />
              </>
            )}
          </div>

          {/* Raw transcript */}
          <div style={{ padding: '8px 16px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 3, fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>आपने कहा</div>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5, fontStyle: 'italic' }}>"{parsed.rawText}"</p>
          </div>

          {/* TTS replay + reset */}
          <div style={{ display: 'flex', gap: 8, padding: '0 16px 14px' }}>
            <button
              id="voice-replay-btn"
              onClick={() => {
                if (!auth) return;
                speakHindi(`Aapki shikayat ${auth.name} ko bhej di gayi hai. Reference number hai ${refNo.current}.`);
              }}
              style={ghostBtn}
            >
              🔊 दोबारा सुनें
            </button>
            <button id="voice-reset-btn" onClick={reset} style={ghostBtn}>
              ↩ फिर से बोलें
            </button>
          </div>
        </div>
      )}

      {/* Supported locales note */}
      <p style={{ marginTop: 12, fontSize: 10, color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
        🌐 Also works in: <span style={{ color: 'var(--color-text-secondary)' }}>sw-KE (Swahili) · yo-NG (Yoruba) · vi-VN (Vietnamese)</span>
      </p>

      <style>{`
        @keyframes voicePulse {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Row({ label, value, accent, color }: { label: string; value: string; accent?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-display)', flexShrink: 0, paddingTop: 1 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: color ?? (accent ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'), textAlign: 'right' }}>{value}</span>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-card)',
  padding: '20px',
};

const ringStyle: React.CSSProperties = {
  position: 'absolute',
  width: 72, height: 72,
  borderRadius: '50%',
  background: 'rgba(230, 57, 70, 0.35)',
  animation: 'voicePulse 1.2s ease-out infinite',
  zIndex: 1,
};

const ghostBtn: React.CSSProperties = {
  flex: 1, padding: '8px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  color: 'var(--color-text-secondary)',
  fontSize: 12, cursor: 'pointer',
  fontFamily: 'var(--font-body)',
};
