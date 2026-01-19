
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

    const handleDeleteMemory = async (e: React.MouseEvent, memoryId: number) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this memory?")) return;

        try {
            await window.api.deleteMemory(memoryId);
            setMemories(prev => prev.filter(m => m.id !== memoryId));
        } catch (e) {
            console.error("Failed to delete memory", e);
        }
    };

    return (
        <div className="h-full flex flex-col gap-4">
            {/* Sub-tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setSubTab('memories')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        subTab === 'memories' 
                            ? 'bg-neutral-800 text-white' 
                            : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                >
                    Memories
                </button>
                <button
                    onClick={() => setSubTab('entities')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        subTab === 'entities' 
                            ? 'bg-neutral-800 text-white' 
                            : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                >
                    Entities
                </button>
            </div>

            {subTab === 'memories' ? (
                <div className="flex-1 flex flex-col overflow-hidden gap-4">
                    {/* Master Memory Section */}
                    <MasterMemory />
                    
                    {/* Search Bar */}
                    <div>
                        <div className="relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search memories..."
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
                        {filteredMemories.map(memory => (
                            <div key={memory.id} className="group relative p-4 rounded-xl bg-neutral-900/50 border border-neutral-800 hover:border-neutral-700 transition-all">
                                <div className="flex items-start justify-between mb-2">
                                    <span className="px-2 py-1 text-xs font-medium rounded-lg bg-indigo-500/20 text-indigo-400">
                                        {memory.source_app}
                                    </span>
                                    <span className="text-xs text-neutral-500">{formatTime(memory.created_at)}</span>
                                </div>
                                <div className="text-sm text-neutral-300 whitespace-pre-wrap pr-8">
                                    {memory.content}
                                </div>

                                <button
                                    onClick={(e) => handleDeleteMemory(e, memory.id)}
                                    className="absolute top-4 right-4 w-6 h-6 rounded-lg bg-neutral-800 text-neutral-500 hover:bg-red-500/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
                                    title="Delete memory"
                                >
                                    ×
                                </button>
                            </div>
                        ))}

                        {!loading && filteredMemories.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="w-16 h-16 rounded-2xl bg-neutral-800 flex items-center justify-center mb-4">
                                    <svg className="w-8 h-8 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                </div>
                                <p className="text-neutral-500">No memories found</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <EntityList appName={appName} />
            )}
        </div>
    );
}
