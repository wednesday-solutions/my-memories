
import { ChatList } from './components/ChatList';
import { ChatDetail } from './components/ChatDetail';
import { MemoryList } from './components/MemoryList';
import { EntityList } from './components/EntityList';
import { EntityGraph } from './components/EntityGraph';
import { MemoryChat } from './components/MemoryChat';
import { Onboarding } from './components/Onboarding';
import { useState, useEffect } from 'react';
import { StarsBackground } from './components/ui/stars-background';
import { ShootingStars } from './components/ui/shooting-stars';

const TABS = ['All', 'Claude', 'Perplexity', 'Gemini', 'Grok', 'ChatGPT'];
type ViewMode = 'chats' | 'memories' | 'entities' | 'graph' | 'memory-chat';

function App() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState('All');
  const [viewMode, setViewMode] = useState<ViewMode>('chats');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Check onboarding status on mount
  useEffect(() => {
    const completed = localStorage.getItem('onboarding_completed') === 'true';
    setHasCompletedOnboarding(completed);
  }, []);

  const handleOnboardingComplete = () => {
    setHasCompletedOnboarding(true);
  };

  const handleBack = () => {
    setSelectedSessionId(null);
  };

  // Show loading state while checking onboarding status
  if (hasCompletedOnboarding === null) {
    return null;
  }

  // Show onboarding if not completed
  if (!hasCompletedOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="app-container" style={{ display: 'flex', width: '100%', height: '100vh', overflow: 'hidden' }}>
      {/* Background effects */}
                              <StarsBackground className="absolute inset-0" />
                              <ShootingStars />

      {/* SIDEBAR NAVIGATION */}
      <div className="sidebar" style={{
        width: '200px',
        background: 'var(--ev-c-black-soft)',
        borderRight: '1px solid var(--ev-c-gray-3)',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
        gap: '10px',
        flexShrink: 0
      }}>
        <div style={{ marginBottom: '20px', fontWeight: 700, fontSize: '1.1rem' }}>Your Memories</div>

        <button
          className={`btn ${viewMode === 'memory-chat' ? 'active' : ''}`}
          onClick={() => { setViewMode('memory-chat'); setSelectedSessionId(null); }}
          style={{ justifyContent: 'flex-start', opacity: viewMode === 'memory-chat' ? 1 : 0.6 }}
        >
          Chat
        </button>
        <button
          className={`btn ${viewMode === 'chats' ? 'active' : ''}`}
          onClick={() => { setViewMode('chats'); setSelectedSessionId(null); }}
          style={{ justifyContent: 'flex-start', opacity: viewMode === 'chats' ? 1 : 0.6 }}
        >
          Chats
        </button>
        <button
          className={`btn ${viewMode === 'memories' ? 'active' : ''}`}
          onClick={() => { setViewMode('memories'); setSelectedSessionId(null); }}
          style={{ justifyContent: 'flex-start', opacity: viewMode === 'memories' ? 1 : 0.6 }}
        >
          Memories
        </button>
        <button
          className={`btn ${viewMode === 'entities' ? 'active' : ''}`}
          onClick={() => { setViewMode('entities'); setSelectedSessionId(null); }}
          style={{ justifyContent: 'flex-start', opacity: viewMode === 'entities' ? 1 : 0.6 }}
        >
          Entities
        </button>
        <button
          className={`btn ${viewMode === 'graph' ? 'active' : ''}`}
          onClick={() => { setViewMode('graph'); setSelectedSessionId(null); }}
          style={{ justifyContent: 'flex-start', opacity: viewMode === 'graph' ? 1 : 0.6 }}
        >
          Graph
        </button>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="main-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

        {/* Top Bar Navigation (Context Filters) */}
        <div className="tab-bar" style={{
          display: 'flex',
          background: 'var(--ev-c-black-soft)',
          borderBottom: '1px solid var(--ev-c-gray-3)',
          padding: '10px 20px',
          gap: '10px',
          overflowX: 'auto',
          flexShrink: 0
        }}>
          {TABS.map(tab => (
            <button
              key={tab}
              className={`btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => { setActiveTab(tab); setSelectedSessionId(null); }}
              style={{
                borderRadius: '20px',
                padding: '6px 16px',
                opacity: activeTab === tab ? 1 : 0.6,
                background: activeTab === tab ? 'var(--primary)' : 'transparent',
                border: '1px solid transparent',
                color: activeTab === tab ? '#fff' : 'var(--text-main)',
                whiteSpace: 'nowrap'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="content-view" style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {/* Logic: If Detail View is active, show it. Else show the List View (Chats or Memories) */}
          {viewMode === 'chats' && selectedSessionId ? (
            <ChatDetail sessionId={selectedSessionId} onBack={handleBack} />
          ) : (
            <div style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
              {viewMode === 'memory-chat' ? (
                <MemoryChat appName={activeTab} />
              ) : viewMode === 'chats' ? (
                <ChatList
                  appName={activeTab}
                  onSelectSession={setSelectedSessionId}
                />
              ) : viewMode === 'memories' ? (
                <MemoryList appName={activeTab} />
              ) : viewMode === 'entities' ? (
                <EntityList appName={activeTab} />
              ) : (
                <EntityGraph appName={activeTab} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
