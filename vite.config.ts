import { readdirSync, readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Builds the lesson index in this process: strip the TypeScript types from each lesson file (lessons
 * only import types, so the result is plain data) and evaluate it. An earlier version spawned a child
 * Node process, which Windows sometimes refuses to start under memory pressure (0xC0000142).
 */
async function readLessons(root: string) {
  const dir = join(root, 'src', 'lessons');
  const out = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'index.ts')) {
    try {
      const js = stripTypeScriptTypes(readFileSync(join(dir, file), 'utf8'), { mode: 'strip' });
      const mod = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
      const lesson = Object.values(mod).find((v: any) => v && typeof v === 'object' && Array.isArray(v.steps)) as any;
      if (!lesson) continue;
      out.push({
        id: lesson.id,
        file,
        title: lesson.title,
        tagline: lesson.tagline,
        minutes: lesson.minutes,
        level: lesson.level,
        learn: lesson.learn,
        stepCount: lesson.steps.length,
        steps: lesson.steps.map((s: any) => ({ title: s.title, heading: s.heading, keyIdea: s.keyIdea ?? '' })),
      });
    } catch (e) {
      // A lesson being written at this moment must not take the whole site down. `npm run validate`
      // and the type check still report it.
      console.warn(`[lesson-manifest] skipped ${file}: ${(e as Error).message.split('\n')[0]}`);
    }
  }
  return out;
}

/**
 * Serves `virtual:lesson-manifest`: a small index of every lesson (titles, step headings, counts).
 * The course map and search use it, and each lesson's full data loads only when it is opened. In dev
 * the index regenerates whenever a lesson file changes.
 */
function lessonManifest(): Plugin {
  const publicId = 'virtual:lesson-manifest';
  const resolvedId = '\0' + publicId;
  let root = process.cwd();
  return {
    name: 'lesson-manifest',
    configResolved(config) {
      root = config.root;
    },
    resolveId: (id) => (id === publicId ? resolvedId : undefined),
    async load(id) {
      if (id !== resolvedId) return;
      return `export default ${JSON.stringify(await readLessons(root))};`;
    },
    configureServer(server) {
      server.watcher.on('all', (_event, file) => {
        if (!/src[\\/]lessons[\\/][^\\/]+\.ts$/.test(file) || /index\.ts$/.test(file)) return;
        const mod = server.moduleGraph.getModuleById(resolvedId);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      });
    },
  };
}

// base './' keeps asset paths relative so the build works on GitHub Pages sub-paths.
export default defineConfig({
  plugins: [react(), lessonManifest()],
  base: './',
});
