
import { useEffect, useState } from 'react';
import { MasterMemory } from './MasterMemory';
import { EntityList } from './EntityList';

interface Memory {
    id: number;
    content: string;
    source_app: string;
    created_at: string;
}

interface MemoryListProps {
    appName: string;
}

export function MemoryList({ appName }: MemoryListProps) {
    const [memories, setMemories] = useState<Memory[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [subTab, setSubTab] = useState<'memories' | 'entities'>('memories');

    const fetchMemories = async () => {
        setLoading(true);
        try {
            // Fetch last 100 memories, filtered by app
            const data = await window.api.getMemories(100, appName);
            setMemories(data);
        } catch (e) {
            console.error("Failed to fetch memories", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (subTab === 'memories') {
            fetchMemories();
        }
    }, [appName, subTab]);

    const filteredMemories = memories.filter(m =>
        m.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatTime = (dateStr: string) => {
        const iso = dateStr.replace(' ', 'T') + 'Z';
        return new Date(iso).toLocaleString();
    };

    return (
        <div className="memory-list-container">
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <button
                    className={`btn ${subTab === 'memories' ? 'active' : ''}`}
                    onClick={() => setSubTab('memories')}
                    style={{ opacity: subTab === 'memories' ? 1 : 0.6 }}
                >
                    Memories
                </button>
                <button
                    className={`btn ${subTab === 'entities' ? 'active' : ''}`}
                    onClick={() => setSubTab('entities')}
                    style={{ opacity: subTab === 'entities' ? 1 : 0.6 }}
                >
                    Entities
                </button>
            </div>

            {subTab === 'memories' ? (
                <>
                    {/* MASTER MEMORY SECTION */}
                    <MasterMemory />
                    {/* SEARCH BAR */}
                    <div style={{ marginBottom: '15px' }}>
                        <input
                            type="text"
                            placeholder="Search memories..."
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

                    <div className="memories-list">
                        {filteredMemories.map(memory => (
                            <div key={memory.id} className="memory-card" style={{ marginBottom: '10px', padding: '15px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <span className="source-tag">
                                        {memory.source_app}
                                    </span>
                                    <span className="timestamp">{formatTime(memory.created_at)}</span>
                                </div>
                                <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>
                                    {memory.content}
                                </div>
                            </div>
                        ))}

                        {!loading && filteredMemories.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
                                No memories found.
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <EntityList appName={appName} />
            )}
        </div>
    );
}
