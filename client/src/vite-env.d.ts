/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_SOCKET_URL: string
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 