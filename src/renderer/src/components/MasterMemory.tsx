import { useEffect, useState } from 'react';

interface MasterMemoryData {
    content: string | null;
    updated_at: string | null;
}

export function MasterMemory() {
    const [masterMemory, setMasterMemory] = useState<MasterMemoryData>({ content: null, updated_at: null });
    const [loading, setLoading] = useState(false);
    const [regenerating, setRegenerating] = useState(false);

    const fetchMasterMemory = async () => {
        setLoading(true);
        try {
            const data = await window.api.getMasterMemory();
            setMasterMemory(data);
        } catch (e) {
            console.error("Failed to fetch master memory", e);
        } finally {
            setLoading(false);
        }
    };

    const handleRegenerate = async () => {
        setRegenerating(true);
        try {
            const newContent = await window.api.regenerateMasterMemory();
            if (newContent) {
                setMasterMemory({ content: newContent, updated_at: new Date().toISOString() });
            }
        } catch (e) {
            console.error("Failed to regenerate master memory", e);
        } finally {
            setRegenerating(false);
        }
    };

    useEffect(() => {
        fetchMasterMemory();
    }, []);

    const formatTime = (dateStr: string | null) => {
        if (!dateStr) return 'Never';
        const iso = dateStr.replace(' ', 'T') + 'Z';
        return new Date(iso).toLocaleString();
    };

    return (
        <div className="master-memory-container" style={{ marginBottom: '25px' }}>
            <div style={{
                background: 'linear-gradient(135deg, #1e3a5f 0%, #2d1b4e 100%)',
                borderRadius: '12px',
                padding: '20px',
                border: '1px solid rgba(139, 92, 246, 0.3)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#a78bfa' }}>
                            🧠 Master Memory
                        </h3>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Last updated: {formatTime(masterMemory.updated_at)}
                        </span>
                    </div>
                    <button
                        className="btn"
                        onClick={handleRegenerate}
                        disabled={regenerating}
                        style={{
                            background: 'rgba(139, 92, 246, 0.2)',
                            border: '1px solid rgba(139, 92, 246, 0.5)',
                            padding: '8px 16px',
                            fontSize: '0.85rem'
                        }}
                    >
                        {regenerating ? 'Regenerating...' : '🔄 Regenerate'}
                    </button>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '20px', opacity: 0.5 }}>Loading...</div>
                ) : masterMemory.content ? (
                    <div style={{
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '8px',
                        padding: '15px',
                        fontSize: '0.95rem',
                        lineHeight: '1.6',
                        whiteSpace: 'pre-wrap',
                        maxHeight: '300px',
                        overflowY: 'auto'
                    }}>
                        {masterMemory.content}
                    </div>
                ) : (
                    <div style={{
                        textAlign: 'center',
                        padding: '30px',
                        opacity: 0.6,
                        fontStyle: 'italic'
                    }}>
                        No master memory yet. Generate summaries for your chats to build your knowledge base.
                    </div>
                )}
            </div>
        </div>
    );
}
