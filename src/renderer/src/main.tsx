import './assets/main.css'
import './assets/onboarding.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PostHogProvider } from 'posthog-js/react'
import App from './App'

const options = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  defaults: '2025-11-30',
} as const

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PostHogProvider options={options} apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_API_KEY}>
      <App />
    </PostHogProvider>
  </StrictMode>
)
