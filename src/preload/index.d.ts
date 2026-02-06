import { ElectronAPI } from '@electron-toolkit/preload'

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

interface NotificationNewMessages {
  sessionId: string;
  appName: string;
  chatTitle: string;
  count: number;
}

interface NotificationNewMemory {
  sessionId: string | null;
  memoryContent: string;
}

interface NotificationNewEntity {
  entityId: number;
  entityName: string;
  entityType: string;
  factsCount: number;
}

interface NotificationSummaryGenerated {
  sessionId: string;
  chatTitle: string;
}

interface PermissionStatus {
  accessibility: boolean;
  screenRecording: boolean;
  allGranted: boolean;
}

interface RagConversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

interface RagMessage {
  id: number;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  context: string | null;
  created_at: string;
}

interface ReprocessProgress {
  phase: string;
  processed: number;
  total: number;
}

interface AppSettings {
  memoryStrictness?: 'lenient' | 'balanced' | 'strict';
  entityStrictness?: 'lenient' | 'balanced' | 'strict';
  [key: string]: any;
}

interface ChatSession {
  session_id: string;
  app_name: string;
  chat_title: string;
  message_count: number;
  summary: string | null;
  last_message_at: string;
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: IElectronAPI
  }

  interface IElectronAPI {
    // RAG Chat
    ragChat: (query: string, appName?: string, conversationHistory?: { role: string; content: string }[]) => Promise<{ answer: string; context: any }>

    // User Profile
    getUserProfile: () => Promise<UserProfile | null>
    saveUserProfile: (profile: UserProfile) => Promise<boolean>

    // RAG Conversations
    createRagConversation: (id: string, title?: string) => Promise<string>
    getRagConversations: () => Promise<RagConversation[]>
    getRagConversation: (id: string) => Promise<RagConversation | null>
    getRagMessages: (conversationId: string) => Promise<RagMessage[]>
    addRagMessage: (conversationId: string, role: 'user' | 'assistant', content: string, context?: any) => Promise<number>
    updateRagConversationTitle: (id: string, title: string) => Promise<void>
    deleteRagConversation: (id: string) => Promise<void>

    // App Settings
    getSettings: () => Promise<AppSettings>
    saveSetting: (key: string, value: any) => Promise<void>
    reprocessAllSessions: (clean?: boolean) => Promise<{ processed: number; total: number }>

    // Chat Sessions
    getChatSessions: (appName?: string) => Promise<ChatSession[]>
    summarizeSession: (sessionId: string) => Promise<string | null>

    // Master Memory
    getMasterMemory: () => Promise<{ content: string | null; updated_at: string | null }>
    regenerateMasterMemory: () => Promise<string | null>

    // Notification events
    onNewMessages: (callback: (data: NotificationNewMessages) => void) => () => void
    onNewMemory: (callback: (data: NotificationNewMemory) => void) => () => void
    onNewEntity: (callback: (data: NotificationNewEntity) => void) => () => void
    onSummaryGenerated: (callback: (data: NotificationSummaryGenerated) => void) => () => void
    onReprocessProgress: (callback: (data: ReprocessProgress) => void) => () => void

    // Permission APIs
    getPermissionStatus: () => Promise<PermissionStatus>
    requestAccessibilityPermission: () => Promise<boolean>
    requestScreenRecordingPermission: () => Promise<boolean>
    openAccessibilitySettings: () => Promise<boolean>
    openScreenRecordingSettings: () => Promise<boolean>

    // Model Download APIs
    checkModelStatus: () => Promise<{ downloaded: boolean; modelsDir: string }>
    downloadModels: () => Promise<{ success: boolean; error?: string }>
    onModelDownloadProgress: (callback: (data: { modelName: string; percent: number; downloadedMB: string; totalMB: string }) => void) => () => void

    // Allow additional properties
    [key: string]: any
  }
}
