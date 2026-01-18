import { contextBridge, ipcRenderer } from 'electron';

console.log("PRELOAD SCRIPT LOADED");

try {
  contextBridge.exposeInMainWorld('api', {
    getMemories: (limit: number, appName?: string) => ipcRenderer.invoke('db:get-memories', limit, appName),
    addMemory: (content: string, source?: string) => ipcRenderer.invoke('db:add-memory', content, source),
    searchMemories: (query: string) => ipcRenderer.invoke('db:search-memories', query),
    getStats: () => ipcRenderer.invoke('db:get-stats'),
    extractMemory: (text: string) => ipcRenderer.invoke('llm:extract', text),
    
    // Chat Summaries
    getChatSessions: (appName?: string) => ipcRenderer.invoke('db:get-chat-sessions', appName),
    getMemoriesForSession: (sessionId: string) => ipcRenderer.invoke('db:get-memories-for-session', sessionId),
    summarizeSession: (sessionId: string) => ipcRenderer.invoke('llm:summarize-session', sessionId),
    deleteSession: (sessionId: string) => ipcRenderer.invoke('db:delete-session', sessionId),
    
    // Master Memory
    getMasterMemory: () => ipcRenderer.invoke('db:get-master-memory'),
    regenerateMasterMemory: () => ipcRenderer.invoke('db:regenerate-master-memory'),

    // Entities
    getEntities: (appName?: string) => ipcRenderer.invoke('db:get-entities', appName),
    getEntityDetails: (entityId: number, appName?: string) => ipcRenderer.invoke('db:get-entity-details', entityId, appName),
    
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
    }
  });
  console.log("API Exposed successfully");
} catch (e) {
  console.error("Failed to expose API:", e);
}
