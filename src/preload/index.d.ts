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

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      ragChat: (query: string, appName?: string) => Promise<{ answer: string; context: any }>
      getUserProfile: () => Promise<UserProfile | null>
      saveUserProfile: (profile: UserProfile) => Promise<boolean>
      
      // Notification events
      onNewMessages: (callback: (data: NotificationNewMessages) => void) => () => void
      onNewMemory: (callback: (data: NotificationNewMemory) => void) => () => void
      onNewEntity: (callback: (data: NotificationNewEntity) => void) => () => void
      onSummaryGenerated: (callback: (data: NotificationSummaryGenerated) => void) => () => void
    } & Record<string, any>
  }
}
