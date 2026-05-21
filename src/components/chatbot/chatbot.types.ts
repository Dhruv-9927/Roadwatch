// ROADWATCH CHATBOT — Types
// Extends the main app type system.

export type MessageRole = 'user' | 'assistant' | 'system';
export type InputMode   = 'text' | 'voice' | 'image' | 'quickreply';
export type BotState    = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export type QuickReply = {
  id:      string;
  label:   string;   // display text
  icon?:   string;   // emoji or inline svg string
  action?: string;   // intent to trigger
  payload?: Record<string, unknown>;
  link?:   string;   // optional link to open (e.g. tel:)
};

export type MessageAttachment = {
  type:     'image' | 'location' | 'road_card';
  url?:     string;
  lat?:     number;
  lng?:     number;
  label?:   string;
  roadId?:  string;
};

export type ChatMessage = {
  id:          string;
  role:        MessageRole;
  text:        string;           // plain-text or markdown-lite
  timestamp:   Date;
  inputMode:   InputMode;
  attachments?: MessageAttachment[];
  quickReplies?: QuickReply[];
  isStreaming?:  boolean;
  lang?:         string;          // BCP-47 language code for TTS
};

export type ConversationContext = {
  // What the user last asked about
  lastRoadId:       string | null;
  lastTab:          string | null;
  reportInProgress: boolean;
  reportDraft:      Record<string, unknown>;
  // For multi-turn follow-ups
  awaitingInput:    string | null;   // e.g. 'severity' | 'description' | null
  lang?:            string;          // User's selected language
};

export type TTSConfig = {
  enabled:  boolean;
  voice?:   SpeechSynthesisVoice | null;
  rate:     number;
  pitch:    number;
  volume:   number;
  lang:     string;
};

export type STTConfig = {
  enabled:    boolean;
  continuous: boolean;
  lang:       string;
};
