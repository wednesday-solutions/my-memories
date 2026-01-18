import { useEffect, useMemo, useRef, useState } from 'react';
import { DataSet, Network } from 'vis-network/standalone';
import 'vis-network/styles/vis-network.css';

interface GraphNode {
    id: number;
    name: string;
    type: string;
    summary?: string | null;
    updated_at: string;
    fact_count: number;
    session_count: number;
    facts?: string[];
}

interface GraphEdge {
    source: number;
    target: number;
    type: string;
    weight: number;
    evidence_count: number;
    updated_at: string;
}

interface GraphResponse {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

interface EntityGraphProps {
    appName: string;
}

export function EntityGraph({ appName }: EntityGraphProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const networkRef = useRef<Network | null>(null);
    const [graph, setGraph] = useState<GraphResponse>({ nodes: [], edges: [] });
    const [loading, setLoading] = useState(false);
    const [focusEntityId, setFocusEntityId] = useState<number | undefined>();
    const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);

    const nodesById = useMemo(() => {
        const map = new Map<number, GraphNode>();
        graph.nodes.forEach(n => map.set(n.id, n));
        return map;
    }, [graph.nodes]);

    const fetchGraph = async () => {
        setLoading(true);
        try {
            const data = await window.api.getEntityGraph(appName, focusEntityId, 200);
            setGraph(data as GraphResponse);
        } catch (e) {
            console.error('Failed to fetch entity graph', e);
        } finally {
            setLoading(false);
        }
    };

    const rebuildGraph = async () => {
        setLoading(true);
        try {
            await window.api.rebuildEntityGraph();
            await fetchGraph();
        } catch (e) {
            console.error('Failed to rebuild entity graph', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGraph();
    }, [appName, focusEntityId]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const nodes = new DataSet<{ id: number; label: string; value: number; title: string }>(
            graph.nodes.map(n => ({
                id: n.id,
                label: n.name,
                value: Math.max(1, Math.log2(n.fact_count + 1) + 1),
                title: `${n.name} (${n.type})\nFacts: ${n.fact_count}\nSessions: ${n.session_count}`
            }))
        );

        const edges = new DataSet<{ id: string; from: number; to: number; value: number; label?: string }>(
            graph.edges.map(e => ({
                id: `${e.source}-${e.target}`,
                from: e.source,
                to: e.target,
                value: e.weight,
                label: e.weight >= 2 ? String(e.weight) : undefined
            }))
        );

        if (!networkRef.current) {
            networkRef.current = new Network(container, { nodes, edges }, {
                autoResize: true,
                layout: { improvedLayout: true },
                interaction: {
                    hover: true,
                    tooltipDelay: 80,
                    hideEdgesOnDrag: true,
                    hideEdgesOnZoom: true
                },
                physics: {
                    solver: 'forceAtlas2Based',
                    forceAtlas2Based: {
                        gravitationalConstant: -35,
                        springLength: 140,
                        springConstant: 0.08
                    },
                    stabilization: { iterations: 200 }
                },
                nodes: {
                    shape: 'dot',
                    scaling: { min: 10, max: 28 },
                    font: {
                        color: '#e5e7eb',
                        size: 14,
                        strokeWidth: 0
                    },
                    labelHighlightBold: false,
                    color: {
                        border: '#7c3aed',
                        background: '#1f2937',
                        highlight: {
                            border: '#a78bfa',
                            background: '#2d1b69'
                        }
                    }
                },
                edges: {
                    color: { color: '#6b7280', highlight: '#c4b5fd', opacity: 0.4 },
                    width: 1,
                    selectionWidth: 2,
                    smooth: { enabled: true, type: 'dynamic', roundness: 0.2 }
                }
            });

            networkRef.current.on('click', params => {
                if (params.nodes.length > 0) {
                    const nodeId = params.nodes[0] as number;
                    setSelectedNodeId(nodeId);
                }
            });

            networkRef.current.on('doubleClick', params => {
                if (params.nodes.length > 0) {
                    const nodeId = params.nodes[0] as number;
                    setFocusEntityId(nodeId);
                }
            });
        } else {
            networkRef.current.setData({ nodes, edges });
        }
    }, [graph]);

    useEffect(() => {
        return () => {
            if (networkRef.current) {
                networkRef.current.destroy();
                networkRef.current = null;
            }
        };
    }, []);

    const selectedNode = selectedNodeId ? nodesById.get(selectedNodeId) : null;

    return (
        <div style={{ display: 'flex', gap: '16px', height: '100%' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700 }}>Entity Graph</div>
                    {focusEntityId && (
                        <button className="btn" onClick={() => setFocusEntityId(undefined)} style={{ padding: '6px 10px' }}>
                            Clear focus
                        </button>
                    )}
                    <button className="btn" onClick={rebuildGraph} style={{ padding: '6px 10px', opacity: 0.8 }}>
                        Rebuild
                    </button>
                    <div style={{ marginLeft: 'auto', opacity: 0.7, fontSize: '0.85rem' }}>
                        {loading ? 'Loading…' : `Nodes: ${graph.nodes.length} • Edges: ${graph.edges.length}`}
                    </div>
                </div>
                <div
                    ref={containerRef}
                    style={{ flex: 1, minHeight: '420px', borderRadius: '12px', border: '1px solid var(--ev-c-gray-3)' }}
                />
                <div style={{ opacity: 0.6, fontSize: '0.8rem' }}>
                    Click a node to view details. Double‑click to focus on its neighborhood.
                </div>
            </div>

            <div style={{ width: '320px', flexShrink: 0 }}>
                <div className="memory-card" style={{ padding: '14px' }}>
                    {selectedNode ? (
                        <>
                            <div style={{ fontWeight: 700, marginBottom: '6px' }}>{selectedNode.name}</div>
                            <div style={{ display: 'inline-block' }} className="source-tag">{selectedNode.type || 'Unknown'}</div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '8px' }}>
                                Facts: {selectedNode.fact_count} • Sessions: {selectedNode.session_count}
                            </div>
                            {selectedNode.summary ? (
                                <div style={{ marginTop: '10px', whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>
                                    {selectedNode.summary}
                                </div>
                            ) : (
                                <div style={{ marginTop: '10px', opacity: 0.6, fontStyle: 'italic' }}>
                                    No summary available yet.
                                </div>
                            )}
                            {selectedNode.facts && selectedNode.facts.length > 0 && (
                                <div style={{ marginTop: '12px' }}>
                                    <div style={{ fontWeight: 600, marginBottom: '6px' }}>Recent facts</div>
                                    <ul style={{ margin: 0, paddingLeft: '18px' }}>
                                        {selectedNode.facts.map((fact, idx) => (
                                            <li key={`${selectedNode.id}-${idx}`} style={{ marginBottom: '6px', fontSize: '0.85rem' }}>
                                                {fact}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{ opacity: 0.6, fontStyle: 'italic' }}>
                            Select a node to view details.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
