import { useAuthStore } from '/@/renderer/store/auth.store';

/**
 * mubox feature constants. Everything mubox-specific lives under features/mubox so upstream
 * merges stay cheap (see docs/mubox/PLAN.md).
 */

/** Router (hash) paths owned by this feature. */
export const MuboxPath = {
    DOWNLOAD: '/mubox/download',
    OFFLINE: '/mubox/offline',
    ROOT: '/mubox',
    TRASH: '/mubox/trash',
    USERS: '/mubox/users',
} as const;

/** Splat route registered once in the app router. */
export const MUBOX_ROUTE_PATTERN = `${MuboxPath.ROOT}/*`;

declare global {
    interface Window {
        /** Optional override of the mubox proxy prefix (settings.js), for non-root deployments. */
        MUBOX_BASE?: string;
    }
}

/**
 * URL prefix of the mubox backend. A server added by a mubox address (desktop app) carries its own
 * `muboxUrl`; otherwise it is the same-origin proxy to the mubox backend (nginx in production, vite proxy in
 * dev). The browser never talks to the mubox origin directly, so mubox needs no CORS.
 */
export const getMuboxApiBase = (): string => {
    const own = useAuthStore.getState().currentServer?.muboxUrl;
    if (own) return own.replace(/\/+$/, '');
    const configured = typeof window !== 'undefined' ? window.MUBOX_BASE : undefined;
    const isUsable = configured && !configured.includes('${');
    const base = isUsable ? configured : '/mubox';
    return base.replace(/\/+$/, '');
};
