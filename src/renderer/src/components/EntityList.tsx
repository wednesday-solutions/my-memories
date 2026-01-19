import { useEffect, useMemo, useState } from 'react';

interface Entity {
    id: number;
    name: string;
    type: string;
    summary: string | null;
    updated_at: string;
    fact_count: number;
}

interface EntityFact {
    id: number;
    fact: string;
    source_session_id: string | null;
    created_at: string;
}

interface EntityDetails {
    entity: Entity | null;
    facts: EntityFact[];
}

interface EntityListProps {
    appName: string;
}

export function EntityList({ appName }: EntityListProps) {
    const [entities, setEntities] = useState<Entity[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('All');
    const [selectedEntityId, setSelectedEntityId] = useState<number | null>(null);
    const [details, setDetails] = useState<EntityDetails | null>(null);

    const normalizeType = (value?: string) => (value || 'Unknown').trim() || 'Unknown';

    const fetchEntities = async () => {
        setLoading(true);
        try {
            const data = await window.api.getEntities(appName);
            setEntities(data as Entity[]);
            if (data.length > 0 && selectedEntityId === null) {
                setSelectedEntityId(data[0].id);
            }
        } catch (e) {
            console.error('Failed to fetch entities', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchDetails = async (entityId: number) => {
        try {
            const data = await window.api.getEntityDetails(entityId, appName);
            setDetails(data as EntityDetails);
        } catch (e) {
            console.error('Failed to fetch entity details', e);
        }
    };

    const handleDeleteEntity = async (e: React.MouseEvent, entityId: number) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this entity? This will also delete all associated facts.")) return;

        try {
            await window.api.deleteEntity(entityId);
            setEntities(prev => prev.filter(ent => ent.id !== entityId));
            if (selectedEntityId === entityId) {
                setSelectedEntityId(null);
                setDetails(null);
            }
        } catch (e) {
            console.error("Failed to delete entity", e);
        }
    };

    useEffect(() => {
        fetchEntities();
    }, [appName]);

    useEffect(() => {
        if (selectedEntityId !== null) {
            fetchDetails(selectedEntityId);
        } else {
            setDetails(null);
        }
    }, [selectedEntityId, appName]);

    const typeTabs = useMemo(() => {
        const types = Array.from(new Set(entities.map(e => normalizeType(e.type)))).sort();
        return ['All', ...types];
    }, [entities]);

    const filteredEntities = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return entities.filter(e => {
            const normalizedType = normalizeType(e.type);
            const matchesType = typeFilter === 'All' || normalizedType === typeFilter;
            const matchesSearch =
                e.name.toLowerCase().includes(query) ||
                normalizedType.toLowerCase().includes(query) ||
                (e.summary || '').toLowerCase().includes(query);
            return matchesType && matchesSearch;
        });
    }, [entities, searchQuery, typeFilter]);

    useEffect(() => {
        if (typeFilter !== 'All' && !typeTabs.includes(typeFilter)) {
            setTypeFilter('All');
        }
    }, [typeTabs, typeFilter]);

    useEffect(() => {
        if (filteredEntities.length === 0) {
            setSelectedEntityId(null);
            return;
        }
        if (!filteredEntities.some(e => e.id === selectedEntityId)) {
            setSelectedEntityId(filteredEntities[0].id);
        }
    }, [filteredEntities, selectedEntityId]);

    const formatTime = (dateStr: string) => {
        const iso = dateStr.replace(' ', 'T') + 'Z';
        return new Date(iso).toLocaleString().substring(0, 16) + ' ' + new Date(iso).toLocaleString().substring(20, 22);
    };

    return (
        <div className="h-full flex gap-4">
            {/* Left panel - Entity list */}
            <div className="w-[35%] min-w-[240px] flex flex-col gap-3">
                {/* Type filter tabs */}
                <div className="flex gap-2 flex-wrap">
                    {typeTabs.map(type => (
                        <button
                            key={type}
                            onClick={() => setTypeFilter(type)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${typeFilter === type
                                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                    : 'text-neutral-500 hover:text-neutral-300'
                                }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div>
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search entities..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                        />
                    </div>
                </div>

                {loading && (
                    <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {/* Entity list */}
                <div className="flex-1 overflow-y-auto space-y-2">
                    {filteredEntities.map(entity => (
                        <div
                            key={entity.id}
                            onClick={() => setSelectedEntityId(entity.id)}
                            className={`group relative p-3 rounded-xl cursor-pointer transition-all ${selectedEntityId === entity.id
                                    ? 'bg-neutral-800 border border-cyan-500/50'
                                    : 'bg-neutral-900/50 border border-neutral-800 hover:border-neutral-700'
                                }`}
                        >
                            <div className="flex items-start justify-between mb-1">
                                <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-500/20 text-purple-400">
                                    {entity.type || 'Unknown'}
                                </span>
                                <span className="text-xs text-neutral-500">{formatTime(entity.updated_at)}</span>
                            </div>
                            <div className="font-medium text-white text-sm pr-6">{entity.name}</div>
                            <div className="text-xs text-neutral-500 mt-1">{entity.fact_count} facts</div>

                            <button
                                onClick={(e) => handleDeleteEntity(e, entity.id)}
                                className="absolute top-3 right-3 w-5 h-5 rounded bg-neutral-800 text-neutral-500 hover:bg-red-500/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-xs"
                                title="Delete entity"
                            >
                                ×
                            </button>
                        </div>
                    ))}

                    {!loading && filteredEntities.length === 0 && (
                        <div className="text-center py-8 text-neutral-500 text-sm">
                            No entities found.
                        </div>
                    )}
                </div>
            </div>

            {/* Right panel - Entity details */}
            <div className="flex-1 overflow-y-auto">
                {details?.entity ? (
                    <div className="p-5 rounded-xl bg-neutral-900/50 border border-neutral-800">
                        <div className="flex items-start justify-between mb-4">
                            <h3 className="text-xl font-semibold text-white">{details.entity.name}</h3>
                            <span className="px-3 py-1 text-sm font-medium rounded-lg bg-purple-500/20 text-purple-400">
                                {details.entity.type || 'Unknown'}
                            </span>
                        </div>

                        <div className="text-sm text-neutral-500 mb-4">
                            Updated: {formatTime(details.entity.updated_at)}
                        </div>

                        {details.entity.summary ? (
                            <div className="p-4 rounded-xl bg-neutral-800/50 border border-neutral-700 mb-6 text-neutral-300 whitespace-pre-wrap">
                                {details.entity.summary}
                            </div>
                        ) : (
                            <div className="text-neutral-500 italic mb-6">
                                No summary available yet.
                            </div>
                        )}

                        <div className="font-semibold text-white mb-3">Facts</div>
                        <div className="space-y-3">
                            {details.facts.map(fact => (
                                <div key={fact.id} className="p-4 rounded-xl bg-neutral-800/30 border border-neutral-800">
                                    <div className="text-sm text-neutral-300 whitespace-pre-wrap">{fact.fact}</div>
                                    <div className="text-xs text-neutral-500 mt-2">
                                        {fact.source_session_id ? `Source: ${fact.source_session_id} • ` : ''}{formatTime(fact.created_at)}
                                    </div>
                                </div>
                            ))}

                            {details.facts.length === 0 && (
                                <div className="text-neutral-500 italic text-sm">No facts recorded yet.</div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-neutral-500">
                        Select an entity to view details
                    </div>
                )}
            </div>
        </div>
    );
}
