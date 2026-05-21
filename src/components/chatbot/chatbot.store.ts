// ROADWATCH CHATBOT — Zustand Store
// Manages conversation state. Imported alongside the main app.store.

import { create } from 'zustand';
import type {
  ChatMessage,
  ConversationContext,
  BotState,
  TTSConfig,
  STTConfig,
} from './chatbot.types';

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface ChatbotStore {
  // ── UI state ────────────────────────────────────────────────────────────
  isOpen:     boolean;
  botState:   BotState;

  // ── Messages ─────────────────────────────────────────────────────────────
  messages:   ChatMessage[];

  // ── Context ──────────────────────────────────────────────────────────────
  context:    ConversationContext;

  // ── Voice config ─────────────────────────────────────────────────────────
  ttsConfig:  TTSConfig;
  sttConfig:  STTConfig;

  // ── Actions ──────────────────────────────────────────────────────────────
  openChat:            () => void;
  closeChat:           () => void;
  toggleChat:          () => void;
  setBotState:         (state: BotState) => void;

  addMessage:          (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => string;
  updateMessage:       (id: string, patch: Partial<ChatMessage>) => void;
  clearMessages:       () => void;

  updateContext:       (patch: Partial<ConversationContext>) => void;

  setTTSEnabled:       (enabled: boolean) => void;
  setSTTEnabled:       (enabled: boolean) => void;
  setTTSLang:          (lang: string) => void;
}

const WELCOME_MESSAGE: ChatMessage = {
  id:        'welcome',
  role:      'assistant',
  text:      "👋 Hi! I'm SafePath AI — your ROADWATCH assistant.\n\nI can help you report road issues, check how public money is spent on roads, file complaints, and more.\n\nWhat would you like to do?",
  timestamp: new Date(),
  inputMode: 'quickreply',
  quickReplies: [
    { id: 'accident',  label: '🚨 Report an accident', action: 'REPORT_ACCIDENT' },
    { id: 'spending',  label: '💰 Show budget accountability', action: 'CHECK_SPENDING' },
    { id: 'complaint', label: '📣 File a complaint',    action: 'FILE_COMPLAINT' },
    { id: 'nearby',    label: '📍 Issues near me',      action: 'NEARBY_ISSUES' },
  ],
};

export const useChatbotStore = create<ChatbotStore>((set) => ({
  isOpen:   false,
  botState: 'idle',

  messages: [WELCOME_MESSAGE],

  context: {
    lastRoadId:       null,
    lastTab:          null,
    reportInProgress: false,
    reportDraft:      {},
    awaitingInput:    null,
  },

  ttsConfig: {
    enabled: false, // user must opt-in (battery + privacy)
    voice:   null,
    rate:    0.95,
    pitch:   1.0,
    volume:  1.0,
    lang:    'hi-IN',
  },

  sttConfig: {
    enabled:    true,
    continuous: false,
    lang:       'hi-IN',
  },

  // ── Actions ──────────────────────────────────────────────────────────────
  openChat:   () => set({ isOpen: true }),
  closeChat:  () => set({ isOpen: false }),
  toggleChat: () => set((s) => ({ isOpen: !s.isOpen })),
  setBotState:(state) => set({ botState: state }),

  addMessage: (msg) => {
    const id = uuid();
    set((s) => ({
      messages: [...s.messages, { ...msg, id, timestamp: new Date() }],
    }));
    return id;
  },

  updateMessage: (id, patch) =>
    set((s) => ({
      messages: s.messages.map((m) => m.id === id ? { ...m, ...patch } : m),
    })),

  clearMessages: () => set({ messages: [WELCOME_MESSAGE] }),

  updateContext: (patch) =>
    set((s) => ({ context: { ...s.context, ...patch } })),

  setTTSEnabled: (enabled) =>
    set((s) => ({ ttsConfig: { ...s.ttsConfig, enabled } })),
  setSTTEnabled: (enabled) =>
    set((s) => ({ sttConfig: { ...s.sttConfig, enabled } })),
  setTTSLang: (lang) =>
    set((s) => ({
      ttsConfig: { ...s.ttsConfig, lang },
      sttConfig: { ...s.sttConfig, lang },
    })),
}));
