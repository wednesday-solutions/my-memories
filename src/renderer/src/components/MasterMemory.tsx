import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { motion, AnimatePresence } from 'motion/react';

interface MasterMemoryData {
    content: string | null;
    updated_at: string | null;
}

type RegenerateMode = 'master-only' | 'all-summaries';

export function MasterMemoryModal() {
    const [masterMemory, setMasterMemory] = useState<MasterMemoryData>({ content: null, updated_at: null });
    const [loading, setLoading] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [showRegenerateChoice, setShowRegenerateChoice] = useState(false);
    const [regenerateProgress, setRegenerateProgress] = useState<{ current: number; total: number } | null>(null);
    const [copied, setCopied] = useState(false);

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

    const handleRegenerate = async (mode: RegenerateMode) => {
        setShowRegenerateChoice(false);
        setRegenerating(true);
        setRegenerateProgress(null);

        try {
            if (mode === 'master-only') {
                const newContent = await window.api.regenerateMasterMemory();
                if (newContent) {
                    setMasterMemory({ content: newContent, updated_at: new Date().toISOString() });
                }
            } else {
                // Re-summarize all chats then regenerate master
                const sessions = await window.api.getChatSessions();
                const total = sessions.length;
                setRegenerateProgress({ current: 0, total });

                for (let i = 0; i < sessions.length; i++) {
                    await window.api.summarizeSession(sessions[i].session_id);
                    setRegenerateProgress({ current: i + 1, total });
                }

                const newContent = await window.api.regenerateMasterMemory();
                if (newContent) {
                    setMasterMemory({ content: newContent, updated_at: new Date().toISOString() });
                }
            }
        } catch (e) {
            console.error("Failed to regenerate master memory", e);
        } finally {
            setRegenerating(false);
            setRegenerateProgress(null);
        }
    };

    const handleCopy = async () => {
        if (masterMemory.content) {
            await navigator.clipboard.writeText(masterMemory.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    useEffect(() => {
        fetchMasterMemory();
    }, []);

    const formatTime = (dateStr: string | null) => {
        if (!dateStr) return 'Never';
        const iso = dateStr.replace(' ', 'T') + 'Z';
        return new Date(iso).toLocaleString().substring(0, 16) + ' ' + new Date(iso).toLocaleString().substring(20, 22);
    };

    return (
        <div className="relative flex flex-col h-full max-h-[70vh]">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
                <div>
                    <h2 className="text-lg font-semibold text-white">Master Memory</h2>
                    <p className="text-xs text-neutral-500 mt-0.5">
                        Living summary - Last updated {formatTime(masterMemory.updated_at)}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Copy Button */}
                    {masterMemory.content && (
                        <button
                            onClick={handleCopy}
                            className="h-8 w-8 rounded-lg border border-neutral-700 bg-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600 transition-colors flex items-center justify-center"
                            title="Copy to clipboard"
                        >
                            {copied ? (
                                <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                                </svg>
                            )}
                        </button>
                    )}

                    {/* Regenerate Button */}
                    <button
                        disabled={regenerating}
                        onClick={() => setShowRegenerateChoice(true)}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-neutral-600 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {regenerating ? (
                            <span className="flex items-center gap-2">
                                <span className="w-3 h-3 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                                {regenerateProgress
                                    ? `${regenerateProgress.current}/${regenerateProgress.total}`
                                    : 'Regenerating...'}
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 12a9 9 0 11-9-9c2.52 0 4.85.83 6.72 2.24" strokeLinecap="round" />
                                    <path d="M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Regenerate
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Regenerate Choice Modal */}
            <AnimatePresence>
                {showRegenerateChoice && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-neutral-950/90 backdrop-blur-sm z-20 flex items-center justify-center p-4"
                        onClick={() => setShowRegenerateChoice(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ type: 'spring', bounce: 0.2, duration: 0.3 }}
                            className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 w-full max-w-sm"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-base font-semibold text-white mb-1">Regenerate</h3>
                            <p className="text-xs text-neutral-500 mb-4">
                                Choose what to regenerate
                            </p>

                            <div className="space-y-2">
                                <button
                                    onClick={() => handleRegenerate('master-only')}
                                    className="w-full p-3 rounded-lg bg-neutral-800/60 border border-neutral-700 hover:bg-neutral-800 hover:border-neutral-600 transition-all text-left"
                                >
                                    <p className="text-sm text-white font-medium">Master summary only</p>
                                    <p className="text-xs text-neutral-500 mt-0.5">
                                        Rebuild from existing chat summaries
                                    </p>
                                </button>

                                <button
                                    onClick={() => handleRegenerate('all-summaries')}
                                    className="w-full p-3 rounded-lg bg-neutral-800/60 border border-neutral-700 hover:bg-neutral-800 hover:border-neutral-600 transition-all text-left"
                                >
                                    <p className="text-sm text-white font-medium">All chat summaries + master</p>
                                    <p className="text-xs text-neutral-500 mt-0.5">
                                        Re-summarize every chat first
                                    </p>
                                </button>
                            </div>

                            <button
                                onClick={() => setShowRegenerateChoice(false)}
                                className="w-full mt-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                            >
                                Cancel
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Content */}
            <div className="flex-1 overflow-y-auto mt-4 pr-2 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm text-neutral-500">Loading memories...</span>
                        </div>
                    </div>
                ) : masterMemory.content ? (
                    <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkBreaks]}
                            components={{
                                p: ({ children }) => (
                                    <p className="mb-3 last:mb-0 text-neutral-300">{children}</p>
                                ),
                                a: ({ href, children }) => (
                                    <a href={href} target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-300 underline transition-colors">
                                        {children}
                                    </a>
                                ),
                                code: ({ children }) => (
                                    <code className="rounded bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 text-[0.85em] text-cyan-300">
                                        {children}
                                    </code>
                                ),
                                pre: ({ children }) => (
                                    <pre className="mb-3 overflow-x-auto rounded-lg bg-neutral-800/50 border border-neutral-700 p-3">{children}</pre>
                                ),
                                ul: ({ children }) => (
                                    <ul className="mb-3 space-y-1 pl-4 list-disc text-neutral-300">{children}</ul>
                                ),
                                ol: ({ children }) => (
                                    <ol className="mb-3 list-decimal pl-6 text-neutral-300">{children}</ol>
                                ),
                                li: ({ children }) => (
                                    <li className="text-neutral-300">{children}</li>
                                ),
                                strong: ({ children }) => (
                                    <strong className="font-semibold text-white">{children}</strong>
                                ),
                                em: ({ children }) => (
                                    <em className="text-neutral-200 italic">{children}</em>
                                ),
                                blockquote: ({ children }) => (
                                    <blockquote className="mb-3 border-l-2 border-cyan-500/40 pl-4 text-neutral-400 italic">
                                        {children}
                                    </blockquote>
                                ),
                                h1: ({ children }) => (
                                    <h1 className="mb-3 text-lg font-semibold text-white">{children}</h1>
                                ),
                                h2: ({ children }) => (
                                    <h2 className="mb-2 text-base font-semibold text-white">{children}</h2>
                                ),
                                h3: ({ children }) => (
                                    <h3 className="mb-2 text-sm font-semibold text-white">{children}</h3>
                                ),
                            }}
                        >
                            {masterMemory.content}
                        </ReactMarkdown>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-12 h-12 rounded-xl bg-neutral-800 flex items-center justify-center mb-3">
                            <svg className="w-6 h-6 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M12 2a8 8 0 018 8c0 2.5-1.1 4.8-3 6.3V18a2 2 0 01-2 2h-6a2 2 0 01-2-2v-1.7c-1.9-1.5-3-3.8-3-6.3a8 8 0 018-8z" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <p className="text-neutral-400 mb-1">No master memory yet</p>
                        <p className="text-neutral-600 text-sm">Generate summaries to build your knowledge base.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
