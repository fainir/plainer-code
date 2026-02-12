import { create } from 'zustand';
import type { ChatMessage } from '../lib/types';

export interface ToolCallInfo {
  toolName: string;
  label: string;
  status: 'started' | 'completed';
  result?: string;
}

interface ChatState {
  messages: ChatMessage[];
  isAgentTyping: boolean;
  streamingContent: string;
  activeToolCall: string | null;
  toolHistory: ToolCallInfo[];
  pendingPrompt: string | null;

  addMessage: (msg: ChatMessage) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  appendStreamDelta: (delta: string) => void;
  finalizeStream: (content: string, conversationId?: string) => void;
  setAgentTyping: (typing: boolean) => void;
  setActiveToolCall: (tool: string | null) => void;
  addToolCall: (info: ToolCallInfo) => void;
  updateToolCall: (toolName: string, label: string, status: 'completed', result?: string) => void;
  clearMessages: () => void;
  setPendingPrompt: (prompt: string | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isAgentTyping: false,
  streamingContent: '',
  activeToolCall: null,
  toolHistory: [],
  pendingPrompt: null,

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),

  setMessages: (msgs) => set({ messages: msgs }),

  appendStreamDelta: (delta) =>
    set((state) => ({
      streamingContent: state.streamingContent + delta,
      isAgentTyping: true,
    })),

  finalizeStream: (content, conversationId) =>
    set((state) => ({
      streamingContent: '',
      isAgentTyping: false,
      activeToolCall: null,
      toolHistory: [],
      messages: [
        ...state.messages,
        {
          conversation_id: conversationId || '',
          sender_type: 'assistant' as const,
          sender_id: null,
          content,
          created_at: new Date().toISOString(),
        },
      ],
    })),

  setAgentTyping: (typing) => set({ isAgentTyping: typing }),
  setActiveToolCall: (tool) => set({ activeToolCall: tool }),

  addToolCall: (info) =>
    set((state) => ({
      activeToolCall: info.toolName,
      toolHistory: [...state.toolHistory, info],
    })),

  updateToolCall: (_toolName, label, _status, result) =>
    set((state) => ({
      activeToolCall: null,
      toolHistory: state.toolHistory.map((tc) =>
        tc.label === label && tc.status === 'started'
          ? { ...tc, status: 'completed' as const, result }
          : tc
      ),
    })),

  clearMessages: () =>
    set({ messages: [], streamingContent: '', isAgentTyping: false, activeToolCall: null, toolHistory: [] }),

  setPendingPrompt: (prompt) => set({ pendingPrompt: prompt }),
}));
