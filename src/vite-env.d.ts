/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OG_TITLE?: string
  readonly VITE_OG_DESCRIPTION?: string
  readonly VITE_OG_URL?: string
  readonly VITE_OG_SITE_NAME?: string
  readonly VITE_OG_IMAGE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
