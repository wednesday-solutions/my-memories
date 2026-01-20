
import { ChatList } from './components/ChatList';
import { ChatDetail } from './components/ChatDetail';
import { MemoryList } from './components/MemoryList';
import { EntityList } from './components/EntityList';
import { EntityGraph } from './components/EntityGraph';
import { MemoryChat } from './components/MemoryChat';
import { Dashboard } from './components/Dashboard';
import { Onboarding } from './components/Onboarding';
import { useState, useEffect } from 'react';
import { StarsBackground } from './components/ui/stars-background';
import { ShootingStars } from './components/ui/shooting-stars';
import { Sidebar, SidebarBody } from './components/ui/sidebar';
import { motion, AnimatePresence } from 'motion/react';
import {
  IconMessageCircle,
  IconMessages,
  IconBrain,
  IconUsers,
  IconGraph,
  IconSparkles,
  IconLayoutDashboard
} from '@tabler/icons-react';
import { cn } from './lib/utils';

const TABS = ['All', 'Claude', 'Perplexity', 'Gemini', 'Grok', 'ChatGPT'];
type ViewMode = 'dashboard' | 'chats' | 'memories' | 'entities' | 'graph' | 'memory-chat';

function App() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState('All');
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Check onboarding status on mount
  useEffect(() => {
    const completed = localStorage.getItem('onboarding_completed') === 'true';
    setHasCompletedOnboarding(completed);
  }, []);

  // Handle browser URL changes
  useEffect(() => {
    const path = window.location.pathname;
    const viewMap: Record<string, ViewMode> = {
      '/': 'dashboard',
      '/dashboard': 'dashboard',
      '/chat': 'memory-chat',
      '/chats': 'chats',
      '/memories': 'memories',
      '/entities': 'entities',
      '/graph': 'graph'
    };

    if (viewMap[path]) {
      setViewMode(viewMap[path]);
    }
  }, []);

  // Update browser URL when view mode changes
  useEffect(() => {
    const urlMap: Record<ViewMode, string> = {
      'dashboard': '/',
      'memory-chat': '/chat',
      'chats': '/chats',
      'memories': '/memories',
      'entities': '/entities',
      'graph': '/graph'
    };

    const newPath = urlMap[viewMode];
    if (window.location.pathname !== newPath) {
      window.history.replaceState(null, '', newPath);
    }
  }, [viewMode]);

  const handleOnboardingComplete = () => {
    setHasCompletedOnboarding(true);
  };

  const handleBack = () => {
    setSelectedSessionId(null);
  };

  // Global keyboard shortcut for back navigation (Cmd+[)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '[') {
        e.preventDefault();
        if (selectedSessionId) {
          setSelectedSessionId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSessionId]);

  // Show loading state while checking onboarding status
  if (hasCompletedOnboarding === null) {
    return null;
  }

  // Show onboarding if not completed
  if (!hasCompletedOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  const navItems = [
    { label: 'Dashboard', icon: <IconLayoutDashboard className="h-5 w-5 shrink-0 text-neutral-400" />, view: 'dashboard' as ViewMode },
    { label: 'Chats', icon: <IconMessages className="h-5 w-5 shrink-0 text-neutral-400" />, view: 'chats' as ViewMode },
    { label: 'Memories', icon: <IconBrain className="h-5 w-5 shrink-0 text-neutral-400" />, view: 'memories' as ViewMode },
    { label: 'Entities', icon: <IconUsers className="h-5 w-5 shrink-0 text-neutral-400" />, view: 'entities' as ViewMode },
    { label: 'Graph', icon: <IconGraph className="h-5 w-5 shrink-0 text-neutral-400" />, view: 'graph' as ViewMode },
    { label: 'Chat', icon: <IconMessageCircle className="h-5 w-5 shrink-0 text-neutral-400" />, view: 'memory-chat' as ViewMode },
  ];

  return (
    <div className="h-screen w-full overflow-hidden bg-neutral-950 relative">
      {/* Background effects */}
      <StarsBackground className="absolute inset-0 z-0" />
      <ShootingStars />

      <div className="flex h-full relative z-10">
        {/* Aceternity Sidebar */}
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen}>
          <SidebarBody className="justify-between gap-10 bg-neutral-900/80 backdrop-blur-xl border-r border-neutral-800">
            <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
              {/* Logo */}
              <div className="flex items-center gap-2 py-2">
                <div className="h-8 w-8 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0">
                  <IconSparkles className="h-4 w-4 text-neutral-400" />
                </div>
                <motion.span
                  animate={{
                    display: sidebarOpen ? 'inline-block' : 'none',
                    opacity: sidebarOpen ? 1 : 0,
                  }}
                  className="font-semibold text-white whitespace-pre"
                >
                  Your Memories
                </motion.span>
              </div>

              {/* Navigation */}
              <div className="mt-8 flex flex-col gap-2">
                {navItems.map((item) => (
                  <button
                    key={item.view}
                    onClick={() => { setViewMode(item.view); setSelectedSessionId(null); }}
                    className={cn(
                      "flex items-center gap-2 py-2 px-2 rounded-lg transition-colors group/sidebar",
                      viewMode === item.view
                        ? "bg-neutral-800 text-white"
                        : "text-neutral-400 hover:bg-neutral-800/50 hover:text-white"
                    )}
                  >
                    {item.icon}
                    <motion.span
                      animate={{
                        display: sidebarOpen ? 'inline-block' : 'none',
                        opacity: sidebarOpen ? 1 : 0,
                      }}
                      className="text-sm whitespace-pre group-hover/sidebar:translate-x-1 transition duration-150"
                    >
                      {item.label}
                    </motion.span>
                  </button>
                ))}
              </div>
            </div>
          </SidebarBody>
        </Sidebar>

        {/* Main Content */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Tab Bar */}
          <div className="flex items-center gap-2 px-6 py-4 bg-neutral-900/50 backdrop-blur-xl border-b border-neutral-800">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setSelectedSessionId(null); }}
                className={cn(
                  "relative px-4 py-2 rounded-full text-sm font-medium transition-all",
                  activeTab === tab
                    ? "text-white"
                    : "text-neutral-500 hover:text-neutral-300"
                )}
              >
                {activeTab === tab && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-neutral-800/80 border border-neutral-700 rounded-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10">{tab}</span>
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
            {viewMode === 'chats' && selectedSessionId ? (
              <motion.div
                key={`chat-detail-${selectedSessionId}`}
                initial={{ opacity: 0, filter: 'blur(10px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, filter: 'blur(5px)' }}
                transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="h-full"
              >
              <ChatDetail
                sessionId={selectedSessionId}
                onBack={handleBack}
                onSelectEntity={(_entityId) => {
                  // Navigate to entities view - the EntityList will need to handle selecting the specific entity
                  setViewMode('entities');
                  setSelectedSessionId(null);
                }}
                onSelectMemory={(_memoryId) => {
                  setViewMode('memories');
                  setSelectedSessionId(null);
                }}
              />
              </motion.div>
            ) : (
              <motion.div 
                key={viewMode}
                initial={{ opacity: 0, filter: 'blur(10px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, filter: 'blur(5px)' }}
                transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="p-6 h-full overflow-y-auto"
              >
                {viewMode === 'dashboard' ? (
                  <Dashboard appName={activeTab} />
                ) : viewMode === 'memory-chat' ? (
                  <MemoryChat appName={activeTab} />
                ) : viewMode === 'chats' ? (
                  <ChatList appName={activeTab} onSelectSession={setSelectedSessionId} />
                ) : viewMode === 'memories' ? (
                  <MemoryList appName={activeTab} />
                ) : viewMode === 'entities' ? (
                  <EntityList appName={activeTab} />
                ) : (
                  <EntityGraph appName={activeTab} />
                )}
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
