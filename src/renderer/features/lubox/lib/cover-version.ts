import { useSyncExternalStore } from 'react';

/**
 * Cover images are plain <img> requests the browser caches. After lubox changes a cover, the version
 * here goes up and every LuboxCover for that track (or all of them, after an album change) asks again.
 */
let everything = 0;
const perTrack = new Map<string, number>();
const listeners = new Set<() => void>();

/** Mark one track's cover as changed, or every cover when no id is given (album changes). */
export function bumpCoverVersion(videoId?: string) {
    if (videoId) perTrack.set(videoId, (perTrack.get(videoId) ?? 0) + 1);
    else everything += 1;
    for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

/** "" until the cover changes, then a short value to add to the image URL. */
export const useCoverVersion = (videoId: string) =>
    useSyncExternalStore(subscribe, () => {
        const own = perTrack.get(videoId) ?? 0;
        return everything + own === 0 ? '' : `${everything}.${own}`;
    });
