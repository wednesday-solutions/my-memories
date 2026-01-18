import { useEffect, useState } from 'react';

interface Memory {
    id: number;
    content: string;
    source_app: string;
    created_at: string;
}

export function MemoryFeed() {
    const [memories, setMemories] = useState<Memory[]>([]);
    const [search, setSearch] = useState('');

    const loadMemories = async () => {
        try {
            const data = await window.api.getMemories(50);
            setMemories(data);
        } catch (e) {
            console.error("Failed to load memories:", e);
        }
    };

    useEffect(() => {
        loadMemories();
        const interval = setInterval(loadMemories, 5000); // Poll for updates for now
        return () => clearInterval(interval);
    }, []);

    const handleSearch = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            if (!search.trim()) {
                loadMemories();
                return;
            }
            try {
                const results = await window.api.searchMemories(search);
                setMemories(results);
            } catch (e) {
                console.error("Search failed:", e);
            }
        }
    };

    return (
        <div>
            <div style={{ marginBottom: '24px' }}>
                <input
                    className="input"
                    placeholder="Search your memories..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={handleSearch}
                />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {memories.map((mem) => (
                    <div key={mem.id} className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span className="typography-label">{mem.source_app}</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                                {new Date(mem.created_at + 'Z').toLocaleTimeString()}
                            </span>
                        </div>
                        <div style={{ lineHeight: '1.5', color: 'var(--text-main)' }}>
                            {mem.content}
                        </div>
                    </div>
                ))}
                {memories.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                        No memories found.
                    </div>
                )}
            </div>
        </div>
    );
}
