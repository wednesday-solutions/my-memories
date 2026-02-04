import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useReprocessing } from '../hooks/useReprocessing';
import { ProgressiveBlur } from './ui/progressive-blur';

type Strictness = 'lenient' | 'balanced' | 'strict';

const STRICTNESS_OPTIONS: { value: Strictness; label: string }[] = [
  { value: 'lenient', label: 'Lenient' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'strict', label: 'Strict' },
];

const MEMORY_DESCRIPTIONS: Record<Strictness, string> = {
  lenient: 'Stores most information from conversations including preferences, facts, technical details, and general knowledge shared. Good for comprehensive recall.',
  balanced: 'Stores only explicitly stated preferences, concrete decisions, specific project details, and firm commitments. Filters out noise, questions, and generic advice.',
  strict: 'Stores only high-value, directly stated personal preferences, major decisions, and critical project requirements. Very selective.',
};

const ENTITY_DESCRIPTIONS: Record<Strictness, string> = {
  lenient: 'Tracks all entities mentioned including people, tools, technologies, concepts, and places. Inclusive — captures entities that might be useful later.',
  balanced: 'Tracks only entities the user has an ongoing relationship with — their projects, tools they use, people they work with. Skips generic or passing mentions.',
  strict: 'Tracks only entities central to the user\'s work or life. Excludes generic tools, common technologies, and one-time mentions.',
};

function StrictnessPicker({
  label,
  description,
  value,
  descriptions,
  onChange,
  delay,
}: {
  label: string;
  description: string;
  value: Strictness;
  descriptions: Record<Strictness, string>;
  onChange: (v: Strictness) => void;
  delay: number;
}) {
  return (
    <motion.div
      className="rounded-2xl bg-neutral-900/60 backdrop-blur-sm border border-neutral-800 p-6"
      initial={{ opacity: 0, filter: 'blur(10px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, delay }}
    >
      <h3 className="text-white font-medium text-base mb-1">{label}</h3>
      <p className="text-neutral-500 text-sm mb-4">{description}</p>

      <div className="relative flex rounded-xl bg-neutral-800/80 border border-neutral-700 p-1 mb-4">
        {STRICTNESS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="relative flex-1 py-2 text-sm font-medium rounded-lg transition-colors z-10"
            style={{ color: value === opt.value ? '#fff' : '#a3a3a3' }}
          >
            {value === opt.value && (
              <motion.div
                layoutId={`${label}-pill`}
                className="absolute inset-0 rounded-lg bg-neutral-700 border border-neutral-600"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={value}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="text-sm text-neutral-400 bg-neutral-800/40 rounded-xl p-3 border border-neutral-700/50"
        >
          {descriptions[value]}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

export function Settings() {
  const [memoryStrictness, setMemoryStrictness] = useState<Strictness>('balanced');
  const [entityStrictness, setEntityStrictness] = useState<Strictness>('balanced');
  const [loaded, setLoaded] = useState(false);
  const { reprocessing, progress, result, startReprocess, clearResult } = useReprocessing();

  // Load settings on mount
  useEffect(() => {
    window.api.getSettings().then((settings: any) => {
      if (settings.memoryStrictness) setMemoryStrictness(settings.memoryStrictness);
      if (settings.entityStrictness) setEntityStrictness(settings.entityStrictness);
      setLoaded(true);
    });
  }, []);

  const handleMemoryChange = (v: Strictness) => {
    setMemoryStrictness(v);
    window.api.saveSetting('memoryStrictness', v);
  };

  const handleEntityChange = (v: Strictness) => {
    setEntityStrictness(v);
    window.api.saveSetting('entityStrictness', v);
  };

  if (!loaded) return null;

  return (
    <div className="relative h-full">
      <div className="absolute inset-0 overflow-y-auto pb-16">
        <motion.div
          className="flex flex-col gap-6 max-w-2xl px-1"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {/* Header */}
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, filter: 'blur(10px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="h-10 w-10 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center">
              <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Settings</h2>
              <p className="text-sm text-neutral-500">Configure memory and entity detection</p>
            </div>
          </motion.div>

          {/* Memory Strictness */}
          <StrictnessPicker
            label="Memory Strictness"
            description="Controls how aggressively new memories are stored from your conversations."
            value={memoryStrictness}
            descriptions={MEMORY_DESCRIPTIONS}
            onChange={handleMemoryChange}
            delay={0.2}
          />

          {/* Entity Strictness */}
          <StrictnessPicker
            label="Entity Strictness"
            description="Controls which entities (people, projects, tools) are tracked from your conversations."
            value={entityStrictness}
            descriptions={ENTITY_DESCRIPTIONS}
            onChange={handleEntityChange}
            delay={0.3}
          />

          {/* Reprocess Section */}
          <motion.div
            className="rounded-2xl bg-neutral-900/60 backdrop-blur-sm border border-neutral-800 p-6"
            initial={{ opacity: 0, filter: 'blur(10px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <h3 className="text-white font-medium text-base mb-1">Reprocess Sessions</h3>
            <p className="text-neutral-500 text-sm mb-4">
              Re-extract memories and entities from all existing sessions using the current strictness settings.
            </p>

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => startReprocess(false)}
                disabled={reprocessing}
                className="px-4 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-700 hover:border-neutral-600 transition-all"
              >
                {reprocessing ? (
                  <span className="flex items-center gap-2">
                    <motion.div
                      className="w-3 h-3 border-2 border-neutral-400 border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    />
                    Reprocessing...
                  </span>
                ) : (
                  'Reprocess (keep existing)'
                )}
              </button>

              <button
                onClick={() => startReprocess(true)}
                disabled={reprocessing}
                className="px-4 py-2 rounded-xl bg-neutral-800 border border-red-900/50 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-950/40 hover:border-red-800/60 transition-all"
              >
                {reprocessing ? (
                  <span className="flex items-center gap-2">
                    <motion.div
                      className="w-3 h-3 border-2 border-neutral-400 border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    />
                    Reprocessing...
                  </span>
                ) : (
                  'Clean reprocess'
                )}
              </button>
            </div>

            <div className="mt-3 space-y-1">
              <p className="text-xs text-neutral-600">
                <span className="text-neutral-500">Keep existing:</span> Re-runs entity extraction on top of current data. Fast, no data loss.
              </p>
              <p className="text-xs text-neutral-600">
                <span className="text-neutral-500">Clean:</span> Deletes all memories, entities, and facts, then rebuilds everything from scratch with current settings.
              </p>
            </div>

            {progress && reprocessing && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3"
              >
                <p className="text-sm text-neutral-400 mb-2">
                  {progress.phase === 'cleared'
                    ? 'All memories, entities, and facts cleared. Rebuilding...'
                    : `Processing session ${progress.processed} of ${progress.total}...`}
                </p>
                {progress.total > 0 && (
                  <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-neutral-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round((progress.processed / progress.total) * 100)}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                )}
              </motion.div>
            )}

            {result && !reprocessing && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-center gap-2"
              >
                <p className="text-sm text-neutral-400">
                  Reprocessed {result.processed} of {result.total} sessions.
                </p>
                <button
                  onClick={clearResult}
                  className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
                >
                  Dismiss
                </button>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      </div>

      <ProgressiveBlur
        height="80px"
        position="bottom"
        className="pointer-events-none"
      />
    </div>
  );
}
