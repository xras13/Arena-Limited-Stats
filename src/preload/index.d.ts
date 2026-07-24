import type { CompanionApi } from './index'

declare global {
  interface Window {
    companion: CompanionApi
  }
}

export {}
