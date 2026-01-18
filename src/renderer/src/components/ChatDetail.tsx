import { useEffect, useState } from 'react';

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
        <div className="chat-detail-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="header" style={{
                padding: '10px',
                borderBottom: '1px solid var(--ev-c-gray-3)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
            }}>
                <button onClick={onBack} className="btn">← Back</button>
                <div style={{ fontWeight: 700 }}>{sessionId}</div>
            </div>

            <div className="messages-area" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                {loading && <div>Loading conversation...</div>}

                {messages.map((msg, idx) => (
                    <div key={idx} style={{
                        marginBottom: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
                    }}>
                        <div style={{
                            fontSize: '0.8rem',
                            marginBottom: '4px',
                            opacity: 0.6,
                            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start'
                        }}>
                            {msg.role ? msg.role.toUpperCase() : 'UNKNOWN'}
                        </div>
                        <div style={{
                            background: msg.role === 'user' ? 'var(--primary)' : 'var(--color-background-mute)',
                            color: msg.role === 'user' ? '#fff' : 'var(--text-main)',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            maxWidth: '80%',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                        }}>
                            {msg.content}
                        </div>
                    </div>
                ))}

                {messages.length === 0 && !loading && (
                    <div style={{ opacity: 0.5 }}>No content available.</div>
                )}
            </div>
        </div>
    );
}
