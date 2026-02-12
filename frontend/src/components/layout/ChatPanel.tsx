import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listConversations, createConversation, listMessages } from '../../api/drive';
import { useChatStore } from '../../stores/chatStore';
import type { ToolCallInfo } from '../../stores/chatStore';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import type { ChatMessage } from '../../lib/types';
import {
  Send, X, Sparkles, Loader2, Bot, User, Key, WifiOff, Check, FileText,
  Square, Paperclip, MessageSquare, ChevronLeft, XCircle,
} from 'lucide-react';
import ApiKeyDialog from '../ApiKeyDialog';

interface Attachment {
  type: 'image';
  name: string;
  media_type: string;
  data: string;  // base64
  preview: string;  // data URL for display
}

interface Props {
  send: (data: Record<string, unknown>) => void;
  connected: boolean;
  userName: string;
  userId: string;
}

export default function ChatPanel({ send, connected, userName, userId }: Props) {
  const [input, setInput] = useState('');
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { setChatPanelOpen } = useUIStore();
  const { user } = useAuthStore();
  const {
    messages,
    streamingContent,
    isAgentTyping,
    toolHistory,
    pendingPrompt,
    addMessage,
    setMessages,
    setAgentTyping,
    clearMessages,
    setPendingPrompt,
  } = useChatStore();

  // Load conversations
  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => listConversations(),
  });

  // Auto-select or create first conversation
  useEffect(() => {
    if (conversations && conversations.length > 0 && !activeConvoId) {
      setActiveConvoId(conversations[0].id);
    }
  }, [conversations, activeConvoId]);

  // Load messages when conversation changes
  const { data: savedMessages } = useQuery({
    queryKey: ['messages', activeConvoId],
    queryFn: () => listMessages(activeConvoId!),
    enabled: !!activeConvoId,
  });

  useEffect(() => {
    if (savedMessages) {
      setMessages(
        savedMessages.map((m) => ({
          id: m.id,
          conversation_id: m.conversation_id,
          sender_type: m.sender_type,
          sender_id: m.sender_id,
          content: m.content,
          created_at: m.created_at,
        }))
      );
    }
  }, [savedMessages, setMessages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, toolHistory]);

  // Auto-send pending prompt (e.g. from "Custom view with AI")
  useEffect(() => {
    if (pendingPrompt && activeConvoId && connected && !isAgentTyping) {
      const prompt = pendingPrompt;
      setPendingPrompt(null);

      addMessage({
        conversation_id: activeConvoId,
        sender_type: 'user',
        sender_id: userId,
        sender_name: userName,
        content: prompt,
        created_at: new Date().toISOString(),
      });
      setAgentTyping(true);
      send({ type: 'agent.invoke', payload: { conversation_id: activeConvoId, message: prompt } });
    }
  }, [pendingPrompt, activeConvoId, connected, isAgentTyping, setPendingPrompt, addMessage, setAgentTyping, send, userId, userName]);

  const createConvoMutation = useMutation({
    mutationFn: () => createConversation('New chat'),
    onSuccess: (convo) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setActiveConvoId(convo.id);
      clearMessages();
      setShowHistory(false);
    },
  });

  function switchConversation(id: string) {
    if (id === activeConvoId) return;
    setActiveConvoId(id);
    clearMessages();
    setShowHistory(false);
  }

  function handleSend() {
    if (!input.trim() || !activeConvoId || isAgentTyping) return;

    const content = input.trim();
    setInput('');

    addMessage({
      conversation_id: activeConvoId,
      sender_type: 'user',
      sender_id: userId,
      sender_name: userName,
      content,
      created_at: new Date().toISOString(),
    });

    setAgentTyping(true);

    const payload: Record<string, unknown> = {
      conversation_id: activeConvoId,
      message: content,
    };
    if (attachments.length > 0) {
      payload.attachments = attachments.map((a) => ({
        type: a.type,
        name: a.name,
        media_type: a.media_type,
        data: a.data,
      }));
    }
    send({ type: 'agent.invoke', payload });
    setAttachments([]);
  }

  function handleStop() {
    if (!activeConvoId) return;
    send({
      type: 'agent.stop',
      payload: { conversation_id: activeConvoId },
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1];
        setAttachments((prev) => [
          ...prev,
          {
            type: 'image',
            name: file.name,
            media_type: file.type,
            data: base64,
            preview: dataUrl,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Conversation history view ──
  if (showHistory) {
    return (
      <div className="h-full flex flex-col bg-white border-l border-gray-200">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <button
            type="button"
            onClick={() => setShowHistory(false)}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
            title="Back to chat"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-gray-900">Chat History</span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => createConvoMutation.mutate()}
            className="text-xs px-2.5 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations && conversations.length > 0 ? (
            <div className="p-2 space-y-0.5">
              {conversations.map((convo) => (
                <button
                  key={convo.id}
                  type="button"
                  onClick={() => switchConversation(convo.id)}
                  className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition ${
                    convo.id === activeConvoId
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <MessageSquare size={14} className="shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{convo.title || 'New chat'}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(convo.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-gray-400">
              No conversations yet
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Main chat view ──
  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-indigo-500" />
          <span className="text-sm font-semibold text-gray-900">AI Chat</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowApiKey(true)}
            className={`p-1.5 rounded transition ${
              user?.has_api_key
                ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                : 'text-amber-500 hover:bg-amber-50'
            }`}
            title={user?.has_api_key ? 'API Key' : 'Add API Key'}
          >
            <Key size={14} />
          </button>
          <button
            type="button"
            onClick={() => setShowHistory(true)}
            className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
            title="Chat history"
          >
            <MessageSquare size={14} />
          </button>
          <button
            type="button"
            onClick={() => createConvoMutation.mutate()}
            className="text-xs px-2 py-1 text-indigo-600 hover:bg-indigo-50 rounded transition"
          >
            New
          </button>
          <button
            type="button"
            onClick={() => setChatPanelOpen(false)}
            className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
            title="Close chat"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* API key banner */}
      {!user?.has_api_key && (
        <button
          type="button"
          onClick={() => setShowApiKey(true)}
          className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 hover:bg-amber-100 transition"
        >
          <Key size={14} />
          Add your Anthropic API key to enable AI chat
        </button>
      )}

      {/* Disconnected banner */}
      {!connected && (
        <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <WifiOff size={14} />
          Disconnected. Reconnecting...
        </div>
      )}

      {/* No conversation state */}
      {!activeConvoId ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <Sparkles size={32} className="mx-auto text-indigo-300 mb-3" />
            <p className="text-gray-500 text-sm mb-4">Start a conversation with AI</p>
            <button
              type="button"
              onClick={() => createConvoMutation.mutate()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              New chat
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !isAgentTyping && (
              <div className="text-center py-12">
                <Bot size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-400 text-sm">
                  Ask me to create files, write code, or help with your project.
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <MessageBubble key={msg.id || i} message={msg} />
            ))}

            {/* Agent working area */}
            {isAgentTyping && (
              <div className="flex gap-3">
                <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={14} className="text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  {streamingContent && (
                    <div className="bg-gray-50 rounded-xl px-4 py-3">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {streamingContent}
                        <span className="inline-block w-1.5 h-4 bg-indigo-400 ml-0.5 animate-pulse" />
                      </p>
                    </div>
                  )}
                  {toolHistory.length > 0 && (
                    <ToolProgress tools={toolHistory} />
                  )}
                  {!streamingContent && toolHistory.length === 0 && (
                    <div className="flex items-center gap-2 text-gray-400 text-sm py-1">
                      <Loader2 size={14} className="animate-spin" />
                      Thinking...
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Attachment previews */}
          {attachments.length > 0 && (
            <div className="px-4 pt-2 flex gap-2 flex-wrap">
              {attachments.map((att, i) => (
                <div key={i} className="relative group">
                  <img
                    src={att.preview}
                    alt={att.name}
                    className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    className="absolute -top-1.5 -right-1.5 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition"
                    title="Remove attachment"
                  >
                    <XCircle size={16} className="text-gray-400 hover:text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-gray-100">
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                title="Select images"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isAgentTyping}
                className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
                title="Attach image"
              >
                <Paperclip size={16} />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask AI to create files, write code..."
                rows={1}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm resize-none"
                disabled={isAgentTyping || !connected}
              />
              {isAgentTyping ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="px-3 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                  title="Stop"
                >
                  <Square size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim() || !connected}
                  className="px-3 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Send"
                >
                  <Send size={16} />
                </button>
              )}
            </div>
          </div>
        </>
      )}
      <ApiKeyDialog open={showApiKey} onClose={() => setShowApiKey(false)} />
    </div>
  );
}

function ToolProgress({ tools }: { tools: ToolCallInfo[] }) {
  return (
    <div className="space-y-1">
      {tools.map((tc, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
            tc.status === 'completed'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-amber-50 text-amber-700'
          }`}
        >
          {tc.status === 'started' ? (
            <Loader2 size={12} className="animate-spin shrink-0" />
          ) : (
            <Check size={12} className="shrink-0" />
          )}
          <FileText size={12} className="shrink-0" />
          <span className="truncate">{tc.label}</span>
        </div>
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.sender_type === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
          isUser ? 'bg-gray-200' : 'bg-indigo-100'
        }`}
      >
        {isUser ? (
          <User size={14} className="text-gray-600" />
        ) : (
          <Bot size={14} className="text-indigo-600" />
        )}
      </div>
      <div
        className={`rounded-xl px-4 py-3 max-w-[85%] ${
          isUser ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-800'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}
