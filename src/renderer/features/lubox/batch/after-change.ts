import { QueryClient } from '@tanstack/react-query';

import { luboxKeys } from '/@/renderer/features/lubox/api/lubox-api';

/**
 * lubox writes the files at once and trusts Navidrome to rescan 60 s after the last change, so
 * Feishin's own lists keep the old tags for a little while. The refetch below runs once after that.
 */
export const NAVIDROME_REFRESH_DELAY_MS = 75_000;

// Feishin keys its server data as [serverId, resource, ...]
const FEISHIN_RESOURCES = new Set([
    'albumArtists',
    'albums',
    'artists',
    'genres',
    'playlists',
    'songs',
]);

/** Refresh what a lubox change made out of date: lubox's own data now, Feishin's lists after the rescan. */
export function afterLuboxChange(queryClient: QueryClient) {
    queryClient.invalidateQueries({ queryKey: luboxKeys.tracksAll() });
    queryClient.invalidateQueries({ queryKey: luboxKeys.albums() });
    queryClient.invalidateQueries({ queryKey: luboxKeys.lastBatch() });

    setTimeout(() => {
        queryClient.invalidateQueries({
            predicate: (query) =>
                query.queryKey[0] !== luboxKeys.all[0] &&
                typeof query.queryKey[1] === 'string' &&
                FEISHIN_RESOURCES.has(query.queryKey[1]),
        });
    }, NAVIDROME_REFRESH_DELAY_MS);
}
