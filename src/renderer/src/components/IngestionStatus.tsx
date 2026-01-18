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
            <div className="card" style={{ borderColor: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' }}>
                <h3 style={{ color: '#ef4444', margin: 0 }}>Permission Required</h3>
                <p style={{ fontSize: '0.9rem', marginBottom: 0 }}>
                    Please grant Accessibility permissions in System Settings.
                </p>
            </div>
        );
    }

    return (
        <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="typography-label" style={{ color: 'var(--primary)', marginBottom: 0 }}>
                    ● LIVE CONTEXT
                </span>
                {status && (
                    <span className="typography-label" style={{ marginBottom: 0 }}>{status.appName}</span>
                )}
            </div>

            {status ? (
                <div>
                    <h2 style={{ fontSize: '1.1rem', margin: '0 0 8px 0', fontWeight: 600, lineHeight: 1.3 }}>
                        {status.title || 'Untitled Window'}
                    </h2>

                    {/* Selected Text Section */}
                    {status.selectedText && (
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '4px', fontSize: '0.85rem', marginBottom: '12px', fontStyle: 'italic', borderLeft: '2px solid var(--accent)' }}>
                            <span style={{ color: 'var(--accent)', fontSize: '0.7rem', display: 'block', marginBottom: '4px' }}>SELECTION</span>
                            "{status.selectedText.slice(0, 100)}{status.selectedText.length > 100 ? '...' : ''}"
                        </div>
                    )}

                    {/* Full Content Section (Deep Traversal) */}
                    {!status.selectedText && status.content && (
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '4px', fontSize: '0.8rem', marginBottom: '12px', color: 'var(--text-dim)' }}>
                            <span style={{ fontSize: '0.7rem', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Window Content (Auto-Detected)</span>
                            "{status.content.slice(0, 150)}{status.content.length > 150 ? '...' : ''}"
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                            className="btn btn-primary"
                            onClick={handleProcess}
                            disabled={processing || (!status.content && !status.selectedText)}
                            style={{ opacity: processing ? 0.7 : 1, width: '100%', justifyContent: 'center' }}
                        >
                            {processing ? 'Extracting...' : 'Save Context'}
                        </button>
                    </div>

                    {lastSaved && (
                        <div style={{ marginTop: '8px', fontSize: '0.8rem', color: lastSaved.includes('Error') ? '#ef4444' : '#4ade80' }}>
                            {lastSaved}
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '16px 0', textAlign: 'center' }}>
                    Waiting for activity...
                </div>
            )}
        </div>
    );
}
