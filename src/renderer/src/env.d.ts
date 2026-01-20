/// <reference types="vite/client" />

interface UserProfile {
  role?: string;
  companySize?: string;
  aiUsageFrequency?: string;
  primaryTools?: string[];
  painPoints?: string[];
  primaryUseCase?: string;
  privacyConcern?: string;
  expectedBenefit?: string;
  referralSource?: string;
  completedAt?: string;
}

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

interface IElectronAPI {
  getMemories: (limit: number, appName?: string) => Promise<any[]>
  addMemory: (content: string, source?: string) => Promise<{ id: number }>
  searchMemories: (query: string) => Promise<any[]>
  getStats: () => Promise<any>
  getDashboardStats: () => Promise<DashboardStats>
  extractMemory: (text: string) => Promise<{ summary: string; entities: string[]; topic: string }>
  
  getChatSessions: (appName?: string) => Promise<any[]>
  getMemoriesForSession: (sessionId: string) => Promise<any[]>
  getEntitiesForSession: (sessionId: string) => Promise<any[]>
  getMemoryRecordsForSession: (sessionId: string) => Promise<any[]>
  summarizeSession: (sessionId: string) => Promise<string>
  deleteSession: (sessionId: string) => Promise<boolean>
  
  // Master Memory
  getMasterMemory: () => Promise<{ content: string | null; updated_at: string | null }>
  regenerateMasterMemory: () => Promise<string | null>

  // RAG Chat
  ragChat: (query: string, appName?: string) => Promise<{ answer: string; context: any }>

  getEntities: (appName?: string) => Promise<any[]>
  getEntityDetails: (entityId: number, appName?: string) => Promise<any>
  getEntityGraph: (appName?: string, focusEntityId?: number, edgeLimit?: number) => Promise<{ nodes: any[]; edges: any[] }>
  rebuildEntityGraph: () => Promise<boolean>
  deleteEntity: (entityId: number) => Promise<boolean>
  deleteMemory: (memoryId: number) => Promise<boolean>
  
  // User Profile
  getUserProfile: () => Promise<UserProfile | null>
  saveUserProfile: (profile: UserProfile) => Promise<boolean>
  
  onWatcherData: (callback: (data: any) => void) => () => void
  onPermissionDenied: (callback: () => void) => () => void
}

interface Window {
  api: IElectronAPI
}
