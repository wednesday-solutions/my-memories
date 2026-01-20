
import { useEffect, useState, useRef, useCallback } from 'react';
import { MasterMemoryModal } from './MasterMemory';
import { Modal, ModalBody, ModalContent, ModalTrigger } from './ui/animated-modal';
import { BorderBeam } from './ui/border-beam';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from './ui/item';
import { cn } from '@renderer/lib/utils';

interface Memory {
    id: number;
    content: string;
    source_app: string;
    created_at: string;
}

interface MemoryListProps {
    appName: string;
}

interface MemoryListItemProps {
    memory: Memory;
    formattedTime: string;
    onDelete: (e: React.MouseEvent, memoryId: number) => void;
}

function MemoryListItem({ memory, formattedTime, onDelete }: MemoryListItemProps) {
    const preview = memory.content.length > 180
        ? `${memory.content.slice(0, 180).trim()}…`
        : memory.content;

    // Glare effect state
    const containerRef = useRef<HTMLDivElement>(null);
    const isPointerInside = useRef(false);
    const [glareStyle, setGlareStyle] = useState({ x: 50, y: 50, opacity: 0, rotateX: 0, rotateY: 0 });

    const handlePointerMove = (event: React.PointerEvent) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        // Calculate subtle rotation based on mouse position
        const rotateY = ((x - 50) / 50) * 3; // max 3 degrees
        const rotateX = ((y - 50) / 50) * -2; // max 2 degrees, inverted
        setGlareStyle({ x, y, opacity: 0.15, rotateX, rotateY });
    };

    const handlePointerEnter = () => {
        isPointerInside.current = true;
        setGlareStyle(prev => ({ ...prev, opacity: 0.15 }));
    };

    const handlePointerLeave = () => {
        isPointerInside.current = false;
        setGlareStyle({ x: 50, y: 50, opacity: 0, rotateX: 0, rotateY: 0 });
    };

    return (
        <div
            ref={containerRef}
            className="relative overflow-hidden rounded-lg"
            style={{
                transform: `perspective(800px) rotateX(${glareStyle.rotateX}deg) rotateY(${glareStyle.rotateY}deg)`,
                transition: 'transform 0.2s ease-out',
            }}
            onPointerMove={handlePointerMove}
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
        >
            {/* Glare/Shimmer overlay */}
            <div
                className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300"
                style={{
                    background: `radial-gradient(circle at ${glareStyle.x}% ${glareStyle.y}%, rgba(255,255,255,0.4) 0%, rgba(120,200,255,0.2) 25%, rgba(255,255,255,0) 60%)`,
                    opacity: glareStyle.opacity,
                }}
            />
            {/* Rainbow shimmer effect */}
            <div
                className="pointer-events-none absolute inset-0 z-10 mix-blend-color-dodge transition-opacity duration-300"
                style={{
                    background: `
                        radial-gradient(circle at ${glareStyle.x}% ${glareStyle.y}%, 
                            rgba(255,119,115,0.15) 0%,
                            rgba(255,237,95,0.1) 15%,
                            rgba(168,255,95,0.1) 30%,
                            rgba(131,255,247,0.1) 45%,
                            rgba(120,148,255,0.1) 60%,
                            rgba(216,117,255,0.1) 75%,
                            transparent 90%
                        )
                    `,
                    opacity: glareStyle.opacity * 2,
                }}
            />
            <Item variant="outline" className="group hover:border-neutral-700 relative">
                <ItemContent>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
                            {memory.source_app}
                        </span>
                        <ItemTitle>Memory #{memory.id}</ItemTitle>
                    </div>
                    <ItemDescription className="text-neutral-400 line-clamp-2">
                        {preview}
                    </ItemDescription>
                </ItemContent>

                <ItemActions className="gap-3">
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <span>{formattedTime}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <div onClick={(e) => e.stopPropagation()}>
                            <Modal>
                                <ModalTrigger className="h-8 w-8 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white hover:border-neutral-700 p-0 flex items-center justify-center">
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.6"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="h-4 w-4"
                                    >
                                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                </ModalTrigger>
                                <ModalBody className="bg-neutral-950 border-neutral-800 max-h-[80vh]">
                                    <ModalContent className="p-6 text-neutral-200 overflow-y-auto">
                                        <div className="text-base font-semibold text-white">Memory</div>
                                        <div className="mt-1 text-xs text-neutral-500">
                                            {memory.source_app} • {formattedTime}
                                        </div>
                                        <div className="mt-4 border-t border-neutral-800 pt-4 text-sm leading-relaxed text-neutral-200 whitespace-pre-wrap">
                                            {memory.content}
                                        </div>
                                        <div className="mt-5 text-xs text-neutral-500">#{memory.id}</div>
                                        <BorderBeam
                                            duration={6}
                                            size={380}
                                            className="from-transparent via-cyan-500 to-transparent"
                                        />
                                    </ModalContent>
                                </ModalBody>
                            </Modal>
                        </div>

                        <button
                            onClick={(e) => onDelete(e, memory.id)}
                            className="h-8 w-8 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-500 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/40 transition-all flex items-center justify-center"
                            title="Delete"
                        >
                            ×
                        </button>
                    </div>
                </ItemActions>
            </Item>
        </div>
    );
}

