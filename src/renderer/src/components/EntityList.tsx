import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@renderer/lib/utils';
import { Modal, ModalBody, ModalContent, ModalTrigger } from './ui/animated-modal';
import { BorderBeam } from './ui/border-beam';
import { ProgressiveBlur } from './ui/progressive-blur';

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

// Focus Card style entity item with blur-on-hover effect
function EntityCard({
    entity,
    index,
    hoveredIndex,
    setHoveredIndex,
    isSelected,
    onSelect,
    onDelete,
    formatTime,
}: {
    entity: Entity;
    index: number;
    hoveredIndex: number | null;
    setHoveredIndex: (index: number | null) => void;
    isSelected: boolean;
    onSelect: () => void;
    onDelete: (e: React.MouseEvent) => void;
    formatTime: (date: string) => string;
}) {
    const isBlurred = hoveredIndex !== null && hoveredIndex !== index;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={onSelect}
            style={{ marginBottom: 16 }}
            className={cn(
                "group relative p-4 rounded-xl cursor-pointer transition-all duration-300 ease-out border",
                isBlurred && "blur-sm scale-[0.98] opacity-60",
                isSelected
                    ? "bg-neutral-800/60 border-purple-500/40"
                    : "bg-neutral-900/40 border-neutral-800 hover:bg-neutral-800/40 hover:border-neutral-700"
            )}
        >

            {/* Card content */}
            <div className="relative z-10">
                {/* Entity name - prominent at top */}
                <h3 className={cn(
                    "text-base font-semibold pr-8 transition-colors leading-snug",
                    isSelected ? "text-white" : "text-neutral-200 group-hover:text-white"
                )}>
                    {entity.name}
                </h3>

                {/* Metadata row - type badge, fact count, and time */}
                <div className="flex items-center gap-3 mt-3">
                    <span className={cn(
                        "px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md",
                        "bg-purple-500/15 text-purple-300 border border-purple-500/20"
                    )}>
                        {entity.type || 'Unknown'}
                    </span>
                    <span className={cn(
                        "px-2 py-0.5 text-[10px] font-medium rounded-md",
                        "bg-cyan-500/10 text-cyan-400"
                    )}>
                        {entity.fact_count} {entity.fact_count === 1 ? 'fact' : 'facts'}
                    </span>
                    <span className="text-[11px] text-neutral-500 ml-auto">
                        {formatTime(entity.updated_at)}
                    </span>
                </div>

                {/* Delete button */}
                <button
                    onClick={onDelete}
                    className={cn(
                        "absolute top-0 right-0 w-6 h-6 rounded-lg",
                        "bg-neutral-800/80 text-neutral-500",
                        "hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/40",
                        "opacity-0 group-hover:opacity-100 transition-all duration-200",
                        "flex items-center justify-center text-sm border border-neutral-700"
                    )}
                    title="Delete entity"
                >
                    ×
                </button>
            </div>
        </motion.div>
    );
}

// Animated tab component
function TypeTab({
    type,
    isActive,
    onClick,
}: {
    type: string;
    isActive: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "relative px-4 py-2 rounded-full text-xs font-medium transition-all duration-300",
                isActive
                    ? "text-white"
                    : "text-neutral-500 hover:text-neutral-300"
            )}
        >
            {isActive && (
                <motion.div
                    layoutId="activeTypeTab"
                    className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 rounded-full border border-purple-500/30"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
            )}
            <span className="relative z-10">{type}</span>
        </button>
    );
}

