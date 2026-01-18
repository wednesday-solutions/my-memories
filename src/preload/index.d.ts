import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      ragChat: (query: string, appName?: string) => Promise<{ answer: string; context: any }>
    } & Record<string, any>
  }
}
