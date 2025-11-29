/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WS_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'nosleep.js' {
  export default class NoSleep {
    enable(): Promise<void>
    disable(): void
    get isEnabled(): boolean
  }
}