import { useEffect, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

interface Message {
    id: number;
    conversation_id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
}

interface ChatDetailProps {
    sessionId: string;
    onBack: () => void;
}

export function ChatDetail({ sessionId, onBack }: ChatDetailProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);

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
        const fetchDetails = async () => {
            setLoading(true);
            try {
                // Fetch structured messages directly from the new table
                const data = await window.api.getMemoriesForSession(sessionId);
                setMessages(data);
            } catch (e) {
                console.error("Failed to load chat details", e);
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [sessionId]);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-6 py-4 border-b border-neutral-800 flex items-center gap-4 bg-neutral-900/50 backdrop-blur-xl">
                <button 
                    onClick={onBack} 
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors text-sm"
                >
                    ← Back
                </button>
                <div className="font-medium text-white truncate">{sessionId}</div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6">
                {loading && (
                    <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`mb-6 flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className="text-xs text-neutral-500 mb-1">
                            {msg.role ? msg.role.toUpperCase() : 'UNKNOWN'}
                        </div>
                        <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                            msg.role === 'user' 
                                ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white' 
                                : 'bg-neutral-800 text-neutral-200'
                        }`}>
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>
                                {msg.content}
                            </ReactMarkdown>
                        </div>
                    </div>
                ))}

                {messages.length === 0 && !loading && (
                    <div className="text-center text-neutral-500 py-8">No content available.</div>
                )}
            </div>
        </div>
    );
}