// Entity details panel with spotlight effect
function EntityDetailsPanel({
    details,
    formatTime,
}: {
    details: EntityDetails | null;
    formatTime: (date: string) => string;
}) {
    if (!details?.entity) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-neutral-800/50 border border-neutral-700 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                    <p className="text-neutral-500">Select an entity to view details</p>
                </div>
            </div>
        );
    }

    return (
        <motion.div
            key={details.entity.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="relative p-6 rounded-2xl bg-gradient-to-br from-neutral-900/80 to-neutral-950/80 border border-neutral-800 overflow-hidden"
        >
            {/* Subtle background glow effect */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl" />

            {/* Border beam */}
            <BorderBeam
                size={200}
                duration={6}
                borderWidth={1.5}
                className="from-purple-500/40 via-cyan-500/40 to-purple-500/40"
            />

            <div className="relative z-10">
                {/* Header */}
                <div style={{
                    marginTop: 16
                }}
                    className="flex items-start justify-between mb-4">
                    <div className="flex-1 pr-4">
                        <h2 className="text-2xl font-bold text-white mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-300">
                            {details.entity.name}
                        </h2>
                        <p className="text-sm text-neutral-500">
                            Updated: {formatTime(details.entity.updated_at)}
                        </p>
                    </div>
                    <span className={cn(
                        "px-4 py-1.5 text-sm font-semibold rounded-full",
                        "bg-gradient-to-r from-purple-500/20 to-pink-500/20",
                        "text-purple-300 border border-purple-500/30"
                    )}>
                        {details.entity.type || 'Unknown'}
                    </span>
                </div>

                {/* Summary */}
                {details.entity.summary ? (
                    <div style={{
                        marginTop: 16
                    }}
                        className="p-4 rounded-xl bg-neutral-800/40 border border-neutral-700/50 mb-6">
                        <p className="text-neutral-200 text-sm leading-relaxed whitespace-pre-wrap">
                            {details.entity.summary}
                        </p>
                    </div>
                ) : (
                    <div style={{
                        marginTop: 16
                    }}
                        className="p-4 rounded-xl bg-neutral-800/20 border border-neutral-800 border-dashed mb-6">
                        <p className="text-neutral-500 text-sm italic">
                            No summary available yet.
                        </p>
                    </div>
                )}

                {/* Facts section */}
                <div>
                    <div className="flex items-center gap-2 mb-4" style={{
                        marginTop: 16
                    }}>
                        <h3 className="text-lg font-semibold text-white">Facts</h3>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                            {details.facts.length}
                        </span>
                    </div>

                    <div className="space-y-2">
                        <AnimatePresence>
                            {details.facts.map((fact, index) => (
                                <motion.div
                                    key={fact.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ delay: index * 0.05 }}
                                    style={{
                                        marginBottom: 8
                                    }}
                                >
                                    <Modal>
                                        <ModalTrigger className="w-full text-left p-3 rounded-lg bg-neutral-800/30 border border-neutral-800 hover:bg-neutral-800/50 hover:border-neutral-700 transition-all group">
                                            <p className="text-sm text-neutral-300 group-hover:text-neutral-200 transition-colors line-clamp-2">
                                                {fact.fact}
                                            </p>
                                            <div className="mt-2 text-xs text-neutral-500 flex items-center gap-2">
                                                {fact.source_session_id && (
                                                    <>
                                                        <span className="text-neutral-600">Source:</span>
                                                        <span className="truncate max-w-[200px]">{fact.source_session_id}</span>
                                                        <span className="text-neutral-700">•</span>
                                                    </>
                                                )}
                                                <span>{formatTime(fact.created_at)}</span>
                                            </div>
                                        </ModalTrigger>
                                        <ModalBody className="bg-neutral-950 border-neutral-800 max-h-[80vh]">
                                            <ModalContent className="p-6">
                                                <h4 className="text-lg font-semibold text-white mb-4">Fact Details</h4>
                                                <p className="text-neutral-200 whitespace-pre-wrap leading-relaxed">
                                                    {fact.fact}
                                                </p>
                                                <div className="mt-4 pt-4 border-t border-neutral-800 text-xs text-neutral-500">
                                                    {fact.source_session_id && (
                                                        <p className="mb-1">Source: {fact.source_session_id}</p>
                                                    )}
                                                    <p>Created: {formatTime(fact.created_at)}</p>
                                                </div>
                                                <BorderBeam
                                                    duration={6}
                                                    size={400}
                                                    className="from-transparent via-purple-500 to-transparent"
                                                />
                                            </ModalContent>
                                        </ModalBody>
                                    </Modal>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {details.facts.length === 0 && (
                            <div className="text-center py-8">
                                <p className="text-neutral-500 text-sm italic">No facts recorded yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div >
        </motion.div >
    );
}

export function EntityList({ appName }: EntityListProps) {
    const [entities, setEntities] = useState<Entity[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('All');
    const [selectedEntityId, setSelectedEntityId] = useState<number | null>(null);
    const [details, setDetails] = useState<EntityDetails | null>(null);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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
        <div className="h-full flex gap-6">
            {/* Left panel - Entity list */}
            <div className="w-[38%] min-w-[280px] flex flex-col gap-4">
                {/* Type filter tabs */}
                <div className="flex gap-1 flex-wrap pb-2">
                    {typeTabs.map(type => (
                        <TypeTab
                            key={type}
                            type={type}
                            isActive={typeFilter === type}
                            onClick={() => setTypeFilter(type)}
                        />
                    ))}
                </div>

                {/* Search with glow effect */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity blur" />
                    <div className="relative">
                        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search entities..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={cn(
                                "w-full pl-11 pr-4 py-3 rounded-xl",
                                "bg-neutral-900/80 border border-neutral-800",
                                "text-white text-sm placeholder-neutral-600",
                                "focus:outline-none focus:border-purple-500/50",
                                "transition-colors"
                            )}
                        />
                    </div>
                </div>

                {/* Loading state */}
                {loading && (
                    <div className="flex items-center justify-center py-12">
                        <div className="relative">
                            <div className="w-10 h-10 border-2 border-purple-500/30 rounded-full" />
                            <div className="absolute top-0 left-0 w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    </div>
                )}

                {/* Entity list with progressive blur */}
                <div className="relative flex-1 min-h-0">
                    <div className="absolute inset-0 overflow-y-auto pr-2 space-y-5 pb-24 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-neutral-800">
                        <AnimatePresence mode="popLayout">
                            {filteredEntities.map((entity, index) => (
                                <EntityCard
                                    key={entity.id}
                                    entity={entity}
                                    index={index}
                                    hoveredIndex={hoveredIndex}
                                    setHoveredIndex={setHoveredIndex}
                                    isSelected={selectedEntityId === entity.id}
                                    onSelect={() => setSelectedEntityId(entity.id)}
                                    onDelete={(e) => handleDeleteEntity(e, entity.id)}
                                    formatTime={formatTime}
                                />
                            ))}
                        </AnimatePresence>

                        {!loading && filteredEntities.length === 0 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center py-12"
                            >
                                <div className="w-16 h-16 rounded-2xl bg-neutral-800/50 border border-neutral-700 flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <p className="text-neutral-500">No entities found</p>
                            </motion.div>
                        )}
                    </div>

                    {/* Progressive blur at bottom */}
                    {filteredEntities.length > 3 && (
                        <ProgressiveBlur
                            height="80px"
                            position="bottom"
                            className="pointer-events-none"
                        />
                    )}
                </div>
            </div>

            {/* Right panel - Entity details */}
            <div className="flex-1 overflow-y-auto">
                <AnimatePresence mode="wait">
                    <EntityDetailsPanel
                        key={selectedEntityId}
                        details={details}
                        formatTime={formatTime}
                    />
                </AnimatePresence>
            </div>
        </div>
    );
}
