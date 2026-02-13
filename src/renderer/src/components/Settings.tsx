import { useEffect, useState, useRef, useCallback } from 'react';
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

// ---------------------------------------------------------------------------
// Prompt editor types & components
// ---------------------------------------------------------------------------

interface PromptData {
  key: string;
  name: string;
  description: string;
  category: string;
  variables: { name: string; description: string }[];
  defaultTemplate: string;
  currentTemplate: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  'master-memory': 'Master Memory',
  'memory-filter': 'Memory Filter',
  entity: 'Entity Extraction',
  session: 'Session Processing',
  chat: 'Chat',
};

const CATEGORY_ORDER = ['master-memory', 'memory-filter', 'entity', 'session', 'chat'];

function PromptCard({ prompt, onSave, onReset }: {
  prompt: PromptData;
  onSave: (key: string, value: string) => void;
  onReset: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(prompt.currentTemplate ?? prompt.defaultTemplate);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isCustomized = prompt.currentTemplate !== null;

  // Auto-resize textarea
  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  useEffect(() => {
    if (open) {
      // Small delay so the DOM has rendered the textarea
      requestAnimationFrame(resize);
    }
  }, [open, resize]);

  const handleChange = (text: string) => {
    setValue(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaving(true);
    timerRef.current = setTimeout(() => {
      onSave(prompt.key, text);
      setSaving(false);
    }, 1000);
    requestAnimationFrame(resize);
  };

  const handleReset = () => {
    setValue(prompt.defaultTemplate);
    onReset(prompt.key);
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaving(false);
    requestAnimationFrame(resize);
  };

  return (
    <div className="border border-neutral-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-neutral-800/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-white font-medium">{prompt.name}</span>
          {isCustomized && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">
              customized
            </span>
          )}
          {saving && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
              saving...
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              <p className="text-xs text-neutral-500">{prompt.description}</p>

              {/* Variable chips */}
              <div className="flex flex-wrap gap-1.5">
                {prompt.variables.map((v) => (
                  <span
                    key={v.name}
                    title={v.description}
                    className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-neutral-800 border border-neutral-700 text-neutral-400 cursor-help"
                  >
                    {`{{${v.name}}}`}
                  </span>
                ))}
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                spellCheck={false}
                className="w-full min-h-[120px] p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-300 text-xs font-mono leading-relaxed resize-none focus:outline-none focus:border-neutral-600 transition-colors"
              />

              {/* Reset button */}
              {(isCustomized || value !== prompt.defaultTemplate) && (
                <button
                  onClick={handleReset}
                  className="text-xs text-neutral-500 hover:text-white transition-colors"
                >
                  Reset to default
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PromptCategory({ category, prompts, onSave, onReset }: {
  category: string;
  prompts: PromptData[];
  onSave: (key: string, value: string) => void;
  onReset: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const customizedCount = prompts.filter((p) => p.currentTemplate !== null).length;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-300 font-medium">{CATEGORY_LABELS[category] ?? category}</span>
          <span className="text-[11px] text-neutral-600">{prompts.length} prompt{prompts.length !== 1 ? 's' : ''}</span>
          {customizedCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">
              {customizedCount} customized
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-neutral-600 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 pb-2">
              {prompts.map((p) => (
                <PromptCard key={p.key} prompt={p} onSave={onSave} onReset={onReset} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PromptSection() {
  const [prompts, setPrompts] = useState<PromptData[]>([]);

  useEffect(() => {
    window.api.getPrompts().then(setPrompts);
  }, []);

  const handleSave = useCallback((key: string, value: string) => {
    window.api.savePrompt(key, value);
    setPrompts((prev) => prev.map((p) => (p.key === key ? { ...p, currentTemplate: value } : p)));
  }, []);

  const handleReset = useCallback((key: string) => {
    window.api.resetPrompt(key);
    setPrompts((prev) => prev.map((p) => (p.key === key ? { ...p, currentTemplate: null } : p)));
  }, []);

  // Group by category
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: prompts.filter((p) => p.category === cat),
  })).filter((g) => g.items.length > 0);

  if (prompts.length === 0) return null;

  return (
    <motion.div
      className="rounded-2xl bg-neutral-900/60 backdrop-blur-sm border border-neutral-800 p-6"
      initial={{ opacity: 0, filter: 'blur(10px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, delay: 0.5 }}
    >
      <h3 className="text-white font-medium text-base mb-1">Prompts</h3>
      <p className="text-neutral-500 text-sm mb-4">
        View and edit the AI prompts used for memory extraction, entity detection, and chat. Use {'{{VARIABLE}}'} syntax for dynamic values.
      </p>

      <div className="space-y-1">
        {grouped.map((g) => (
          <PromptCategory
            key={g.category}
            category={g.category}
            prompts={g.items}
            onSave={handleSave}
            onReset={handleReset}
          />
        ))}
      </div>
    </motion.div>
  );
}

export function Settings() {
  const [memoryStrictness, setMemoryStrictness] = useState<Strictness>('balanced');
  const [entityStrictness, setEntityStrictness] = useState<Strictness>('balanced');
  const [devMode, setDevMode] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { reprocessing, progress, result, startReprocess, clearResult } = useReprocessing();

  // Load settings on mount
  useEffect(() => {
    window.api.getSettings().then((settings: any) => {
      if (settings.memoryStrictness) setMemoryStrictness(settings.memoryStrictness);
      if (settings.entityStrictness) setEntityStrictness(settings.entityStrictness);
      if (settings.devMode !== undefined) setDevMode(!!settings.devMode);
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
          className="flex flex-col gap-6 px-1"
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

          {/* Developer Section */}
          <motion.div
            className="rounded-2xl bg-neutral-900/60 backdrop-blur-sm border border-neutral-800 p-6"
            initial={{ opacity: 0, filter: 'blur(10px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <h3 className="text-white font-medium text-base mb-1">Developer</h3>
            <p className="text-neutral-500 text-sm mb-4">
              Tools for debugging and demo purposes.
            </p>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-300">Dev Mode</p>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Show a live panel of LLM calls with streaming tokens and timing.
                </p>
              </div>
              <button
                onClick={() => {
                  const next = !devMode;
                  setDevMode(next);
                  window.api.saveSetting('devMode', next);
                }}
                className={`relative w-11 h-6 rounded-full transition-colors ${devMode ? 'bg-green-600' : 'bg-neutral-700'}`}
              >
                <motion.div
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white"
                  animate={{ x: devMode ? 20 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
          </motion.div>

          {/* Prompts Section */}
          <PromptSection />
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
