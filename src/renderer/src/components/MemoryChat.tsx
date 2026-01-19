import { useEffect, useRef, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

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

interface MemoryChatProps {
  appName: string;
}

export function MemoryChat({ appName }: MemoryChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [openContextId, setOpenContextId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const markdownComponents = {
    p: ({ children }: { children?: ReactNode }) => (
      <p style={{ margin: 0 }}>{children}</p>
    ),
    a: ({ href, children }: { href?: string; children?: ReactNode }) => (
      <a href={href} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
        {children}
      </a>
    ),
    code: ({ inline, children }: { inline?: boolean; children?: ReactNode }) => (
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
    ),
    pre: ({ children }: { children?: ReactNode }) => (
      <pre style={{ margin: 0 }}>{children}</pre>
    )
  };


  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const result = await window.api.ragChat(trimmed, appName);
      const assistantMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: result.answer || 'No response returned.',
        context: result.context
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (e) {
      console.error('RAG chat failed', e);
      setMessages(prev => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, something went wrong while generating a response.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Chat with your memories</h2>
          <p className="text-sm text-neutral-500">Ask questions about your saved conversations</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto rounded-2xl bg-neutral-900/50 backdrop-blur-sm border border-neutral-800 p-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-neutral-800 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <p className="text-neutral-400 text-lg font-medium mb-2">Start a conversation</p>
            <p className="text-neutral-600 text-sm max-w-md">
              Ask questions to search across your memories, chats, and entities from {appName === 'All' ? 'all sources' : appName}.
            </p>
          </div>
        ) : (
          messages.map(message => (
            <div key={message.id} className={`mb-4 flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                message.role === 'user' 
                  ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white' 
                  : 'bg-neutral-800 text-neutral-200'
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
                <div className="mt-2 p-3 rounded-xl bg-neutral-800/50 border border-neutral-700 text-sm max-w-[90%]">
                  <div className="font-medium text-neutral-300 mb-2">Context used</div>
                  {message.context.masterMemory ? (
                    <div className="mb-2 text-neutral-400">
                      <span className="font-medium">Master memory:</span> {message.context.masterMemory}
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-1 text-neutral-500 text-xs">
                    <div>Memories: {message.context.memories?.length || 0}</div>
                    <div>Messages: {message.context.messages?.length || 0}</div>
                    <div>Summaries: {message.context.summaries?.length || 0}</div>
                    <div>Entities: {message.context.entities?.length || 0}</div>
                  </div>
                </div>
              ) : null}
            </div>
          ))
        )}
        {loading ? (
          <div className="flex items-center gap-2 text-neutral-500">
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
            <span>Thinking…</span>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-3">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder={`Ask about your memories${appName && appName !== 'All' ? ` in ${appName}` : ''}...`}
          className="flex-1 resize-none px-4 py-3 rounded-xl bg-neutral-900/80 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-cyan-500 hover:to-indigo-500 transition-all"
        >
          Send
        </button>
      </div>
    </div>
  );
}
