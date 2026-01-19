import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Modal, ModalBody, ModalContent, ModalTrigger } from './ui/animated-modal';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from './ui/item';
import { BorderBeam } from './ui/border-beam';

interface ChatSession {
    session_id: string;
    last_activity: string;
    message_count: number;
    summary: string | null;
}

interface ChatListProps {
    appName: string;
    onSelectSession: (sessionId: string) => void;
}

interface ChatListItemProps {
    session: ChatSession;
    formattedTime: string;
    onSelect: (sessionId: string) => void;
    onDelete: (e: React.MouseEvent, sessionId: string) => void;
}

function ChatListItem({ session, formattedTime, onSelect, onDelete }: ChatListItemProps) {
    const firstDashIndex = session.session_id.indexOf('-');
    const modelName = firstDashIndex > 0 ? session.session_id.slice(0, firstDashIndex) : undefined;
    const chatTitleRaw = firstDashIndex > 0 ? session.session_id.slice(firstDashIndex + 1) : session.session_id;
    const chatTitle = chatTitleRaw.split('-').join(' ').toLowerCase();
    const readableTitle = chatTitle
        ? `${chatTitle.charAt(0).toUpperCase()}${chatTitle.slice(1)}`
        : session.session_id;
    const llmLabel = modelName ? modelName.replace(/[-_]/g, ' ') : 'LLM';
    const markdownComponents = {
        p: ({ children }: { children?: React.ReactNode }) => (
            <p className="mb-3 last:mb-0 text-neutral-200">{children}</p>
        ),
        a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-cyan-300 underline">
                {children}
            </a>
        ),
        code: ({ inline, children }: { inline?: boolean; children?: React.ReactNode }) => (
            <code
                className={
                    inline
                        ? "rounded bg-white/10 px-1.5 py-0.5 text-[0.85em]"
                        : "block whitespace-pre-wrap rounded-lg bg-white/10 p-3 text-[0.85em]"
                }
            >
                {children}
            </code>
        ),
        pre: ({ children }: { children?: React.ReactNode }) => (
            <pre className="mb-3 overflow-x-auto">{children}</pre>
        ),
        ul: ({ children }: { children?: React.ReactNode }) => (
            <ul className="mb-3 list-disc pl-6 text-neutral-200">{children}</ul>
        ),
        ol: ({ children }: { children?: React.ReactNode }) => (
            <ol className="mb-3 list-decimal pl-6 text-neutral-200">{children}</ol>
        ),
        li: ({ children }: { children?: React.ReactNode }) => (
            <li className="mb-1">{children}</li>
        ),
        strong: ({ children }: { children?: React.ReactNode }) => (
            <strong className="font-semibold text-white">{children}</strong>
        ),
        em: ({ children }: { children?: React.ReactNode }) => (
            <em className="text-neutral-300">{children}</em>
        ),
        blockquote: ({ children }: { children?: React.ReactNode }) => (
            <blockquote className="mb-3 border-l-2 border-neutral-700 pl-4 text-neutral-300">
                {children}
            </blockquote>
        ),
        h1: ({ children }: { children?: React.ReactNode }) => (
            <h1 className="mb-2 text-lg font-semibold text-white">{children}</h1>
        ),
        h2: ({ children }: { children?: React.ReactNode }) => (
            <h2 className="mb-2 text-base font-semibold text-white">{children}</h2>
        ),
        h3: ({ children }: { children?: React.ReactNode }) => (
            <h3 className="mb-2 text-sm font-semibold text-white">{children}</h3>
        ),
    };

    return (
        <Item
            variant="outline"
            className="group cursor-pointer hover:border-neutral-700"
            onClick={() => onSelect(session.session_id)}
        >
            <ItemContent>
                <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
                        {llmLabel}
                    </span>
                    <ItemTitle>{readableTitle}</ItemTitle>
                </div>
            </ItemContent>

            <ItemActions className="gap-3">
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                        {session.message_count} msgs
                    </span>
                    <span className="text-neutral-600">•</span>
                    <span>{formattedTime}</span>
                </div>

                <div className="flex items-center gap-2">
                    {session.summary && (
                        <div onClick={(e) => e.stopPropagation()}>
                            <Modal>
                                <ModalTrigger className="h-8 w-8 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white hover:border-neutral-700 p-0 flex items-center justify-center">
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.6"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="h-4 w-4"
                                    >
                                        <path d="M8 6h8" />
                                        <path d="M8 10h8" />
                                        <path d="M8 14h5" />
                                        <path d="M6 3h9l3 3v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
                                    </svg>
                                </ModalTrigger>
                                <ModalBody className="bg-neutral-950 border-neutral-800 max-h-[80vh]">
                                    <ModalContent className="p-6 text-neutral-200 overflow-y-auto">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-base font-semibold text-white">
                                                    {readableTitle} - Summary
                                                </div>
                                                <div className="mt-1 text-xs text-neutral-500">{llmLabel}</div>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    if (session.summary) {
                                                        await navigator.clipboard.writeText(session.summary);
                                                    }
                                                }}
                                                className="h-8 w-8 rounded-lg border border-neutral-700 bg-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600 transition-colors flex items-center justify-center"
                                                title="Copy to clipboard"
                                            >
                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                                                </svg>
                                            </button>
                                        </div>
                                        <div className="mt-4 border-t border-neutral-800 pt-4 text-sm leading-relaxed text-neutral-200">
                                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>
                                                {session.summary}
                                            </ReactMarkdown>
                                        </div>
                                        <div className="mt-5 text-xs text-neutral-500">{session.session_id}</div>
                                        <BorderBeam
                                            duration={4}
                                            size={400}
                                            borderWidth={2}
                                            className="from-transparent via-red-500 to-transparent"
                                        />
                                        <BorderBeam
                                            duration={4}
                                            delay={1}
                                            size={400}
                                            borderWidth={2}
                                            className="from-transparent via-blue-500 to-transparent"
                                        />
                                    </ModalContent>

                                </ModalBody>
                            </Modal>
                        </div>
                    )}

                    <button
                        onClick={(e) => onDelete(e, session.session_id)}
                        className="h-8 w-8 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-500 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/40 transition-all flex items-center justify-center"
                        title="Delete"
                    >
                        ×
                    </button>
                </div>
            </ItemActions>
        </Item>
    );
}

