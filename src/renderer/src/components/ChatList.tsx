import { useEffect, useState } from 'react';

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
        return new Date(iso).toLocaleString();
    };

    return (
        <div className="h-full flex flex-col">
            {/* Search Bar */}
            <div className="mb-4">
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

            <div className="flex-1 overflow-y-auto space-y-3">
                {filteredSessions.map(session => (
                    <div
                        key={session.session_id}
                        onClick={() => onSelectSession(session.session_id)}
                        className="group relative p-4 rounded-xl bg-neutral-900/50 border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/80 cursor-pointer transition-all"
                    >
                        <div className="flex items-start justify-between mb-2">
                            <span className="px-2 py-1 text-xs font-medium rounded-lg bg-cyan-500/20 text-cyan-400">
                                {session.message_count} msgs
                            </span>
                            <span className="text-xs text-neutral-500">{formatTime(session.last_activity)}</span>
                        </div>

                        <div className="font-medium text-white mb-2 pr-8 break-all">
                            {session.session_id}
                        </div>

                        <button
                            onClick={(e) => handleDelete(e, session.session_id)}
                            className="absolute top-4 right-4 w-6 h-6 rounded-lg bg-neutral-800 text-neutral-500 hover:bg-red-500/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
                            title="Delete"
                        >
                            ×
                        </button>

                        {session.summary && (
                            <div className="mt-2 p-3 rounded-lg bg-neutral-800/50 text-sm text-neutral-400">
                                <span className="font-medium text-neutral-300">Summary:</span> {session.summary}
                            </div>
                        )}
                    </div>
                ))}

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
