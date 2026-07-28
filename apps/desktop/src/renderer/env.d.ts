/// <reference types="vite/client" />

import type { ModeratorApi } from '../preload'

declare global {
  interface Window {
    moderator: ModeratorApi
  }
}

export {}
