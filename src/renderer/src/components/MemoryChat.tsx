import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { motion, AnimatePresence } from 'motion/react';
import { ProgressiveBlur } from './ui/progressive-blur';

type RagContext = {
  masterMemory?: string | null;
  memories?: any[];
  messages?: any[];
  summaries?: any[];
  entities?: any[];
  entityFacts?: any[];
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  context?: RagContext;
};

type Conversation = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count?: number;
};

interface MemoryChatProps {
  onNavigateToMemory?: (memoryId: number) => void;
  onNavigateToChat?: (sessionId: string) => void;
  onNavigateToEntity?: (entityId: number) => void;
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr + 'Z');
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function MemoryChat({ onNavigateToMemory, onNavigateToChat, onNavigateToEntity }: MemoryChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [openContextId, setOpenContextId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(true);
  const [hoveredConvId, setHoveredConvId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const markdownComponents: Components = {
    p: ({ children }) => (
      <p style={{ margin: 0 }}>{children}</p>
    ),
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
        {children}
      </a>
    ),
    code: ({ children, ...props }) => {
      const inline = !('className' in props);
      return (
        <code
          style={{
            background: 'rgba(255,255,255,0.08)',
            padding: inline ? '2px 4px' : '8px 10px',
            borderRadius: '6px',
            display: inline ? 'inline' : 'block',
            fontFamily: 'ui-monospace, SFMono-Regular, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: '0.9em',
            overflowX: 'auto'
          }}
        >
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre style={{ margin: 0 }}>{children}</pre>
    )
  };

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const loadConversations = async () => {
    try {
      const convos = await window.api.getRagConversations();
      setConversations(convos || []);
    } catch (e) {
      console.error('Failed to load conversations:', e);
    }
  };

  const switchConversation = useCallback(async (convId: string) => {
    if (convId === activeConversationId) return;
    setActiveConversationId(convId);
    setOpenContextId(null);
    try {
      const rawMessages = await window.api.getRagMessages(convId);
      const mapped: ChatMessage[] = (rawMessages || []).map((m: any) => ({
        id: String(m.id),
        role: m.role as 'user' | 'assistant',
        content: m.content,
        context: m.context ? (typeof m.context === 'string' ? JSON.parse(m.context) : m.context) : undefined,
      }));
      setMessages(mapped);
    } catch (e) {
      console.error('Failed to load messages:', e);
      setMessages([]);
    }
  }, [activeConversationId]);

  const startNewConversation = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
    setOpenContextId(null);
  }, []);

  const deleteConversation = useCallback(async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await window.api.deleteRagConversation(convId);
      if (activeConversationId === convId) {
        setActiveConversationId(null);
        setMessages([]);
      }
      await loadConversations();
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  }, [activeConversationId]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    let convId = activeConversationId;

    // Create new conversation if none active
    if (!convId) {
      convId = `rag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const title = trimmed.length > 50 ? trimmed.slice(0, 47) + '...' : trimmed;
      try {
        await window.api.createRagConversation(convId, title);
        setActiveConversationId(convId);
      } catch (e) {
        console.error('Failed to create conversation:', e);
        return;
      }
    }

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Persist user message
    try {
      await window.api.addRagMessage(convId, 'user', trimmed);
    } catch (e) {
      console.error('Failed to persist user message:', e);
    }

    try {
      // Build conversation history from current messages (last 20)
      const currentMessages = [...messages, userMessage];
      const historySlice = currentMessages.slice(-20);
      const history = historySlice.map(m => ({ role: m.role, content: m.content }));

      const result = await window.api.ragChat(trimmed, 'All', history);
      const assistantContent = result.answer || 'No response returned.';
      const assistantMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: assistantContent,
        context: result.context
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Persist assistant message with context
      try {
        await window.api.addRagMessage(convId, 'assistant', assistantContent, result.context);
      } catch (e) {
        console.error('Failed to persist assistant message:', e);
      }
    } catch (e) {
      console.error('RAG chat failed', e);
      const errorContent = 'Sorry, something went wrong while generating a response.';
      setMessages(prev => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: errorContent
        }
      ]);
      try {
        await window.api.addRagMessage(convId, 'assistant', errorContent);
      } catch (_) { /* ignore */ }
    } finally {
      setLoading(false);
      await loadConversations();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <motion.div
      className="flex flex-col h-full gap-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Header */}
      <motion.div
        className="flex items-center gap-3"
        initial={{ opacity: 0, filter: 'blur(10px)' }}
        animate={{ opacity: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <div className="h-10 w-10 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center">
          <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-white">Chat with your memories</h2>
          <p className="text-sm text-neutral-500">Ask questions about your saved conversations</p>
        </div>
        <button
          onClick={() => setShowHistory(prev => !prev)}
          className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          title={showHistory ? 'Hide history' : 'Show history'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </motion.div>

      {/* Two-panel layout */}
      <motion.div
        className="flex-1 flex gap-3 overflow-hidden"
        initial={{ opacity: 0, filter: 'blur(10px)' }}
        animate={{ opacity: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        {/* Conversation List (left panel) */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 288, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="flex-shrink-0 overflow-hidden rounded-2xl bg-neutral-900/60 backdrop-blur-sm border border-neutral-800 flex flex-col"
            >
              {/* New conversation button */}
              <div className="p-3 border-b border-neutral-800">
                <button
                  onClick={startNewConversation}
                  className="w-full py-2 px-3 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-sm font-medium hover:bg-neutral-700 hover:border-neutral-600 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New chat
                </button>
              </div>

              {/* Conversation list */}
              <div className="flex-1 overflow-y-auto relative" ref={listRef}>
                {conversations.length === 0 ? (
                  <div className="p-4 text-center text-neutral-600 text-sm">
                    No conversations yet
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {conversations.map((conv, index) => (
                      <motion.button
                        key={conv.id}
                        onClick={() => switchConversation(conv.id)}
                        onMouseEnter={() => setHoveredConvId(conv.id)}
                        onMouseLeave={() => setHoveredConvId(null)}
                        initial={{ opacity: 0, filter: 'blur(6px)' }}
                        animate={{ opacity: 1, filter: 'blur(0px)' }}
                        transition={{ duration: 0.3, delay: index * 0.03 }}
                        className={`w-full text-left p-3 rounded-xl transition-colors relative group ${
                          activeConversationId === conv.id
                            ? 'bg-neutral-800 border border-neutral-700'
                            : 'hover:bg-neutral-800/50 border border-transparent'
                        }`}
                      >
                        <p className="text-sm text-neutral-300 truncate pr-6">
                          {conv.title || 'Untitled'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-neutral-600">{timeAgo(conv.updated_at)}</span>
                          {conv.message_count != null && conv.message_count > 0 && (
                            <span className="text-[10px] text-neutral-500 bg-neutral-800 px-1.5 py-0.5 rounded-full">
                              {conv.message_count}
                            </span>
                          )}
                        </div>
                        {/* Delete button */}
                        {hoveredConvId === conv.id && (
                          <button
                            onClick={(e) => deleteConversation(conv.id, e)}
                            className="absolute top-3 right-2 p-1 rounded-md text-neutral-600 hover:text-red-400 hover:bg-neutral-700/50 transition-colors"
                            title="Delete conversation"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </motion.button>
                    ))}
                  </div>
                )}
                <ProgressiveBlur
                  className="pointer-events-none sticky bottom-0 left-0 right-0 h-12"
                  height="48px"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat area (right panel) */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="flex-1 overflow-hidden rounded-2xl bg-neutral-900/60 backdrop-blur-sm border border-neutral-800 relative">
            <div className="absolute inset-0 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <div className="w-16 h-16 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <p className="text-neutral-400 text-lg font-medium mb-2">Start a conversation</p>
                  <p className="text-neutral-600 text-sm max-w-md">
                    Ask questions to search across your memories, chats, and entities from all sources.
                  </p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <motion.div
                    key={message.id}
                    className={`mb-4 flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${message.role === 'user'
                        ? 'bg-neutral-700 border border-neutral-600 text-white'
                        : 'bg-neutral-800/80 border border-neutral-700 text-neutral-200'
                      }`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>
                        {message.content}
                      </ReactMarkdown>
                    </div>

                    {message.role === 'assistant' && message.context ? (
                      <button
                        onClick={() => setOpenContextId(openContextId === message.id ? null : message.id)}
                        className="mt-2 text-xs text-neutral-500 hover:text-neutral-400 transition-colors"
                      >
                        {openContextId === message.id ? 'Hide context' : 'Show context'}
                      </button>
                    ) : null}

                    {message.role === 'assistant' && message.context && openContextId === message.id ? (
                      <motion.div
                        className="mt-2 p-4 rounded-xl bg-neutral-800/50 border border-neutral-700 text-sm max-w-[90%] max-h-[400px] overflow-y-auto"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="font-medium text-neutral-300 mb-3">Context used</div>

                        {message.context.masterMemory ? (
                          <div className="mb-4 p-3 rounded-lg bg-neutral-900/50 border border-neutral-700">
                            <div className="text-xs text-neutral-500 uppercase tracking-wide mb-2">Master Memory</div>
                            <div className="text-neutral-300 prose prose-sm prose-invert max-w-none">
                              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>
                                {message.context.masterMemory}
                              </ReactMarkdown>
                            </div>
                          </div>
                        ) : null}

                        {/* Clickable Memories */}
                        {message.context.memories && message.context.memories.length > 0 ? (
                          <div className="mb-3">
                            <div className="text-xs text-neutral-500 uppercase tracking-wide mb-2">Memories ({message.context.memories.length})</div>
                            <div className="space-y-1">
                              {message.context.memories.slice(0, 5).map((memory: any, idx: number) => (
                                <button
                                  key={memory.id || idx}
                                  onClick={() => onNavigateToMemory?.(memory.id)}
                                  className="w-full text-left p-2 rounded-lg bg-neutral-800/30 hover:bg-neutral-700/50 border border-neutral-700/50 hover:border-neutral-600 transition-colors group"
                                >
                                  <p className="text-xs text-neutral-400 group-hover:text-neutral-300 line-clamp-2">
                                    {memory.content || memory.text || 'Memory'}
                                  </p>
                                </button>
                              ))}
                              {message.context.memories.length > 5 && (
                                <button
                                  onClick={() => onNavigateToMemory?.(message.context?.memories?.[0]?.id)}
                                  className="text-xs text-neutral-500 hover:text-neutral-400 transition-colors"
                                >
                                  +{message.context.memories.length - 5} more memories
                                </button>
                              )}
                            </div>
                          </div>
                        ) : null}

                        {/* Clickable Summaries (Chats) */}
                        {message.context.summaries && message.context.summaries.length > 0 ? (
                          <div className="mb-3">
                            <div className="text-xs text-neutral-500 uppercase tracking-wide mb-2">Related Chats ({message.context.summaries.length})</div>
                            <div className="space-y-1">
                              {message.context.summaries.slice(0, 5).map((summary: any, idx: number) => (
                                <button
                                  key={summary.session_id || idx}
                                  onClick={() => onNavigateToChat?.(summary.session_id)}
                                  className="w-full text-left p-2 rounded-lg bg-neutral-800/30 hover:bg-neutral-700/50 border border-neutral-700/50 hover:border-neutral-600 transition-colors group"
                                >
                                  <p className="text-xs text-neutral-400 group-hover:text-neutral-300 line-clamp-2">
                                    {summary.summary || summary.title || 'Chat conversation'}
                                  </p>
                                  {summary.app_name && (
                                    <span className="text-[10px] text-neutral-600 mt-1 inline-block">{summary.app_name}</span>
                                  )}
                                </button>
                              ))}
                              {message.context.summaries.length > 5 && (
                                <button
                                  onClick={() => onNavigateToChat?.(message.context?.summaries?.[0]?.session_id)}
                                  className="text-xs text-neutral-500 hover:text-neutral-400 transition-colors"
                                >
                                  +{message.context.summaries.length - 5} more chats
                                </button>
                              )}
                            </div>
                          </div>
                        ) : null}

                        {/* Clickable Entities */}
                        {message.context.entities && message.context.entities.length > 0 ? (
                          <div className="mb-3">
                            <div className="text-xs text-neutral-500 uppercase tracking-wide mb-2">Entities ({message.context.entities.length})</div>
                            <div className="flex flex-wrap gap-1">
                              {message.context.entities.slice(0, 10).map((entity: any, idx: number) => (
                                <button
                                  key={entity.id || idx}
                                  onClick={() => onNavigateToEntity?.(entity.id)}
                                  className="px-2 py-1 rounded-md bg-neutral-800/50 hover:bg-neutral-700/50 border border-neutral-700/50 hover:border-neutral-600 transition-colors text-xs text-neutral-400 hover:text-neutral-300"
                                >
                                  {entity.name || 'Entity'}
                                  {entity.type && <span className="text-neutral-600 ml-1">({entity.type})</span>}
                                </button>
                              ))}
                              {message.context.entities.length > 10 && (
                                <span className="text-xs text-neutral-500 px-2 py-1">
                                  +{message.context.entities.length - 10} more
                                </span>
                              )}
                            </div>
                          </div>
                        ) : null}

                        {/* Entity Facts */}
                        {message.context.entityFacts && message.context.entityFacts.length > 0 ? (
                          <div>
                            <div className="text-xs text-neutral-500 uppercase tracking-wide mb-2">Entity Facts ({message.context.entityFacts.length})</div>
                            <div className="space-y-1">
                              {message.context.entityFacts.slice(0, 5).map((fact: any, idx: number) => (
                                <div key={idx} className="p-2 rounded-lg bg-neutral-800/30 border border-neutral-700/50">
                                  <p className="text-xs text-neutral-400 line-clamp-2">{fact.fact || fact}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </motion.div>
                    ) : null}
                  </motion.div>
                ))
              )}
              {loading ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 mb-4"
                >
                  <div className="max-w-[80%] px-4 py-3 rounded-2xl bg-neutral-800/80 border border-neutral-700">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <motion.div
                          className="w-2 h-2 bg-neutral-400 rounded-full"
                          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                        />
                        <motion.div
                          className="w-2 h-2 bg-neutral-400 rounded-full"
                          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                        />
                        <motion.div
                          className="w-2 h-2 bg-neutral-400 rounded-full"
                          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                        />
                      </div>
                      <span className="text-sm text-neutral-400">Searching your memories...</span>
                    </div>
                    <div className="mt-3 h-0.5 bg-neutral-700/50 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-neutral-600 via-neutral-500 to-neutral-600"
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        style={{ width: '50%' }}
                      />
                    </div>
                  </div>
                </motion.div>
              ) : null}
              <div ref={bottomRef} className="h-4" />
            </div>
          </div>

          {/* Input area */}
          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Ask about your memories..."
              className="flex-1 resize-none px-4 py-3 rounded-xl bg-neutral-900/80 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="px-6 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-700 hover:border-neutral-600 transition-all"
            >
              Send
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
