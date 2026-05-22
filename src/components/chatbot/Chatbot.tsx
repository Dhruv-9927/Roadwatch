// ROADWATCH CHATBOT — Main Component
// Full-featured chat panel with voice, quick replies, and streaming AI.

import { useState, useRef, useEffect, useCallback } from 'react';
import './Chatbot.css';
import { useChatbotStore } from './chatbot.store';
import { useAppStore } from '../../store/app.store';
import { 
  HOME_QUICK_REPLIES, 
  COMMON_ISSUE_REPLIES, 
  NOTIFICATION_REPLIES,
  ACCIDENT_REPLIES,
  FIRE_REPLIES,
  POLICE_REPLIES,
  getAIResponse, 
  getOfflineResponse 
} from './chatbot.engine';
import { useTTS, useSTT } from './chatbot.voice';
import type { QuickReply } from './chatbot.types';

// ── Sub-components ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="chat-typing" aria-label="SafePath AI is thinking">
      <span /><span /><span />
    </div>
  );
}

function MessageBubble({
  message,
  onQuickReply,
  onSpeak,
}: {
  message: ReturnType<typeof useChatbotStore.getState>['messages'][0];
  onQuickReply: (reply: QuickReply) => void;
  onSpeak: (text: string) => void;
}) {
  const isBot = message.role === 'assistant';

  return (
    <div className={`chat-message-row ${isBot ? 'bot' : 'user'}`}>
      {isBot && (
        <div className="chat-avatar" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="4" /><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeWidth="1.5" opacity="0.4"/>
            <path d="M9 22V12h6v10" strokeWidth="1.5" opacity="0.4"/>
          </svg>
        </div>
      )}

      <div className="chat-bubble-wrap">
        <div className={`chat-bubble ${isBot ? 'bot' : 'user'} ${message.isStreaming ? 'streaming' : ''}`}>
          {/* Format text: newlines → line breaks */}
          {message.text.split('\n').map((line, i) => (
            <span key={i}>{line}{i < message.text.split('\n').length - 1 && <br />}</span>
          ))}
          {message.isStreaming && <span className="cursor-blink">▌</span>}
        </div>

        {/* TTS speak button */}
        {isBot && !message.isStreaming && (
          <button
            className="chat-speak-btn"
            onClick={() => onSpeak(message.text)}
            aria-label="Read aloud"
            title="Read aloud"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 5L6 9H2v6h4l5 4V5z"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
          </button>
        )}

        {/* Quick replies */}
        {isBot && message.quickReplies && message.quickReplies.length > 0 && (
          <div className="chat-quick-replies" role="group" aria-label="Quick reply options">
            {message.quickReplies.map((r) => (
              <button
                key={r.id}
                className="chat-qr-btn"
                onClick={() => onQuickReply(r)}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}

        <time className="chat-time" dateTime={message.timestamp.toISOString()}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </time>
      </div>
    </div>
  );
}

// ── Main ChatBot component ─────────────────────────────────────────────────

export default function ChatBot() {
  const {
    isOpen, toggleChat, closeChat,
    messages, addMessage, updateMessage, clearMessages,
    botState, setBotState,
    context, updateContext,
    ttsConfig, sttConfig,
    setTTSEnabled, setTTSLang,
  } = useChatbotStore();

  const { activeTab, setActiveTab, offlineMode } = useAppStore();

  const [inputText, setInputText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const endRef      = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const panelRef    = useRef<HTMLDivElement>(null);

  const tts = useTTS(ttsConfig);
  const stt = useSTT(sttConfig);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  // Update context when app tab changes
  useEffect(() => {
    updateContext({ lastTab: activeTab });
  }, [activeTab, updateContext]);

  const unlockAudio = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance('');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
  }, []);

  // ── Handle sending a message ───────────────────────────────────────────

  const sendMessage = useCallback(async (text: string, mode: 'text' | 'voice' | 'quickreply' = 'text') => {
    const trimmed = text.trim();
    if (!trimmed || botState === 'thinking') return;

    unlockAudio(); // unlock TTS on user interaction

    // Add user message
    addMessage({ role: 'user', text: trimmed, inputMode: mode });
    setInputText('');
    setBotState('thinking');

    try {
      if (offlineMode) {
        // Offline fallback
        await new Promise((r) => setTimeout(r, 400));
        const reply = getOfflineResponse(trimmed);
        addMessage({
          role: 'assistant',
          text: reply,
          inputMode: 'text',
          quickReplies: HOME_QUICK_REPLIES,
        });
        setBotState('idle');
        if (ttsConfig.enabled) tts.speak(reply);
        return;
      }

      // Start streaming response
      const botMsgId = addMessage({
        role: 'assistant',
        text: '',
        inputMode: 'text',
        isStreaming: true,
      });

      let fullText = '';
      const { cleanText, action } = await getAIResponse(
        trimmed,
        messages,
        { ...context, lastTab: activeTab, lang: ttsConfig.lang },
        (chunk) => {
          fullText += chunk;
          updateMessage(botMsgId, { text: fullText });
        },
      );

      // Determine quick replies based on context
      let quickReplies: QuickReply[] | undefined;
      if (action?.action === 'SHOW_QUICK_REPLIES') {
        if (action.type === 'common_issues') quickReplies = COMMON_ISSUE_REPLIES;
        else if (action.type === 'notification') quickReplies = NOTIFICATION_REPLIES;
        else if (action.type === 'accident') quickReplies = ACCIDENT_REPLIES;
        else if (action.type === 'fire') quickReplies = FIRE_REPLIES;
        else if (action.type === 'police') quickReplies = POLICE_REPLIES;
      } else if (!context.reportInProgress) {
        quickReplies = HOME_QUICK_REPLIES;
      }

      updateMessage(botMsgId, {
        text: cleanText || fullText,
        isStreaming: false,
        quickReplies,
      });

      // Handle navigation action
      if (action?.action === 'NAVIGATE' && action.tab) {
        setTimeout(() => setActiveTab(action.tab as any), 600);
      }

      setBotState('idle');
      if (ttsConfig.enabled) tts.speak(cleanText || fullText);

    } catch (err) {
      console.error('ChatBot error:', err);
      addMessage({
        role: 'assistant',
        text: "Sorry, I couldn't connect right now 😕 Try again in a moment, or use the app tabs directly.",
        inputMode: 'text',
        quickReplies: HOME_QUICK_REPLIES.slice(0, 4),
      });
      setBotState('error');
      setTimeout(() => setBotState('idle'), 2000);
    }
  }, [addMessage, updateMessage, botState, setBotState, messages, context, activeTab, offlineMode, ttsConfig.enabled, tts]);

  // ── Handle quick replies ───────────────────────────────────────────────

  const handleQuickReply = useCallback((reply: QuickReply) => {
    if (reply.link) {
      window.open(reply.link, '_self');
      sendMessage(`Calling ${reply.label.replace(/[📞🚓🚒🛡️]/g, '').split('(')[0].trim()}...`, 'quickreply');
      return;
    }

    if (reply.payload?.issue) {
      sendMessage(reply.label, 'quickreply');
      return;
    }

    switch (reply.action) {
      case 'OPT_WHATSAPP':
        sendMessage('Please send updates to my WhatsApp', 'quickreply');
        break;
      case 'OPT_SMS':
        sendMessage('Please send updates via SMS', 'quickreply');
        break;
      case 'START_REPORT':
        updateContext({ reportInProgress: true, awaitingInput: 'road_name' });
        sendMessage('I want to report a road issue', 'quickreply');
        break;
      case 'CHECK_SPENDING':
        setActiveTab('accountability');
        sendMessage('Show me road spending information', 'quickreply');
        break;
      case 'FILE_COMPLAINT':
        setActiveTab('report');
        sendMessage('I want to file a complaint', 'quickreply');
        break;
      case 'REPORT_ACCIDENT':
        sendMessage('I want to report an accident', 'quickreply');
        break;
      case 'NEARBY_ISSUES':
        setActiveTab('map');
        sendMessage('Show issues near me', 'quickreply');
        break;
      case 'TRACK_REPORT':
        sendMessage('How do I track my report status?', 'quickreply');
        break;
      case 'FIND_ROAD':
        setActiveTab('map');
        sendMessage('I want to find information about a road', 'quickreply');
        break;
      default:
        if (reply.label) sendMessage(reply.label, 'quickreply');
    }
  }, [sendMessage, setActiveTab, updateContext, context.reportDraft]);

  // ── Voice input ────────────────────────────────────────────────────────

  const handleVoiceToggle = () => {
    if (stt.listening) {
      stt.stop();
    } else {
      stt.clear();
      stt.start((finalText) => {
        setInputText(finalText);
        // Auto-send after short pause
        setTimeout(() => sendMessage(finalText, 'voice'), 300);
      });
    }
  };

  // ── Language options ───────────────────────────────────────────────────

  const LANGUAGES = [
    { code: 'hi-IN', label: 'हिंदी' },
    { code: 'en-IN', label: 'English' },
    { code: 'bn-IN', label: 'বাংলা' },
    { code: 'ta-IN', label: 'தமிழ்' },
    { code: 'te-IN', label: 'తెలుగు' },
    { code: 'mr-IN', label: 'मराठी' },
  ];

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      {/* Floating action button */}
      <button
        className={`chatbot-fab ${isOpen ? 'open' : ''} ${botState === 'thinking' ? 'thinking' : ''}`}
        onClick={() => {
          unlockAudio();
          toggleChat();
        }}
        aria-label={isOpen ? 'Close assistant' : 'Open SafePath AI assistant'}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            <circle cx="9"  cy="10" r="1" fill="currentColor"/>
            <circle cx="12" cy="10" r="1" fill="currentColor"/>
            <circle cx="15" cy="10" r="1" fill="currentColor"/>
          </svg>
        )}
        {/* Unread dot */}
        {!isOpen && messages.length > 1 && (
          <span className="chatbot-fab-dot" aria-label="New messages" />
        )}
      </button>



      {/* Chat panel */}
      <div
        ref={panelRef}
        className={`chatbot-panel ${isOpen ? 'open' : ''}`}
        role="dialog"
        aria-label="SafePath AI assistant"
        aria-modal="true"
      >
        {/* Header */}
        <div className="chatbot-header">
          <div className="chatbot-header-info">
            <div className="chatbot-header-avatar" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
            </div>
            <div>
              <p className="chatbot-header-name">SafePath AI</p>
              <p className="chatbot-header-status">
                {botState === 'thinking' ? (
                  <span className="status-thinking">Thinking…</span>
                ) : offlineMode ? (
                  <span className="status-offline">Offline mode</span>
                ) : (
                  <span className="status-online">● Online</span>
                )}
              </p>
            </div>
          </div>
          <div className="chatbot-header-actions">
            <button
              className="chatbot-icon-btn"
              onClick={() => setShowSettings((v) => !v)}
              aria-label="Settings"
              title="Settings"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
            <button
              className="chatbot-icon-btn"
              onClick={clearMessages}
              aria-label="Clear chat"
              title="Clear chat"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/>
              </svg>
            </button>
            <button
              className="chatbot-icon-btn"
              onClick={closeChat}
              aria-label="Close chat"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="chatbot-settings" role="region" aria-label="Chatbot settings">
            <p className="settings-label">🔊 Read-aloud</p>
            <button
              className={`settings-toggle ${ttsConfig.enabled ? 'on' : ''}`}
              onClick={() => setTTSEnabled(!ttsConfig.enabled)}
              aria-pressed={ttsConfig.enabled}
            >
              {ttsConfig.enabled ? 'On' : 'Off'}
            </button>

            <p className="settings-label" style={{ marginTop: 10 }}>🌐 Language</p>
            <div className="settings-lang-grid">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  className={`settings-lang-btn ${ttsConfig.lang === l.code ? 'active' : ''}`}
                  onClick={() => setTTSLang(l.code)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="chatbot-messages" role="log" aria-live="polite" aria-label="Chat messages">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onQuickReply={handleQuickReply}
              onSpeak={(text) => tts.speak(text)}
            />
          ))}
          {botState === 'thinking' && (
            <div className="chat-message-row bot">
              <div className="chat-avatar" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
              </div>
              <TypingDots />
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Voice transcript preview */}
        {stt.listening && (
          <div className="chatbot-voice-preview" aria-live="polite">
            <span className="voice-dot" aria-hidden="true" />
            <span>{stt.transcript || 'Listening…'}</span>
          </div>
        )}
        {stt.error && (
          <div className="chatbot-voice-error" role="alert">{stt.error}</div>
        )}

        {/* Input bar */}
        <div className="chatbot-input-bar">
          {/* Voice button */}
          {stt.supported && (
            <button
              className={`chatbot-voice-btn ${stt.listening ? 'active' : ''}`}
              onClick={handleVoiceToggle}
              aria-label={stt.listening ? 'Stop listening' : 'Speak your message'}
              aria-pressed={stt.listening}
            >
              {stt.listening ? (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
                </svg>
              )}
            </button>
          )}



          <input
            ref={inputRef}
            className="chatbot-input"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage(inputText)}
            placeholder={stt.listening ? 'Listening…' : 'Ask anything or tap mic 🎤'}
            aria-label="Type your message"
            disabled={botState === 'thinking' || stt.listening}
            maxLength={500}
          />

          <button
            className="chatbot-send-btn"
            onClick={() => sendMessage(inputText)}
            disabled={!inputText.trim() || botState === 'thinking'}
            aria-label="Send message"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="chatbot-backdrop"
          onClick={closeChat}
          aria-hidden="true"
        />
      )}
    </>
  );
}