export function MemoryList({ appName }: MemoryListProps) {
    const [memories, setMemories] = useState<Memory[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchMemories = useCallback(async () => {
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
    }, [appName]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchMemories();
        setIsRefreshing(false);
    };

    useEffect(() => {
        fetchMemories();
    }, [fetchMemories]);

    const filteredMemories = memories.filter(m =>
        m.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatTime = (dateStr: string) => {
        const iso = dateStr.replace(' ', 'T') + 'Z';
        return new Date(iso).toLocaleString().substring(0, 16) + ' ' + new Date(iso).toLocaleString().substring(20, 22);
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
            <div className="flex-1 flex flex-col overflow-hidden gap-4">
                {/* Search bar with Master Memory icon */}
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
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

                    {/* Master Memory Icon Button */}
                    <Modal>
                        <ModalTrigger className="h-[46px] w-[46px] rounded-xl border border-neutral-800 bg-neutral-900/80 text-neutral-400 hover:text-cyan-400 hover:border-cyan-500/50 p-0 flex items-center justify-center transition-colors group">
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-5 w-5 group-hover:scale-110 transition-transform"
                            >
                                <path d="M12 2a8 8 0 018 8c0 2.5-1.1 4.8-3 6.3V18a2 2 0 01-2 2h-6a2 2 0 01-2-2v-1.7c-1.9-1.5-3-3.8-3-6.3a8 8 0 018-8z" />
                                <path d="M9 22h6" />
                                <path d="M9 18v-2" />
                                <path d="M15 18v-2" />
                            </svg>
                        </ModalTrigger>
                        <ModalBody className="bg-neutral-950 border-neutral-800 md:max-w-[60%] lg:max-w-[50%]">
                            <BorderBeam
                                duration={4}
                                delay={1}
                                size={400}
                                borderWidth={2}
                                className="from-transparent via-blue-500 to-transparent"
                            />
                            <BorderBeam
                                duration={4}
                                size={400}
                                borderWidth={2}
                                className="from-transparent via-cyan-500 to-transparent"
                            />
                            <ModalContent className="p-6">
                                <MasterMemoryModal />
                            </ModalContent>
                        </ModalBody>
                    </Modal>

                    {/* Refresh Button */}
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing || loading}
                        className={cn(
                            "h-[46px] w-[46px] rounded-xl border border-neutral-800 bg-neutral-900/80",
                            "text-neutral-400 hover:text-cyan-400 hover:border-cyan-500/50",
                            "flex items-center justify-center transition-all",
                            (isRefreshing || loading) && "opacity-50 cursor-not-allowed"
                        )}
                        title="Refresh"
                    >
                        <svg
                            className={cn("w-5 h-5", (isRefreshing || loading) && "animate-spin")}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>

                {loading && (
                    <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                <div className="flex-1 overflow-y-auto">
                    <ItemGroup>
                        {filteredMemories.map(memory => (
                            <MemoryListItem
                                key={memory.id}
                                memory={memory}
                                formattedTime={formatTime(memory.created_at)}
                                onDelete={handleDeleteMemory}
                            />
                        ))}
                    </ItemGroup>

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
        </div>
    );
}
