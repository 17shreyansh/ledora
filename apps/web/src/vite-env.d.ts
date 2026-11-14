/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** URL of the browser SDK script used in the install snippet. */
  readonly VITE_SDK_URL?: string;
  /** Public API base the SDK should send events to (adds `data-ledora-api` to the snippet). */
  readonly VITE_PUBLIC_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
