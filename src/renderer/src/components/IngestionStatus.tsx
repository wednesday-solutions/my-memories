import { useEffect, useState } from 'react';

interface WatcherData {
    appName: string;
    title: string;
    content: string;
    selectedText: string;
}

export function IngestionStatus() {
    const [status, setStatus] = useState<WatcherData | null>(null);
    const [denied, setDenied] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [lastSaved, setLastSaved] = useState<string | null>(null);

    useEffect(() => {
        const unsubData = window.api.onWatcherData((data: WatcherData) => {
            setDenied(false);
            setStatus(data);
        });

        const unsubDenied = window.api.onPermissionDenied(() => {
            setDenied(true);
        });

        return () => {
            unsubData();
            unsubDenied();
        };
    }, []);

    const handleProcess = async () => {
        if (!status) return;

        setProcessing(true);
        // Prioritize selected text if available, otherwise use full window content
        const textToProcess = status.selectedText || status.content;

        if (!textToProcess) {
            setProcessing(false);
            return;
        }

        try {
            const result = await window.api.extractMemory(textToProcess);
            const memoryContent = `${result.summary} [Entities: ${result.entities.join(', ')}]`;
            await window.api.addMemory(memoryContent, status.appName);
            setLastSaved("Saved: " + result.summary);
            setTimeout(() => setLastSaved(null), 3000);
        } catch (e) {
            console.error(e);
            setLastSaved("Error processing memory.");
        } finally {
            setProcessing(false);
        }
    };

    if (denied) {
        return (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 backdrop-blur-xl p-4">
                <h3 className="text-red-400 font-semibold mb-2">Permission Required</h3>
                <p className="text-sm text-neutral-400">
                    Please grant Accessibility permissions in System Settings.
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-xl p-4 mb-6">
            <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-medium text-cyan-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    LIVE CONTEXT
                </span>
                {status && (
                    <span className="text-xs text-neutral-500 px-2 py-0.5 rounded-full bg-neutral-800">
                        {status.appName}
                    </span>
                )}
            </div>

            {status ? (
                <div>
                    <h2 className="text-base font-semibold text-white mb-3 leading-tight">
                        {status.title || 'Untitled Window'}
                    </h2>

                    {/* Selected Text Section */}
                    {status.selectedText && (
                        <div className="bg-cyan-500/10 border-l-2 border-cyan-400 rounded-r-lg p-3 mb-4">
                            <span className="text-[10px] font-medium text-cyan-400 uppercase block mb-1">Selection</span>
                            <span className="text-sm text-neutral-300 italic">
                                "{status.selectedText.slice(0, 100)}{status.selectedText.length > 100 ? '...' : ''}"
                            </span>
                        </div>
                    )}

                    {/* Full Content Section (Deep Traversal) */}
                    {!status.selectedText && status.content && (
                        <div className="bg-neutral-800/50 rounded-lg p-3 mb-4">
                            <span className="text-[10px] font-medium text-neutral-500 uppercase block mb-1">
                                Window Content (Auto-Detected)
                            </span>
                            <span className="text-sm text-neutral-400">
                                "{status.content.slice(0, 150)}{status.content.length > 150 ? '...' : ''}"
                            </span>
                        </div>
                    )}

                    <button
                        onClick={handleProcess}
                        disabled={processing || (!status.content && !status.selectedText)}
                        className="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-medium text-sm hover:from-cyan-500 hover:to-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {processing ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Extracting...
                            </>
                        ) : (
                            'Save Context'
                        )}
                    </button>

                    {lastSaved && (
                        <div className={`mt-3 text-sm text-center ${lastSaved.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
                            {lastSaved}
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-neutral-500 italic text-center py-4">
                    Waiting for activity...
                </div>
            )}
        </div>
    );
}
