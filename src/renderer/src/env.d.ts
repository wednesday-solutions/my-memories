/// <reference types="vite/client" />

interface IElectronAPI {
  getMemories: (limit: number, appName?: string) => Promise<any[]>
  addMemory: (content: string, source?: string) => Promise<{ id: number }>
  searchMemories: (query: string) => Promise<any[]>
  getStats: () => Promise<any>
  extractMemory: (text: string) => Promise<{ summary: string; entities: string[]; topic: string }>
  
  getChatSessions: (appName?: string) => Promise<any[]>
  getMemoriesForSession: (sessionId: string) => Promise<any[]>
  summarizeSession: (sessionId: string) => Promise<string>
  deleteSession: (sessionId: string) => Promise<boolean>
  
  // Master Memory
  getMasterMemory: () => Promise<{ content: string | null; updated_at: string | null }>
  regenerateMasterMemory: () => Promise<string | null>

  // Entities
  getEntities: (appName?: string) => Promise<any[]>
  getEntityDetails: (entityId: number, appName?: string) => Promise<any>
  
  onWatcherData: (callback: (data: any) => void) => () => void
  onPermissionDenied: (callback: () => void) => () => void
}

interface Window {
  api: IElectronAPI
}
