import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ActivityEntry {
  id: number;
  promptKey: string;
  prompt: string;
  timestamp: number;
  tokens: string;
  response: string | null;
  error: string | null;
  duration: number | null;
  status: 'running' | 'done' | 'error';
}

const MAX_ENTRIES = 50;

export function DevPanel() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [minimized, setMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    if (!window.api?.onLlmActivity) return;

    const unsubscribe = window.api.onLlmActivity((data: any) => {
      setEntries(prev => {
        switch (data.type) {
          case 'start': {
            const entry: ActivityEntry = {
              id: data.id,
              promptKey: data.promptKey,
              prompt: data.prompt,
              timestamp: data.timestamp,
              tokens: '',
              response: null,
              error: null,
              duration: null,
              status: 'running',
            };
            const next = [...prev, entry];
            if (next.length > MAX_ENTRIES) return next.slice(-MAX_ENTRIES);
            return next;
          }
          case 'token': {
            return prev.map(e =>
              e.id === data.id ? { ...e, tokens: e.tokens + data.token } : e
            );
          }
          case 'complete': {
            return prev.map(e =>
              e.id === data.id
                ? { ...e, response: data.response, duration: data.duration, status: 'done' as const }
                : e
            );
          }
          case 'error': {
            return prev.map(e =>
              e.id === data.id
                ? { ...e, error: data.error, duration: data.duration, status: 'error' as const }
                : e
            );
          }
          default:
            return prev;
        }
      });
    });

    return unsubscribe;
  }, []);

  // Auto-scroll to bottom when new entries arrive or tokens stream in
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 40;
  }, []);

  const toggleExpand = useCallback((id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearEntries = useCallback(() => {
    setEntries([]);
    setExpanded(new Set());
  }, []);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const runningCount = entries.filter(e => e.status === 'running').length;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: minimized ? 36 : 280, opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="border-t border-neutral-800 bg-neutral-950 flex flex-col overflow-hidden shrink-0"
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-3 py-1.5 bg-neutral-900/80 border-b border-neutral-800 cursor-pointer select-none shrink-0"
        onClick={() => setMinimized(m => !m)}
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-semibold text-neutral-400 uppercase tracking-wider">
            LLM Activity
          </span>
          {runningCount > 0 && (
            <span className="flex items-center gap-1">
              <motion.div
                className="w-2 h-2 rounded-full bg-amber-500"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span className="text-[10px] text-amber-500 font-mono">{runningCount} active</span>
            </span>
          )}
          {runningCount === 0 && entries.length > 0 && (
            <span className="text-[10px] text-neutral-600 font-mono">{entries.length} calls</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); clearEntries(); }}
            className="text-[10px] text-neutral-600 hover:text-neutral-400 font-mono transition-colors"
          >
            clear
          </button>
          <svg
            className={`w-3.5 h-3.5 text-neutral-600 transition-transform ${minimized ? '' : 'rotate-180'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Activity feed */}
      {!minimized && (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overflow-x-hidden font-mono text-[11px] leading-relaxed"
        >
          {entries.length === 0 && (
            <div className="flex items-center justify-center h-full text-neutral-700 text-xs">
              Waiting for LLM calls...
            </div>
          )}

          {entries.map(entry => (
            <div
              key={entry.id}
              className="border-b border-neutral-900 px-3 py-2 hover:bg-neutral-900/40 transition-colors"
            >
              {/* Entry header */}
              <div className="flex items-center gap-2 mb-1">
                {/* Status indicator */}
                {entry.status === 'running' && (
                  <motion.div
                    className="w-2 h-2 rounded-full bg-amber-500 shrink-0"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                )}
                {entry.status === 'done' && (
                  <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                )}
                {entry.status === 'error' && (
                  <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                )}

                {/* Label */}
                <span className="text-blue-400 font-semibold">{entry.promptKey}</span>

                {/* Time */}
                <span className="text-neutral-600">{formatTime(entry.timestamp)}</span>

                {/* Duration */}
                {entry.duration !== null && (
                  <span className={`${entry.status === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                    {formatDuration(entry.duration)}
                  </span>
                )}

                {/* Expand toggle for prompt */}
                <button
                  onClick={() => toggleExpand(entry.id)}
                  className="text-neutral-600 hover:text-neutral-400 ml-auto transition-colors"
                >
                  {expanded.has(entry.id) ? 'collapse' : 'prompt'}
                </button>
              </div>

              {/* Expandable prompt text */}
              <AnimatePresence>
                {expanded.has(entry.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <pre className="text-neutral-500 whitespace-pre-wrap break-words bg-neutral-900/60 rounded px-2 py-1.5 mb-1.5 max-h-32 overflow-y-auto border border-neutral-800">
                      {entry.prompt}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Streaming tokens / response */}
              {entry.status === 'running' && entry.tokens && (
                <div className="text-neutral-300 whitespace-pre-wrap break-words max-h-20 overflow-y-auto">
                  {entry.tokens}
                  <motion.span
                    className="inline-block w-1.5 h-3 bg-neutral-400 ml-0.5 align-text-bottom"
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  />
                </div>
              )}
              {entry.status === 'done' && entry.response && (
                <div className="text-neutral-400 whitespace-pre-wrap break-words max-h-20 overflow-y-auto">
                  {entry.response.length > 300
                    ? entry.response.slice(0, 300) + '...'
                    : entry.response}
                </div>
              )}
              {entry.status === 'error' && entry.error && (
                <div className="text-red-400 whitespace-pre-wrap break-words">
                  {entry.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
