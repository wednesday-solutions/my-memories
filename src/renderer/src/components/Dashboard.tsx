import { useEffect, useState, useCallback } from 'react';
import { motion, stagger, useAnimate } from 'motion/react';
import { cn } from '@renderer/lib/utils';
import { BorderBeam } from './ui/border-beam';
import { ProgressiveBlur } from './ui/progressive-blur';
import {
    IconBrain,
    IconUsers,
    IconArrowUpRight,
} from '@tabler/icons-react';

interface DashboardStats {
    totalChats: number;
    totalMemories: number;
    totalEntities: number;
    totalRelationships: number;
    totalMessages: number;
    totalFacts: number;
    todayChats: number;
    todayMemories: number;
    todayEntities: number;
    recentChats: Array<{
        session_id: string;
        title: string | null;
        app_name: string;
        memory_count: number;
        entity_count: number;
        updated_at: string;
    }>;
    recentMemories: Array<{
        id: number;
        content: string;
        source_app: string;
        created_at: string;
    }>;
    topEntities: Array<{
        id: number;
        name: string;
        type: string;
        fact_count: number;
        session_count: number;
    }>;
    entityTypeCounts: Array<{
        type: string;
        count: number;
    }>;
    appDistribution: Array<{
        app_name: string;
        chat_count: number;
        memory_count: number;
    }>;
    activityByDay: Array<{
        date: string;
        chats: number;
        memories: number;
    }>;
}

// Text Generate Effect for numbers
function AnimatedNumber({ value, delay = 0 }: { value: number; delay?: number }) {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => {
            const duration = 1000;
            const steps = 30;
            const increment = value / steps;
            let current = 0;

            const interval = setInterval(() => {
                current += increment;
                if (current >= value) {
                    setDisplayValue(value);
                    clearInterval(interval);
                } else {
                    setDisplayValue(Math.floor(current));
                }
            }, duration / steps);

            return () => clearInterval(interval);
        }, delay * 1000);

        return () => clearTimeout(timer);
    }, [value, delay]);

    return <span>{displayValue.toLocaleString()}</span>;
}

// Text Generate Effect Component
function TextGenerate({
    words,
    className,
    delay = 0
}: {
    words: string;
    className?: string;
    delay?: number;
}) {
    const [scope, animate] = useAnimate();
    const wordsArray = words.split(" ");

    useEffect(() => {
        const timer = setTimeout(() => {
            animate(
                "span",
                { opacity: 1, filter: "blur(0px)" },
                { duration: 0.4, delay: stagger(0.08) }
            );
        }, delay * 1000);

        return () => clearTimeout(timer);
    }, [animate, delay]);

    return (
        <motion.div ref={scope} className={cn("inline", className)}>
            {wordsArray.map((word, idx) => (
                <motion.span
                    key={word + idx}
                    className="opacity-0 inline-block"
                    style={{ filter: "blur(8px)" }}
                >
                    {word}{idx < wordsArray.length - 1 ? "\u00A0" : ""}
                </motion.span>
            ))}
        </motion.div>
    );
}

// Hero Stat - Large prominent number display
function HeroStat({
    label,
    value,
    delay = 0
}: {
    label: string;
    value: number;
    delay?: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay }}
            className="text-center"
        >
            <div className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-light text-white tracking-tight">
                <AnimatedNumber value={value} delay={delay} />
            </div>
            <div className="mt-1 lg:mt-2">
                <TextGenerate
                    words={label}
                    className="text-[10px] sm:text-xs lg:text-sm text-neutral-500 uppercase tracking-widest"
                    delay={delay + 0.3}
                />
            </div>
        </motion.div>
    );
}

// Activity Sparkline - Minimalist visualization
function ActivitySparkline({ data }: { data: DashboardStats['activityByDay'] }) {
    const maxValue = Math.max(...data.map(d => d.chats + d.memories), 1);
    const total = data.reduce((sum, d) => sum + d.chats + d.memories, 0);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="space-y-4"
        >
            <div className="flex items-baseline justify-between">
                <TextGenerate
                    words="14-Day Activity"
                    className="text-xs text-neutral-500 uppercase tracking-wider"
                    delay={0.6}
                />
                <span className="text-2xl font-light text-white">{total}</span>
            </div>
            <div className="flex items-end gap-[3px] h-16">
                {data.map((day, idx) => {
                    const height = ((day.chats + day.memories) / maxValue) * 100;
                    return (
                        <motion.div
                            key={day.date}
                            initial={{ height: 0 }}
                            animate={{ height: `${Math.max(height, 4)}%` }}
                            transition={{ duration: 0.5, delay: 0.8 + idx * 0.04 }}
                            className="flex-1 bg-neutral-700 rounded-sm hover:bg-neutral-600 transition-colors"
                            title={`${day.date}: ${day.chats + day.memories} activities`}
                        />
                    );
                })}
            </div>
        </motion.div>
    );
}

