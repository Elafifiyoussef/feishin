/**
 * lubox feature constants. Everything lubox-specific lives under features/lubox so upstream
 * merges stay cheap (see docs/lubox/PLAN.md).
 */

/** Router (hash) paths owned by this feature. */
export const LuboxPath = {
    DOWNLOAD: '/lubox/download',
    ROOT: '/lubox',
    TRASH: '/lubox/trash',
} as const;

/** Splat route registered once in the app router. */
export const LUBOX_ROUTE_PATTERN = `${LuboxPath.ROOT}/*`;

declare global {
    interface Window {
        /** Optional override of the lubox proxy prefix (settings.js), for non-root deployments. */
        LUBOX_BASE?: string;
    }
}

/**
 * URL prefix of the same-origin proxy to the lubox backend (nginx in production, vite proxy in
 * dev). The browser never talks to the lubox origin directly, so lubox needs no CORS.
 */
export const getLuboxApiBase = (): string => {
    const configured = typeof window !== 'undefined' ? window.LUBOX_BASE : undefined;
    const isUsable = configured && !configured.includes('${');
    const base = isUsable ? configured : '/lubox';
    return base.replace(/\/+$/, '');
};
