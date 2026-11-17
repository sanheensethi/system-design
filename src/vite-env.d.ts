/// <reference types="vite/client" />

declare module 'virtual:lesson-manifest' {
  import type { LessonMeta } from './engine/types';
  const manifest: (LessonMeta & { file: string })[];
  export default manifest;
}
