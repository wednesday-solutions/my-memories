import { useEffect, useState } from 'react';
import { ProgressiveBlur } from './ui/progressive-blur';

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
        <div className="h-full flex flex-col">
            {/* Search */}
            <div className="relative mb-6">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                    type="text"
                    placeholder="Search your memories..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={handleSearch}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-neutral-900/80 border border-neutral-800 text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 transition-all"
                />
            </div>

            {/* Memory Cards */}
            <div className="relative flex-1 min-h-0">
                <div className="absolute inset-0 overflow-y-auto pb-16">
                    <div className="flex flex-col gap-4">
                        {memories.map((mem) => (
                            <div key={mem.id} className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 hover:border-neutral-700 transition-colors">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">
                                        {mem.source_app}
                                    </span>
                                    <span className="text-xs text-neutral-500">
                                        {new Date(mem.created_at + 'Z').toLocaleTimeString()}
                                    </span>
                                </div>
                                <div className="text-sm text-neutral-300 leading-relaxed">
                                    {mem.content}
                                </div>
                            </div>
                        ))}
                        {memories.length === 0 && (
                            <div className="text-center text-neutral-500 py-8">
                                No memories found.
                            </div>
                        )}
                    </div>
                </div>
                
                {memories.length > 3 && (
                    <ProgressiveBlur
                        height="80px"
                        position="bottom"
                        className="pointer-events-none"
                    />
                )}
            </div>
        </div>
    );
}
