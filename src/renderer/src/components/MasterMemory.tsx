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
        <div className="mb-6">
            <div className="bg-gradient-to-br from-cyan-900/30 to-indigo-900/30 rounded-xl p-5 border border-cyan-500/20 backdrop-blur-xl">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-cyan-400 flex items-center gap-2">
                            <span className="text-xl">🧠</span> Master Memory
                        </h3>
                        <span className="text-xs text-neutral-500">
                            Last updated: {formatTime(masterMemory.updated_at)}
                        </span>
                    </div>
                    <button
                        onClick={handleRegenerate}
                        disabled={regenerating}
                        className="px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {regenerating ? (
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                                Regenerating...
                            </span>
                        ) : (
                            '🔄 Regenerate'
                        )}
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : masterMemory.content ? (
                    <div className="bg-neutral-900/50 rounded-lg p-4 text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                        {masterMemory.content}
                    </div>
                ) : (
                    <div className="text-center py-8 text-neutral-500 italic">
                        No master memory yet. Generate summaries for your chats to build your knowledge base.
                    </div>
                )}
            </div>
        </div>
    );
}