// Entity List Item
function EntityItem({
    entity,
    index,
    onClick
}: {
    entity: DashboardStats['topEntities'][0];
    index: number;
    onClick?: () => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="flex items-center justify-between py-2 lg:py-3 border-b border-neutral-800/50 last:border-0 group cursor-pointer hover:bg-neutral-800/20 -mx-2 px-2 rounded-lg transition-colors"
            onClick={onClick}
        >
            <div className="flex items-center gap-2 lg:gap-3 min-w-0 flex-1">
                <span className="text-neutral-600 text-xs lg:text-sm tabular-nums w-4 lg:w-5 shrink-0">{index + 1}</span>
                <div className="min-w-0 flex-1">
                    <p className="text-xs lg:text-sm text-neutral-200 group-hover:text-white transition-colors truncate">
                        {entity.name}
                    </p>
                    <p className="text-[10px] lg:text-[11px] text-neutral-600">{entity.type}</p>
                </div>
            </div>
            <div className="flex items-center gap-1.5 lg:gap-2 shrink-0">
                <span className="text-[10px] lg:text-xs text-neutral-500 tabular-nums">{entity.fact_count}</span>
                <IconArrowUpRight className="w-3 h-3 text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
        </motion.div>
    );
}

// Recent Chat Item
function ChatItem({
    chat,
    onClick
}: {
    chat: DashboardStats['recentChats'][0];
    onClick?: () => void;
}) {
    const formatTitle = (sessionId: string, title: string | null) => {
        if (title) return title;
        const firstDash = sessionId.indexOf('-');
        if (firstDash > 0) {
            return sessionId.slice(firstDash + 1).split('-').join(' ');
        }
        return sessionId;
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr.replace(' ', 'T') + 'Z');
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="py-2 lg:py-3 border-b border-neutral-800/50 last:border-0 group cursor-pointer hover:bg-neutral-800/20 -mx-2 px-2 rounded-lg transition-colors"
            onClick={onClick}
        >
            <div className="flex items-start justify-between gap-2 lg:gap-3">
                <div className="flex-1 min-w-0">
                    <p className="text-xs lg:text-sm text-neutral-200 truncate capitalize group-hover:text-white transition-colors">
                        {formatTitle(chat.session_id, chat.title)}
                    </p>
                    <div className="flex items-center flex-wrap gap-x-2 lg:gap-x-3 gap-y-1 mt-1 text-[10px] lg:text-[11px] text-neutral-600">
                        <span className="px-1.5 py-0.5 rounded bg-neutral-800/50 truncate max-w-[80px] lg:max-w-none">{chat.app_name}</span>
                        <span className="flex items-center gap-1">
                            <IconBrain className="w-3 h-3" />
                            {chat.memory_count}
                        </span>
                        <span className="flex items-center gap-1">
                            <IconUsers className="w-3 h-3" />
                            {chat.entity_count}
                        </span>
                        <span className="ml-auto">{formatTime(chat.updated_at)}</span>
                    </div>
                </div>
                <IconArrowUpRight className="w-3 h-3 lg:w-4 lg:h-4 text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
            </div>
        </motion.div>
    );
}

// Memory Item
function MemoryItem({
    memory,
    onClick
}: {
    memory: DashboardStats['recentMemories'][0];
    onClick?: () => void;
}) {
    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr.replace(' ', 'T') + 'Z');
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="py-2 lg:py-3 border-b border-neutral-800/50 last:border-0 group cursor-pointer hover:bg-neutral-800/20 -mx-2 px-2 rounded-lg transition-colors"
            onClick={onClick}
        >
            <p className="text-[11px] lg:text-xs text-neutral-400 line-clamp-2 leading-relaxed group-hover:text-neutral-300 transition-colors">
                {memory.content}
            </p>
            <div className="flex items-center gap-2 mt-1.5 lg:mt-2 text-[9px] lg:text-[10px] text-neutral-600">
                <span className="px-1.5 py-0.5 rounded bg-neutral-800/50 truncate max-w-[80px] lg:max-w-none">{memory.source_app}</span>
                <span>{formatTime(memory.created_at)}</span>
            </div>
        </motion.div>
    );
}

