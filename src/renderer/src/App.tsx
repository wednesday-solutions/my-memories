
import { ChatList } from './components/ChatList';
import { ChatDetail } from './components/ChatDetail';
import { MemoryList } from './components/MemoryList';
import { useState } from 'react';

const TABS = ['All', 'Claude', 'Perplexity', 'Gemini', 'Grok', 'ChatGPT'];
type ViewMode = 'chats' | 'memories';

function App() {
  const [activeTab, setActiveTab] = useState('All');
  const [viewMode, setViewMode] = useState<ViewMode>('chats');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const handleBack = () => {
    setSelectedSessionId(null);
  };

  return (
    <div className="app-container" style={{ display: 'flex', width: '100%', height: '100vh', overflow: 'hidden' }}>

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
          {selectedSessionId ? (
            <ChatDetail sessionId={selectedSessionId} onBack={handleBack} />
          ) : (
            <div style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
              {viewMode === 'chats' ? (
                <ChatList
                  appName={activeTab}
                  onSelectSession={setSelectedSessionId}
                />
              ) : (
                <MemoryList appName={activeTab} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