export function ChatList({ appName, onSelectSession }: ChatListProps) {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const fetchSessions = async () => {
        setLoading(true);
        try {
            const data = await window.api.getChatSessions(appName);
            setSessions(data);
        } catch (e) {
            console.error("Failed to fetch sessions", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, [appName]);

    const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this chat?")) return;

        try {
            await window.api.deleteSession(sessionId);
            setSessions(prev => prev.filter(s => s.session_id !== sessionId));
        } catch (e) {
            console.error("Failed to delete", e);
        }
    };

    // Filter sessions locally
    const filteredSessions = sessions.filter(s =>
        s.session_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.summary && s.summary.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const formatTime = (dateStr: string) => {
        // SQLite "YYYY-MM-DD HH:MM:SS" is UTC. Append 'Z' to treat as UTC.
        // But need to be careful if it already has one.
        // Or simpler: assume it is UTC and create Date.
        // Note: ' ' space in SQL string needs to be T for ISO sometimes.
        const iso = dateStr.replace(' ', 'T') + 'Z';
        return new Date(iso).toLocaleString().substring(0, 16) + ' ' + new Date(iso).toLocaleString().substring(20, 22);
    };

    return (
        <div className="h-full flex flex-col gap-4">
            {/* Search Bar */}
            <div>
                <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search chats..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-neutral-900/80 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                    />
                </div>
            </div>

            {loading && (
                <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                </div>
            )}

            <div className="flex-1 overflow-y-auto">
                <ItemGroup>
                    {filteredSessions.map(session => (
                        <ChatListItem
                            key={session.session_id}
                            session={session}
                            formattedTime={formatTime(session.last_activity)}
                            onSelect={onSelectSession}
                            onDelete={handleDelete}
                        />
                    ))}
                </ItemGroup>

                {!loading && filteredSessions.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-neutral-800 flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <p className="text-neutral-500">No chats found</p>
                    </div>
                )}
            </div>
        </div>
    );
}