// Source Distribution Bar
function SourceBar({
    data,
    delay = 0
}: {
    data: DashboardStats['appDistribution'];
    delay?: number;
}) {
    const total = data.reduce((sum, d) => sum + d.chat_count, 0) || 1;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay }}
            className="h-full flex flex-col"
        >
            <TextGenerate
                words="Sources"
                className="text-xs text-neutral-500 uppercase tracking-wider"
                delay={delay + 0.1}
            />
            <div className="flex-1 flex flex-col justify-center space-y-3 mt-3 lg:mt-4">
                <div className="flex h-2 rounded-full overflow-hidden bg-neutral-800">
                    {data.map((app, idx) => (
                        <motion.div
                            key={app.app_name}
                            initial={{ width: 0 }}
                            animate={{ width: `${(app.chat_count / total) * 100}%` }}
                            transition={{ duration: 0.8, delay: delay + 0.3 + idx * 0.1 }}
                            className={cn(
                                "h-full",
                                idx === 0 && "bg-neutral-500",
                                idx === 1 && "bg-neutral-600",
                                idx === 2 && "bg-neutral-700",
                                idx > 2 && "bg-neutral-800"
                            )}
                            title={`${app.app_name}: ${app.chat_count} chats`}
                        />
                    ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {data.slice(0, 4).map((app, idx) => (
                        <motion.div
                            key={app.app_name}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.4, delay: delay + 0.5 + idx * 0.1 }}
                            className="flex items-center gap-2 text-[11px]"
                        >
                            <div className={cn(
                                "w-2 h-2 rounded-full",
                                idx === 0 && "bg-neutral-500",
                                idx === 1 && "bg-neutral-600",
                                idx === 2 && "bg-neutral-700",
                                idx > 2 && "bg-neutral-800"
                            )} />
                            <span className="text-neutral-400">{app.app_name}</span>
                            <span className="text-neutral-600 tabular-nums">{app.chat_count}</span>
                        </motion.div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
}

// Entity Type Distribution - Visual breakdown of entity categories
function EntityTypeBreakdown({
    data,
    total,
    delay = 0
}: {
    data: DashboardStats['entityTypeCounts'];
    total: number;
    delay?: number;
}) {
    const [isHovered, setIsHovered] = useState(false);

    // Monochromatic shades (default state) - different shades for visual distinction
    const monochromeColors: Record<string, string> = {
        'Person': 'bg-neutral-400',
        'Organization': 'bg-neutral-500',
        'Technology': 'bg-neutral-450',
        'Product': 'bg-neutral-350',
        'Concept': 'bg-neutral-550',
        'Location': 'bg-neutral-400',
        'Event': 'bg-neutral-500',
        'Unknown': 'bg-neutral-600',
    };

    // Actual colors (hover state) - matching EntityGraph colors exactly
    const typeColors: Record<string, string> = {
        'Person': 'bg-[#c9a0b8]',      // Muted pink
        'Organization': 'bg-[#8aa8c9]', // Muted blue
        'Technology': 'bg-[#7ab8a0]',   // Muted green
        'Product': 'bg-[#7ab8b8]',      // Muted cyan
        'Concept': 'bg-[#a89cc9]',      // Muted purple
        'Location': 'bg-[#c9b87a]',     // Muted yellow
        'Event': 'bg-[#c9957a]',        // Muted orange
        'Unknown': 'bg-[#7a7a7a]',      // Muted gray
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay }}
            className="space-y-4"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex items-baseline justify-between">
                <TextGenerate
                    words="Entity Types"
                    className="text-xs text-neutral-500 uppercase tracking-wider"
                    delay={delay + 0.1}
                />
                <span className="text-lg font-light text-white">{total}</span>
            </div>

            {/* Donut-style visual */}
            <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-neutral-800">
                {data.map((type, idx) => {
                    const percentage = total > 0 ? (type.count / total) * 100 : 0;
                    return (
                        <motion.div
                            key={type.type}
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.8, delay: delay + 0.3 + idx * 0.05 }}
                            className={cn(
                                "h-full transition-colors duration-300",
                                isHovered
                                    ? (typeColors[type.type] || 'bg-neutral-600')
                                    : (monochromeColors[type.type] || 'bg-neutral-700')
                            )}
                            title={`${type.type}: ${type.count}`}
                        />
                    );
                })}
            </div>

            {/* Legend grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {data.slice(0, 6).map((type, idx) => (
                    <motion.div
                        key={type.type}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: delay + 0.5 + idx * 0.08 }}
                        className="flex items-center justify-between"
                    >
                        <div className="flex items-center gap-2">
                            <div className={cn(
                                "w-2 h-2 rounded-full transition-colors duration-300",
                                isHovered
                                    ? (typeColors[type.type] || 'bg-neutral-600')
                                    : (monochromeColors[type.type] || 'bg-neutral-700')
                            )} />
                            <span className="text-[11px] text-neutral-400 truncate">{type.type}</span>
                        </div>
                        <span className="text-[11px] text-neutral-600 tabular-nums">{type.count}</span>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
}

// Knowledge Graph Stats - Quick insight into relationships
function GraphStats({
    entities,
    relationships,
    facts,
    delay = 0
}: {
    entities: number;
    relationships: number;
    facts: number;
    delay?: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay }}
            className="h-full flex flex-col"
        >
            <TextGenerate
                words="Knowledge Graph"
                className="text-xs text-neutral-500 uppercase tracking-wider"
                delay={delay + 0.1}
            />

            <div className="flex-1 flex flex-col justify-center space-y-2 lg:space-y-3 mt-3 lg:mt-4">
                <div className="flex items-center justify-between py-1.5 lg:py-2 px-2 lg:px-3 rounded-lg bg-neutral-800/30">
                    <span className="text-xs lg:text-sm text-neutral-400">Nodes</span>
                    <span className="text-lg lg:text-xl font-light text-white tabular-nums">
                        <AnimatedNumber value={entities} delay={delay + 0.3} />
                    </span>
                </div>
                <div className="flex items-center justify-between py-1.5 lg:py-2 px-2 lg:px-3 rounded-lg bg-neutral-800/30">
                    <span className="text-xs lg:text-sm text-neutral-400">Edges</span>
                    <span className="text-lg lg:text-xl font-light text-white tabular-nums">
                        <AnimatedNumber value={relationships} delay={delay + 0.4} />
                    </span>
                </div>
                <div className="flex items-center justify-between py-1.5 lg:py-2 px-2 lg:px-3 rounded-lg bg-neutral-800/30">
                    <span className="text-xs lg:text-sm text-neutral-400">Facts</span>
                    <span className="text-lg lg:text-xl font-light text-white tabular-nums">
                        <AnimatedNumber value={facts} delay={delay + 0.5} />
                    </span>
                </div>
            </div>
        </motion.div>
    );
}

// Today's Activity Summary
function TodayInsight({
    chats,
    memories,
    entities,
    delay = 0
}: {
    chats: number;
    memories: number;
    entities: number;
    delay?: number;
}) {
    const hasActivity = chats > 0 || memories > 0 || entities > 0;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay }}
            className="h-full flex flex-col"
        >
            <TextGenerate
                words="Today"
                className="text-xs text-neutral-500 uppercase tracking-wider"
                delay={delay + 0.1}
            />

            {hasActivity ? (
                <div className="flex-1 flex flex-col justify-center space-y-2 lg:space-y-3 mt-3 lg:mt-4">
                    {chats > 0 && (
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: delay + 0.3 }}
                            className="flex items-center justify-between py-1.5 lg:py-2 px-2 lg:px-3 rounded-lg bg-neutral-800/30"
                        >
                            <span className="text-xs lg:text-sm text-neutral-400">Chats updated</span>
                            <span className="text-base lg:text-lg font-light text-white">{chats}</span>
                        </motion.div>
                    )}
                    {memories > 0 && (
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: delay + 0.4 }}
                            className="flex items-center justify-between py-1.5 lg:py-2 px-2 lg:px-3 rounded-lg bg-neutral-800/30"
                        >
                            <span className="text-xs lg:text-sm text-neutral-400">Memories</span>
                            <span className="text-base lg:text-lg font-light text-white">{memories}</span>
                        </motion.div>
                    )}
                    {entities > 0 && (
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: delay + 0.5 }}
                            className="flex items-center justify-between py-1.5 lg:py-2 px-2 lg:px-3 rounded-lg bg-neutral-800/30"
                        >
                            <span className="text-xs lg:text-sm text-neutral-400">Entities</span>
                            <span className="text-base lg:text-lg font-light text-white">{entities}</span>
                        </motion.div>
                    )}
                </div>
            ) : (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: delay + 0.3 }}
                    className="flex-1 flex flex-col justify-center text-center"
                >
                    <p className="text-sm text-neutral-600">No activity yet today</p>
                    <p className="text-xs text-neutral-700 mt-1">Start chatting with your AI assistants</p>
                </motion.div>
            )}
        </motion.div>
    );
}

interface DashboardProps {
    onSelectChat?: (sessionId: string) => void;
    onSelectMemory?: (memoryId: number) => void;
    onSelectEntity?: (entityId: number) => void;
}

export function Dashboard({ onSelectChat, onSelectMemory, onSelectEntity }: DashboardProps) {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = useCallback(async (showLoader = false) => {
        if (showLoader) setLoading(true);
        try {
            const data = await window.api.getDashboardStats();
            setStats(data);
        } catch (e) {
            console.error('Failed to fetch dashboard stats:', e);
        } finally {
            if (showLoader) setLoading(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        fetchStats(true);
    }, [fetchStats]);

    // Subscribe to notification events to refresh stats in real-time
    useEffect(() => {
        const unsubscribers: (() => void)[] = [];

        if (window.api?.onNewMemory) {
            unsubscribers.push(window.api.onNewMemory(() => fetchStats()));
        }
        if (window.api?.onNewEntity) {
            unsubscribers.push(window.api.onNewEntity(() => fetchStats()));
        }
        if (window.api?.onNewMessages) {
            unsubscribers.push(window.api.onNewMessages(() => fetchStats()));
        }
        if (window.api?.onSummaryGenerated) {
            unsubscribers.push(window.api.onSummaryGenerated(() => fetchStats()));
        }
        // Also refresh on reprocess progress updates
        if (window.api?.onReprocessProgress) {
            unsubscribers.push(window.api.onReprocessProgress(() => fetchStats()));
        }

        return () => unsubscribers.forEach(unsub => unsub());
    }, [fetchStats]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border border-neutral-700 border-t-neutral-400 rounded-full"
                />
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="h-full flex items-center justify-center">
                <p className="text-neutral-500 text-sm">Failed to load dashboard</p>
            </div>
        );
    }

    return (
        <div className="relative h-full">
            <div className="absolute inset-0 overflow-y-auto pb-16">
                <div className="max-w-6xl mx-auto px-4 py-8">
                    {/* Hero Header with Text Generate Effect */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center mb-8 lg:mb-16"
                    >
                        <TextGenerate
                            words="Your Knowledge Base"
                            className="text-2xl sm:text-3xl lg:text-4xl font-light text-white tracking-tight"
                            delay={0}
                        />
                        <div className="mt-2 lg:mt-3">
                            <TextGenerate
                                words="Everything you've discussed, remembered, and learned"
                                className="text-neutral-500 text-sm lg:text-base"
                                delay={0.3}
                            />
                        </div>
                    </motion.div>

                    {/* Hero Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-8 mb-8 lg:mb-16">
                        <HeroStat label="Chats" value={stats.totalChats} delay={0.4} />
                        <HeroStat label="Memories" value={stats.totalMemories} delay={0.5} />
                        <HeroStat label="Entities" value={stats.totalEntities} delay={0.6} />
                        <HeroStat label="Relations" value={stats.totalRelationships} delay={0.7} />
                        <HeroStat label="Messages" value={stats.totalMessages} delay={0.8} />
                        <HeroStat label="Facts" value={stats.totalFacts} delay={0.9} />
                    </div>

                    {/* Activity, Sources & Entity Types Row */}
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-6 lg:mb-8">
                        <div className="h-full p-4 lg:p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800">
                            <ActivitySparkline data={stats.activityByDay} />
                        </div>
                        <div className="h-full p-4 lg:p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800">
                            <SourceBar data={stats.appDistribution} delay={0.7} />
                        </div>
                        <div className="h-full sm:col-span-2 lg:col-span-1 p-4 lg:p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800">
                            <EntityTypeBreakdown
                                data={stats.entityTypeCounts}
                                total={stats.totalEntities}
                                delay={0.8}
                            />
                        </div>
                    </div>

                    {/* Today + Knowledge Graph + Top Entities Row */}
                    <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6 mb-6 lg:mb-8">
                        {/* Today's Activity */}
                        <div className="h-full p-4 lg:p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800">
                            <TodayInsight
                                chats={stats.todayChats}
                                memories={stats.todayMemories}
                                entities={stats.todayEntities}
                                delay={0.85}
                            />
                        </div>

                        {/* Knowledge Graph Visualization */}
                        <div className="h-full p-4 lg:p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 relative overflow-hidden">
                            <BorderBeam
                                duration={10}
                                size={80}
                                className="from-transparent via-neutral-600 to-transparent opacity-20"
                            />
                            <GraphStats
                                entities={stats.totalEntities}
                                relationships={stats.totalRelationships}
                                facts={stats.totalFacts}
                                delay={0.9}
                            />
                        </div>

                        {/* Top Entities - Takes more space */}
                        <div className="h-full sm:col-span-2 lg:col-span-3 p-4 lg:p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 relative overflow-hidden">
                            <BorderBeam
                                duration={8}
                                size={100}
                                className="from-transparent via-neutral-700 to-transparent opacity-30"
                            />
                            <div className="flex items-center justify-between mb-3 lg:mb-4">
                                <TextGenerate
                                    words="Top Entities"
                                    className="text-xs text-neutral-500 uppercase tracking-wider"
                                    delay={1.0}
                                />
                                <span className="text-lg font-light text-white">{stats.totalEntities}</span>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-x-4 lg:gap-x-8">
                                <div className="space-y-1">
                                    {stats.topEntities.slice(0, 3).map((entity, idx) => (
                                        <EntityItem key={entity.id} entity={entity} index={idx} onClick={() => onSelectEntity?.(entity.id)} />
                                    ))}
                                </div>
                                <div className="space-y-1">
                                    {stats.topEntities.slice(3, 6).map((entity, idx) => (
                                        <EntityItem key={entity.id} entity={entity} index={idx + 3} onClick={() => onSelectEntity?.(entity.id)} />
                                    ))}
                                </div>
                                {stats.topEntities.length === 0 && (
                                    <p className="text-xs text-neutral-600 py-8 text-center col-span-2">No entities yet</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Recent Activity Row */}
                    <div className="grid sm:grid-cols-2 gap-4 lg:gap-6">
                        {/* Recent Chats */}
                        <div className="h-full p-4 lg:p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800">
                            <div className="flex items-center justify-between mb-3 lg:mb-4">
                                <TextGenerate
                                    words="Recent Chats"
                                    className="text-xs text-neutral-500 uppercase tracking-wider"
                                    delay={1.1}
                                />
                                <span className="text-lg font-light text-white">{stats.totalChats}</span>
                            </div>
                            <div className="space-y-1">
                                {stats.recentChats.slice(0, 5).map((chat) => (
                                    <ChatItem key={chat.session_id} chat={chat} onClick={() => onSelectChat?.(chat.session_id)} />
                                ))}
                                {stats.recentChats.length === 0 && (
                                    <p className="text-xs text-neutral-600 py-8 text-center">No chats yet</p>
                                )}
                            </div>
                        </div>

                        {/* Recent Memories */}
                        <div className="h-full p-4 lg:p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800">
                            <div className="flex items-center justify-between mb-3 lg:mb-4">
                                <TextGenerate
                                    words="Latest Memories"
                                    className="text-xs text-neutral-500 uppercase tracking-wider"
                                    delay={1.2}
                                />
                                <span className="text-lg font-light text-white">{stats.totalMemories}</span>
                            </div>
                            <div className="space-y-1">
                                {stats.recentMemories.slice(0, 5).map((memory) => (
                                    <MemoryItem key={memory.id} memory={memory} onClick={() => onSelectMemory?.(memory.id)} />
                                ))}
                                {stats.recentMemories.length === 0 && (
                                    <p className="text-xs text-neutral-600 py-8 text-center">No memories yet</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ProgressiveBlur
                height="100px"
                position="bottom"
                className="pointer-events-none"
            />
        </div>
    );
}
