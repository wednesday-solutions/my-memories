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
    p: ({ children }: { children: ReactNode }) => (
      <p style={{ margin: 0 }}>{children}</p>
    ),
    a: ({ href, children }: { href?: string; children: ReactNode }) => (
      <a href={href} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
        {children}
      </a>
    ),
    code: ({ inline, children }: { inline?: boolean; children: ReactNode }) => (
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
    pre: ({ children }: { children: ReactNode }) => (
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
      <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>Chat with your memories</div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        background: 'rgba(0,0,0,0.2)',
        border: '1px solid var(--ev-c-gray-3)',
        borderRadius: '12px',
        padding: '16px'
      }}>
        {messages.length === 0 ? (
          <div style={{ opacity: 0.7 }}>Ask a question to search across your memories, chats, and entities.</div>
        ) : (
          messages.map(message => (
            <div key={message.id} style={{
              marginBottom: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: message.role === 'user' ? 'flex-end' : 'flex-start'
            }}>
              <div style={{
                maxWidth: '80%',
                padding: '12px 14px',
                borderRadius: '12px',
                background: message.role === 'user' ? 'var(--primary)' : 'var(--ev-c-black-soft)',
                color: message.role === 'user' ? '#fff' : 'var(--text-main)',
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                lineHeight: 1.5
              }}>
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>
                  {message.content}
                </ReactMarkdown>
              </div>

              {message.role === 'assistant' && message.context ? (
                <button
                  className="btn"
                  onClick={() => setOpenContextId(openContextId === message.id ? null : message.id)}
                  style={{
                    marginTop: '6px',
                    fontSize: '0.85rem',
                    opacity: 0.7,
                    padding: '4px 10px'
                  }}
                >
                  {openContextId === message.id ? 'Hide context' : 'Show context'}
                </button>
              ) : null}

              {message.role === 'assistant' && message.context && openContextId === message.id ? (
                <div style={{
                  marginTop: '8px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--ev-c-gray-3)',
                  fontSize: '0.85rem',
                  maxWidth: '90%'
                }}>
                  <div style={{ marginBottom: '6px', fontWeight: 600 }}>Context used</div>
                  {message.context.masterMemory ? (
                    <div style={{ marginBottom: '8px', opacity: 0.8 }}>
                      <div style={{ fontWeight: 600 }}>Master memory</div>
                      <div>{message.context.masterMemory}</div>
                    </div>
                  ) : null}
                  <div style={{ display: 'grid', gap: '6px' }}>
                    <div>Memories: {message.context.memories?.length || 0}</div>
                    <div>Messages: {message.context.messages?.length || 0}</div>
                    <div>Summaries: {message.context.summaries?.length || 0}</div>
                    <div>Entities: {message.context.entities?.length || 0}</div>
                    <div>Entity facts: {message.context.entityFacts?.length || 0}</div>
                  </div>
                </div>
              ) : null}
            </div>
          ))
        )}
        {loading ? (
          <div style={{ opacity: 0.7 }}>Thinking…</div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder={`Ask about your memories${appName && appName !== 'All' ? ` in ${appName}` : ''}...`}
          style={{
            flex: 1,
            resize: 'none',
            padding: '10px 12px',
            borderRadius: '10px',
            border: '1px solid var(--ev-c-gray-3)',
            background: 'var(--ev-c-black-soft)',
            color: 'var(--text-main)'
          }}
        />
        <button
          className="btn"
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{
            padding: '10px 16px',
            borderRadius: '10px',
            background: 'var(--primary)',
            color: '#fff',
            opacity: loading || !input.trim() ? 0.5 : 1
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
