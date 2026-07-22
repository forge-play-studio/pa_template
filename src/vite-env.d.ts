/// <reference types="vite/client" />

// 声明静态资源模块类型

declare module '*.glb?url' {
  const src: string;
  export default src;
}

declare module '*.png?url' {
  const src: string;
  export default src;
}

declare module '*.jpg?url' {
  const src: string;
  export default src;
}

declare module '*.svg?url' {
  const src: string;
  export default src;
}

declare module '*.wav?url' {
  const src: string;
  export default src;
}

declare module '*.mp3?url' {
  const src: string;
  export default src;
}

declare module '*.ogg?url' {
  const src: string;
  export default src;
}

declare module '*.flac?url' {
  const src: string;
  export default src;
}

declare module '*.aac?url' {
  const src: string;
  export default src;
}

declare module '*.m4a?url' {
  const src: string;
  export default src;
}

declare module '*.wasm?url' {
  const src: string;
  export default src;
}

declare module '*.env?url' {
  const src: string;
  export default src;
}

declare module '*.hdr?url' {
  const src: string;
  export default src;
}

declare module '*.dds?url' {
  const src: string;
  export default src;
}

declare module '*.ktx?url' {
  const src: string;
  export default src;
}

declare module '*.ktx2?url' {
  const src: string;
  export default src;
}

declare module 'virtual:pa-app-entry';

declare const __LITE_BUILD__: boolean;
declare const __PROD_BUILD__: boolean;
declare const __SCENE_WALKTHROUGH_BUILD__: boolean;
declare const __LOCALE__: string;
declare const __CHANNEL__: string;
declare const __TARGET_PLATFORM__: 'universal' | 'android' | 'ios';
declare const __RTL__: boolean;
declare const __MULTI_LOCALE__: boolean;
declare const __BUNDLED_LOCALES__: string[];
declare const __FPS_EDITOR_AGENT_SESSION_METADATA__: Record<string, unknown>;

// 在某些环境下（例如仅跑 tsc 且未安装完整 Vite 类型）
// 这里补充最小的 import.meta.env 类型，避免 TS2339。
interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly BASE_URL: string;
  // 自定义环境变量可按需补充
  [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  gameInstance: import('./runtime/GameWorld').GameWorld | null;
  game: import('./runtime/GameWorld').GameWorld | null;
  __bridgeProjectRuntime?: unknown;
  __pendingEditorRuntime?: unknown;
  /** Forge Play host 显式标记当前页面运行于托管沙盒。 */
  __FPS_EDITOR_HOSTED_SANDBOX__?: boolean;
  /** Forge Play host 注入的 boot 模式(srcdoc 编辑帧无 URL 可携带 mode)。 */
  __BOOT_MODE?: 'edit' | 'play';
}
