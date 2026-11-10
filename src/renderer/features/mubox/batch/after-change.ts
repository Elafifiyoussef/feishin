import { InfiniteData, QueryClient } from '@tanstack/react-query';

import { api } from '/@/renderer/api';
import { muboxKeys } from '/@/renderer/features/mubox/api/mubox-api';
import { TracksResponse } from '/@/renderer/features/mubox/api/types';
import { useAuthStore } from '/@/renderer/store/auth.store';

/**
 * mubox asks Navidrome for a rescan about 3 s after a removal (trash, undo of a trash, removed copy) and
 * about 60 s after the last edit. Feishin's own lists keep the old data until that scan has finished.
 */
export const NAVIDROME_REMOVAL_DELAY_MS = 3_500;
export const NAVIDROME_EDIT_DELAY_MS = 62_000;

const SCAN_POLL_MS = 1_500;
const SCAN_POLL_MAX = 40;

// Feishin keys its server data as [serverId, resource, ...]
const FEISHIN_RESOURCES = new Set([
    'albumArtists',
    'albums',
    'artists',
    'genres',
    'playlists',
    'search',
    'songs',
]);

interface AfterChangeOptions {
    /** a change that removes or restores files: the scan starts almost at once */
    fast?: boolean;
    /** video ids that are gone now: dropped from mubox's lists without waiting for a refetch */
    removed?: string[];
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Refresh what a mubox change made out of date: mubox's own data now, Feishin's lists once the rescan is done. */
export function afterMuboxChange(queryClient: QueryClient, options: AfterChangeOptions = {}) {
    if (options.removed?.length) dropFromMuboxLists(queryClient, options.removed);

    queryClient.invalidateQueries({ queryKey: muboxKeys.tracksAll() });
    queryClient.invalidateQueries({ queryKey: muboxKeys.albums() });
    queryClient.invalidateQueries({ queryKey: muboxKeys.lastBatch() });

    const serverId = useAuthStore.getState().currentServer?.id ?? '';
    const delay = options.fast ? NAVIDROME_REMOVAL_DELAY_MS : NAVIDROME_EDIT_DELAY_MS;

    setTimeout(async () => {
        if (serverId) await waitForScan(serverId);
        refreshFeishin(queryClient);
    }, delay);
}

function dropFromMuboxLists(queryClient: QueryClient, removed: string[]) {
    const gone = new Set(removed);
    queryClient.setQueriesData<InfiniteData<TracksResponse, number>>(
        { queryKey: muboxKeys.tracksAll() },
        (data) => {
            if (!data) return data;
            return {
                ...data,
                pages: data.pages.map((page) => {
                    const items = page.items.filter((track) => !gone.has(track.video_id));
                    return {
                        ...page,
                        items,
                        total: Math.max(0, page.total - (page.items.length - items.length)),
                    };
                }),
            };
        },
    );
}

function refreshFeishin(queryClient: QueryClient) {
    queryClient.invalidateQueries({
        predicate: (query) =>
            query.queryKey[0] !== muboxKeys.all[0] &&
            typeof query.queryKey[1] === 'string' &&
            FEISHIN_RESOURCES.has(query.queryKey[1]),
    });
}

/** Wait until Navidrome reports that no scan is running. Gives up quietly: the refetch then runs anyway. */
async function waitForScan(serverId: string) {
    for (let i = 0; i < SCAN_POLL_MAX; i += 1) {
        try {
            const status = await api.controller.getScanStatus({ apiClientProps: { serverId } });
            if (!status.scanning) return;
        } catch {
            return;
        }
        await wait(SCAN_POLL_MS);
    }
}
