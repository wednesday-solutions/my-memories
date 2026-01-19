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
            graph.edges.map((e, idx) => ({
                id: `${e.source}-${e.target}-${e.type}-${e.updated_at ?? ''}-${idx}`,
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
        <div className="flex gap-4 h-full">
            {/* Graph Area */}
            <div className="flex-1 flex flex-col gap-3">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-white">Entity Graph</h2>
                    {focusEntityId && (
                        <button 
                            onClick={() => setFocusEntityId(undefined)} 
                            className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors text-sm"
                        >
                            Clear focus
                        </button>
                    )}
                    <button 
                        onClick={rebuildGraph} 
                        className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors text-sm"
                    >
                        Rebuild
                    </button>
                    <div className="ml-auto text-sm text-neutral-500">
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                                Loading…
                            </span>
                        ) : (
                            `${graph.nodes.length} nodes • ${graph.edges.length} edges`
                        )}
                    </div>
                </div>

                {/* Graph Container */}
                <div
                    ref={containerRef}
                    className="flex-1 min-h-[420px] rounded-xl border border-neutral-800 bg-neutral-900/50"
                />

                {/* Help Text */}
                <div className="text-xs text-neutral-500">
                    Click a node to view details. Double‑click to focus on its neighborhood.
                </div>
            </div>

            {/* Details Panel */}
            <div className="w-80 flex-shrink-0">
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-xl p-4">
                    {selectedNode ? (
                        <>
                            <div className="font-semibold text-white mb-2">{selectedNode.name}</div>
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                                {selectedNode.type || 'Unknown'}
                            </span>
                            <div className="text-xs text-neutral-500 mt-3">
                                {selectedNode.fact_count} facts • {selectedNode.session_count} sessions
                            </div>
                            {selectedNode.summary ? (
                                <div className="mt-3 text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed">
                                    {selectedNode.summary}
                                </div>
                            ) : (
                                <div className="mt-3 text-sm text-neutral-500 italic">
                                    No summary available yet.
                                </div>
                            )}
                            {selectedNode.facts && selectedNode.facts.length > 0 && (
                                <div className="mt-4">
                                    <div className="font-medium text-white text-sm mb-2">Recent facts</div>
                                    <ul className="space-y-2 text-sm text-neutral-400">
                                        {selectedNode.facts.map((fact, idx) => (
                                            <li key={`${selectedNode.id}-${idx}`} className="flex items-start gap-2">
                                                <span className="text-cyan-400 mt-1">•</span>
                                                <span>{fact}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-neutral-500 italic text-center py-4">
                            Select a node to view details.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
