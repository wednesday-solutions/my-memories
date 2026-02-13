import { contextBridge, ipcRenderer } from 'electron';

console.log("PRELOAD SCRIPT LOADED");

try {
  contextBridge.exposeInMainWorld('api', {
    getMemories: (limit: number, appName?: string) => ipcRenderer.invoke('db:get-memories', limit, appName),
    addMemory: (content: string, source?: string) => ipcRenderer.invoke('db:add-memory', content, source),
    searchMemories: (query: string) => ipcRenderer.invoke('db:search-memories', query),
    getStats: () => ipcRenderer.invoke('db:get-stats'),
    getDashboardStats: () => ipcRenderer.invoke('db:get-dashboard-stats'),
    extractMemory: (text: string) => ipcRenderer.invoke('llm:extract', text),
    
    // Chat Summaries
    getChatSessions: (appName?: string) => ipcRenderer.invoke('db:get-chat-sessions', appName),
    getMemoriesForSession: (sessionId: string) => ipcRenderer.invoke('db:get-memories-for-session', sessionId),
    getEntitiesForSession: (sessionId: string) => ipcRenderer.invoke('db:get-entities-for-session', sessionId),
    getMemoryRecordsForSession: (sessionId: string) => ipcRenderer.invoke('db:get-memory-records-for-session', sessionId),
    summarizeSession: (sessionId: string) => ipcRenderer.invoke('llm:summarize-session', sessionId),
    deleteSession: (sessionId: string) => ipcRenderer.invoke('db:delete-session', sessionId),
    
    // Master Memory
    getMasterMemory: () => ipcRenderer.invoke('db:get-master-memory'),
    regenerateMasterMemory: () => ipcRenderer.invoke('db:regenerate-master-memory'),

    // RAG Chat - updated to support conversation history
    ragChat: (query: string, appName?: string, conversationHistory?: { role: string; content: string }[]) => 
      ipcRenderer.invoke('rag:chat', query, appName, conversationHistory),

    // RAG Conversation History
    createRagConversation: (id: string, title?: string) => ipcRenderer.invoke('rag:create-conversation', id, title),
    getRagConversations: () => ipcRenderer.invoke('rag:get-conversations'),
    getRagConversation: (id: string) => ipcRenderer.invoke('rag:get-conversation', id),
    getRagMessages: (conversationId: string) => ipcRenderer.invoke('rag:get-messages', conversationId),
    addRagMessage: (conversationId: string, role: 'user' | 'assistant', content: string, context?: any) => 
      ipcRenderer.invoke('rag:add-message', conversationId, role, content, context),
    updateRagConversationTitle: (id: string, title: string) => ipcRenderer.invoke('rag:update-conversation-title', id, title),
    deleteRagConversation: (id: string) => ipcRenderer.invoke('rag:delete-conversation', id),

    // Entities
    getEntities: (appName?: string) => ipcRenderer.invoke('db:get-entities', appName),
    getEntityDetails: (entityId: number, appName?: string) => ipcRenderer.invoke('db:get-entity-details', entityId, appName),
    getEntityGraph: (appName?: string, focusEntityId?: number, edgeLimit?: number) => ipcRenderer.invoke('db:get-entity-graph', appName, focusEntityId, edgeLimit),
    rebuildEntityGraph: () => ipcRenderer.invoke('db:rebuild-entity-graph'),
    deleteEntity: (entityId: number) => ipcRenderer.invoke('db:delete-entity', entityId),
    deleteMemory: (memoryId: number) => ipcRenderer.invoke('db:delete-memory', memoryId),
    
    // User Profile
    getUserProfile: () => ipcRenderer.invoke('db:get-user-profile'),
    saveUserProfile: (profile: any) => ipcRenderer.invoke('db:save-user-profile', profile),

    // App Settings
    getSettings: () => ipcRenderer.invoke('settings:get'),
    saveSetting: (key: string, value: any) => ipcRenderer.invoke('settings:save', key, value),
    reprocessAllSessions: (clean?: boolean) => ipcRenderer.invoke('db:reprocess-all-sessions', clean ?? false),

    // Master Memory Progress
    onMasterMemoryProgress: (callback: (data: { current: number; total: number }) => void) => {
      const subscription = (_: any, data: any) => callback(data)
      ipcRenderer.on('master-memory:progress', subscription)
      return () => ipcRenderer.removeListener('master-memory:progress', subscription)
    },

    // Prompts
    getPrompts: () => ipcRenderer.invoke('prompts:get-all'),
    savePrompt: (key: string, value: string) => ipcRenderer.invoke('prompts:save', key, value),
    resetPrompt: (key: string) => ipcRenderer.invoke('prompts:reset', key),
    onReprocessProgress: (callback: (data: { phase: string; processed: number; total: number }) => void) => {
      const subscription = (_: any, data: any) => callback(data)
      ipcRenderer.on('reprocess:progress', subscription)
      return () => ipcRenderer.removeListener('reprocess:progress', subscription)
    },
    
    // Watcher Events
    onWatcherData: (callback: (data: any) => void) => {
      const subscription = (_: any, data: any) => callback(data)
      ipcRenderer.on('watcher:data', subscription)
      return () => ipcRenderer.removeListener('watcher:data', subscription)
    },
    onPermissionDenied: (callback: () => void) => {
      const subscription = () => callback()
      ipcRenderer.on('watcher:permission-denied', subscription)
      return () => ipcRenderer.removeListener('watcher:permission-denied', subscription)
    },
    
    // Notification Events
    onNewMessages: (callback: (data: { sessionId: string; appName: string; chatTitle: string; count: number }) => void) => {
      const subscription = (_: any, data: any) => callback(data)
      ipcRenderer.on('notification:new-messages', subscription)
      return () => ipcRenderer.removeListener('notification:new-messages', subscription)
    },
    onNewMemory: (callback: (data: { sessionId: string; memoryContent: string }) => void) => {
      const subscription = (_: any, data: any) => callback(data)
      ipcRenderer.on('notification:new-memory', subscription)
      return () => ipcRenderer.removeListener('notification:new-memory', subscription)
    },
    onNewEntity: (callback: (data: { entityId: number; entityName: string; entityType: string }) => void) => {
      const subscription = (_: any, data: any) => callback(data)
      ipcRenderer.on('notification:new-entity', subscription)
      return () => ipcRenderer.removeListener('notification:new-entity', subscription)
    },
    onSummaryGenerated: (callback: (data: { sessionId: string; chatTitle: string }) => void) => {
      const subscription = (_: any, data: any) => callback(data)
      ipcRenderer.on('notification:summary-generated', subscription)
      return () => ipcRenderer.removeListener('notification:summary-generated', subscription)
    },
    
    // Permission APIs
    getPermissionStatus: () => ipcRenderer.invoke('permissions:get-status'),
    requestAccessibilityPermission: () => ipcRenderer.invoke('permissions:request-accessibility'),
    requestScreenRecordingPermission: () => ipcRenderer.invoke('permissions:request-screen-recording'),
    openAccessibilitySettings: () => ipcRenderer.invoke('permissions:open-accessibility-settings'),
    openScreenRecordingSettings: () => ipcRenderer.invoke('permissions:open-screen-recording-settings'),
    
    // LLM Activity (Dev Mode)
    onLlmActivity: (callback: (data: any) => void) => {
      const subscription = (_: any, data: any) => callback(data)
      ipcRenderer.on('llm:activity', subscription)
      return () => ipcRenderer.removeListener('llm:activity', subscription)
    },

    // Model Download APIs
    checkModelStatus: () => ipcRenderer.invoke('model:check-status'),
    downloadModels: () => ipcRenderer.invoke('model:download'),
    onModelDownloadProgress: (callback: (data: { modelName: string; percent: number; downloadedMB: string; totalMB: string }) => void) => {
      const subscription = (_: any, data: any) => callback(data)
      ipcRenderer.on('model:download-progress', subscription)
      return () => ipcRenderer.removeListener('model:download-progress', subscription)
    }
  });
  console.log("API Exposed successfully");
} catch (e) {
  console.error("Failed to expose API:", e);
}
