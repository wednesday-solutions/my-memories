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
        return new Date(iso).toLocaleString();
    };

    return (
        <div className="entity-list-container" style={{ display: 'flex', gap: '16px' }}>
            <div style={{ width: '35%', minWidth: '240px' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    {typeTabs.map(type => (
                        <button
                            key={type}
                            className={`btn ${typeFilter === type ? 'active' : ''}`}
                            onClick={() => setTypeFilter(type)}
                            style={{ opacity: typeFilter === type ? 1 : 0.6 }}
                        >
                            {type}
                        </button>
                    ))}
                </div>

                <div style={{ marginBottom: '12px' }}>
                    <input
                        type="text"
                        placeholder="Search entities..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '8px',
                            border: '1px solid var(--ev-c-gray-3)',
                            background: 'var(--color-background-soft)',
                            color: 'var(--text-main)'
                        }}
                    />
                </div>

                {loading && <div className="loading-spinner">Loading...</div>}

                <div className="entities-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filteredEntities.map(entity => (
                        <div
                            key={entity.id}
                            className={`memory-card clickable ${selectedEntityId === entity.id ? 'active' : ''}`}
                            onClick={() => setSelectedEntityId(entity.id)}
                            style={{
                                cursor: 'pointer',
                                border: selectedEntityId === entity.id ? '1px solid var(--primary)' : '1px solid transparent'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span className="source-tag" style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#c4b5fd' }}>
                                    {entity.type || 'Unknown'}
                                </span>
                                <span className="timestamp">{formatTime(entity.updated_at)}</span>
                            </div>
                            <div style={{ fontWeight: 700 }}>{entity.name}</div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{entity.fact_count} facts</div>
                        </div>
                    ))}

                    {!loading && filteredEntities.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '20px', opacity: 0.5 }}>
                            No entities found.
                        </div>
                    )}
                </div>
            </div>

            <div style={{ flex: 1 }}>
                {details?.entity ? (
                    <div className="memory-card" style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{details.entity.name}</div>
                            <span className="source-tag">{details.entity.type || 'Unknown'}</span>
                        </div>

                        <div style={{ marginBottom: '12px', fontSize: '0.9rem', opacity: 0.7 }}>
                            Updated: {formatTime(details.entity.updated_at)}
                        </div>

                        {details.entity.summary ? (
                            <div style={{
                                background: 'rgba(0, 0, 0, 0.2)',
                                borderRadius: '8px',
                                padding: '12px',
                                marginBottom: '16px',
                                whiteSpace: 'pre-wrap'
                            }}>
                                {details.entity.summary}
                            </div>
                        ) : (
                            <div style={{ marginBottom: '16px', opacity: 0.6, fontStyle: 'italic' }}>
                                No summary available yet.
                            </div>
                        )}

                        <div style={{ fontWeight: 600, marginBottom: '8px' }}>Facts</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {details.facts.map(fact => (
                                <div key={fact.id} style={{
                                    background: 'rgba(255,255,255,0.04)',
                                    borderRadius: '6px',
                                    padding: '10px'
                                }}>
                                    <div style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{fact.fact}</div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '6px' }}>
                                        {fact.source_session_id ? `Source: ${fact.source_session_id} • ` : ''}{formatTime(fact.created_at)}
                                    </div>
                                </div>
                            ))}

                            {details.facts.length === 0 && (
                                <div style={{ opacity: 0.6, fontStyle: 'italic' }}>No facts recorded yet.</div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div style={{ opacity: 0.6, fontStyle: 'italic' }}>Select an entity to view details.</div>
                )}
            </div>
        </div>
    );
}
