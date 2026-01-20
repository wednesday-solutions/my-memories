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

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      ragChat: (query: string, appName?: string) => Promise<{ answer: string; context: any }>
      getUserProfile: () => Promise<UserProfile | null>
      saveUserProfile: (profile: UserProfile) => Promise<boolean>
    } & Record<string, any>
  }
}
