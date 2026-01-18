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
        <div className="chat-list-container">
            {/* SEARCH BAR */}
            <div style={{ marginBottom: '15px' }}>
                <input
                    type="text"
                    placeholder="Search chats..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '8px',
                        border: '1px solid var(--ev-c-gray-3)',
                        background: 'var(--color-background-soft)',
                        color: 'var(--text-main)'
                    }}
                />
            </div>

            {loading && <div className="loading-spinner">Loading...</div>}

            <div className="sessions-list">
                {filteredSessions.map(session => (
                    <div
                        key={session.session_id}
                        className="memory-card clickable"
                        onClick={() => onSelectSession(session.session_id)}
                        style={{ cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.2s', position: 'relative' }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span className="source-tag" style={{ background: 'var(--primary)', color: 'white' }}>
                                {session.message_count} msgs
                            </span>
                            <span className="timestamp">{formatTime(session.last_activity)}</span>
                        </div>

                        <div style={{ fontWeight: 700, marginBottom: '8px', wordBreak: 'break-all', paddingRight: '20px' }}>
                            {session.session_id}
                        </div>

                        <button
                            onClick={(e) => handleDelete(e, session.session_id)}
                            style={{
                                position: 'absolute',
                                top: '10px',
                                right: '10px',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: '1.2rem'
                            }}
                            title="Delete"
                        >
                            ×
                        </button>

                        {session.summary && (
                            <div style={{ opacity: 0.8, fontSize: '0.9rem', background: '#334155', padding: '10px', borderRadius: '4px' }}>
                                <strong>Summary:</strong> {session.summary}
                            </div>
                        )}
                    </div>
                ))}

                {!loading && filteredSessions.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
                        No chats found.
                    </div>
                )}
            </div>
        </div>
    );
}
