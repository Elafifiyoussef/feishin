import { defineConfig, mergeConfig } from 'vite';

import webConfig from './web.vite.config';

/**
 * Browser dev server for the mubox pages: upstream's web config plus a same-origin /mubox proxy
 * (mirrors the nginx location in docker/mubox/ng.conf.template).
 * Run: pnpm exec vite --config web.mubox.vite.config.ts  (MUBOX_DEV_URL overrides the target, default http://localhost:8000)
 */
const target = process.env.MUBOX_DEV_URL ?? 'http://localhost:8000';

export default mergeConfig(
    webConfig,
    defineConfig({
        // Upstream's web config excludes the atlaskit packages from pre-bundling, which breaks
        // their CommonJS-only transitive dependency in the dev server (the production build is fine).
        optimizeDeps: {
            include: [
                '@atlaskit/pragmatic-drag-and-drop > bind-event-listener',
                '@atlaskit/pragmatic-drag-and-drop-auto-scroll > bind-event-listener',
                '@atlaskit/pragmatic-drag-and-drop-hitbox > bind-event-listener',
            ],
        },
        server: {
            port: Number(process.env.PORT) || 5173,
            proxy: {
                '/mubox': {
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/mubox/, ''),
                    target,
                },
            },
        },
    }),
);
