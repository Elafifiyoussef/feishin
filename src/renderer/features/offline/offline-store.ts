import i18n from 'i18next';
import isElectron from 'is-electron';
import { createWithEqualityFn } from 'zustand/traditional';

import '/@/renderer/features/mubox/i18n/register';
import { queryClient } from '/@/renderer/lib/react-query';
import { toast } from '/@/shared/components/toast/toast';
import { Song } from '/@/shared/types/domain-types';
import { OfflineEntry, OfflineProgress, offlineUrl } from '/@/shared/types/offline-types';

/**
 * Renderer side of "Keep offline" (desktop only). The index lives in the main process
 * (features/core/offline); this store mirrors it so lists, the player and the offline API
 * controller (api/offline) can ask synchronously.
 */

export const offlineBridge = isElectron() ? window.api?.offline : null;

interface OfflineState {
    entries: Record<string, OfflineEntry>;
    job: null | OfflineProgress;
    /** The normal pages read the kept songs instead of the server (api/offline). */
    offlineMode: boolean;
}

export const useOfflineStore = createWithEqualityFn<OfflineState>()(() => ({
    entries: {},
    job: null,
    offlineMode: false,
}));

export const isOfflineSupported = Boolean(offlineBridge);

export const offlineKey = (serverId: string, songId: string) => `${serverId}/${songId}`;

export const getOfflineEntry = (song: Pick<Song, '_serverId' | 'id'>) =>
    useOfflineStore.getState().entries[offlineKey(song._serverId, song.id)];

export const isOfflineMode = () => useOfflineStore.getState().offlineMode;

export const hasKeptSongs = (serverId?: string) =>
    Object.values(useOfflineStore.getState().entries).some(
        (entry) => !serverId || entry.serverId === serverId,
    );

export const useIsKept = (song: Pick<Song, '_serverId' | 'id'> | undefined) =>
    useOfflineStore((state) =>
        song ? Boolean(state.entries[offlineKey(song._serverId, song.id)]) : false,
    );

/** A kept song as the player wants it: the cover comes from the local copy. */
export const entryToSong = (entry: OfflineEntry): Song => {
    const song = entry.song as Song;
    return {
        ...song,
        imageUrl: entry.cover ? offlineUrl('cover', entry.serverId, entry.songId) : song.imageUrl,
    };
};

/** Every kept song of one server, in no particular order. */
export const getKeptSongs = (serverId: string): Song[] =>
    Object.values(useOfflineStore.getState().entries)
        .filter((entry) => entry.serverId === serverId)
        .map(entryToSong);

// image id (a song's cover id, its album or one of its artists) -> a local cover, for images that only know an id
const coverIndex = new Map<string, string>();

/** Local cover for an image id of a kept song, album or artist, if one was saved. */
export const getOfflineCoverUrl = (serverId: string | undefined, id: string) =>
    serverId ? coverIndex.get(offlineKey(serverId, id)) : undefined;

const refresh = async () => {
    if (!offlineBridge) return;
    const list = await offlineBridge.list();
    coverIndex.clear();
    for (const entry of list) {
        if (!entry.cover) continue;
        const local = offlineUrl('cover', entry.serverId, entry.songId);
        const song = entry.song as Song;
        const ids = [
            song.imageId,
            song.albumId,
            ...(song.albumArtists ?? []).map((artist) => artist.id),
            ...(song.artists ?? []).map((artist) => artist.id),
        ];
        for (const id of ids) {
            const key = id ? offlineKey(entry.serverId, String(id)) : null;
            if (key && !coverIndex.has(key)) coverIndex.set(key, local);
        }
    }
    useOfflineStore.setState({
        entries: Object.fromEntries(list.map((entry) => [entry.key, entry])),
    });
    // in offline mode the pages show what is kept: refresh them when that changes
    if (isOfflineMode()) queryClient.invalidateQueries();
};

/** Turns the offline library on or off: the pages read the kept songs (or the server) from now on. */
export const setOfflineMode = (on: boolean) => {
    if (useOfflineStore.getState().offlineMode === on) return;
    useOfflineStore.setState({ offlineMode: on });
    queryClient.clear();
    queryClient.invalidateQueries();
};

const errorMessage = (progress: OfflineProgress) => {
    switch (progress.error) {
        case 'disk-full':
            return i18n.t('mubox.offline.errors.diskFull');
        case 'http':
            return i18n.t('mubox.offline.errors.http', { detail: progress.errorDetail });
        case 'unreachable':
            return i18n.t('mubox.offline.errors.unreachable');
        default:
            return i18n.t('mubox.offline.errors.unknown', { detail: progress.errorDetail });
    }
};

if (offlineBridge) {
    refresh();
    offlineBridge.onChange(refresh);
    offlineBridge.onProgress((progress) => {
        const finished = progress.status !== 'running';
        useOfflineStore.setState({ job: finished ? null : progress });
        if (!finished) return;
        if (progress.status === 'done') {
            toast.success({
                message: i18n.t('mubox.offline.done', {
                    count: progress.done - progress.skipped,
                    skipped: progress.skipped,
                }),
            });
        } else if (progress.status === 'canceled') {
            toast.info({ message: i18n.t('mubox.offline.canceled', { count: progress.done }) });
        } else {
            toast.error({ message: errorMessage(progress) });
        }
    });
}

export const cancelKeepOffline = () => {
    const job = useOfflineStore.getState().job;
    if (offlineBridge && job) offlineBridge.cancel(job.jobId);
};

export const removeKept = async (target: { all?: boolean; keys?: string[] }) => {
    if (!offlineBridge) return;
    const count = await offlineBridge.remove(target);
    toast.success({ message: i18n.t('mubox.offline.removed', { count }) });
};
