import i18n from 'i18next';
import isElectron from 'is-electron';
import { nanoid } from 'nanoid/non-secure';
import { createWithEqualityFn } from 'zustand/traditional';

import { api } from '/@/renderer/api';
import '/@/renderer/features/mubox/i18n/register';
import { toast } from '/@/shared/components/toast/toast';
import { LibraryItem, Song } from '/@/shared/types/domain-types';
import {
    OfflineEntry,
    OfflineKeepItem,
    OfflineProgress,
    offlineUrl,
} from '/@/shared/types/offline-types';

/**
 * Renderer side of "Keep offline" (desktop only). The index lives in the main process
 * (features/core/offline); this store mirrors it so lists and the player can ask synchronously.
 */

const bridge = isElectron() ? window.api?.offline : null;

interface OfflineState {
    entries: Record<string, OfflineEntry>;
    job: null | OfflineProgress;
}

export const useOfflineStore = createWithEqualityFn<OfflineState>()(() => ({
    entries: {},
    job: null,
}));

export const isOfflineSupported = Boolean(bridge);

export const offlineKey = (serverId: string, songId: string) => `${serverId}/${songId}`;

export const getOfflineEntry = (song: Pick<Song, '_serverId' | 'id'>) =>
    useOfflineStore.getState().entries[offlineKey(song._serverId, song.id)];

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

// cover id (the song's image id or its album id) -> local cover, for images that only know an id
const coverIndex = new Map<string, string>();

/** Local cover for an image id of a kept song or album, if one was saved. */
export const getOfflineCoverUrl = (serverId: string | undefined, id: string) =>
    serverId ? coverIndex.get(offlineKey(serverId, id)) : undefined;

const refresh = async () => {
    if (!bridge) return;
    const list = await bridge.list();
    coverIndex.clear();
    for (const entry of list) {
        if (!entry.cover) continue;
        const local = offlineUrl('cover', entry.serverId, entry.songId);
        for (const id of [entry.song.imageId, entry.song.albumId]) {
            if (id) coverIndex.set(offlineKey(entry.serverId, String(id)), local);
        }
    }
    useOfflineStore.setState({
        entries: Object.fromEntries(list.map((entry) => [entry.key, entry])),
    });
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

if (bridge) {
    refresh();
    bridge.onChange(refresh);
    bridge.onProgress((progress) => {
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

let currentJobId: null | string = null;

/** Copies the songs that are not kept yet. One job at a time: songs wait their turn in the same job. */
export const keepSongsOffline = async (songs: Song[]) => {
    if (!bridge || songs.length === 0) return;
    const { entries } = useOfflineStore.getState();

    const items: OfflineKeepItem[] = songs
        .filter((song) => !entries[offlineKey(song._serverId, song.id)])
        .map((song) => ({
            coverKey: song.albumId || song.id,
            coverUrl:
                api.controller.getImageUrl({
                    apiClientProps: { serverId: song._serverId },
                    query: {
                        id: song.imageId || song.albumId || song.id,
                        itemType: LibraryItem.SONG,
                        size: 600,
                    },
                }) || null,
            downloadUrl: api.controller.getDownloadUrl({
                apiClientProps: { serverId: song._serverId },
                query: { id: song.id },
            }),
            serverId: song._serverId,
            song: song as unknown as Record<string, any>,
        }));

    if (items.length === 0) {
        toast.info({ message: i18n.t('mubox.offline.alreadyKept') });
        return;
    }
    if (useOfflineStore.getState().job) {
        toast.info({ message: i18n.t('mubox.offline.busy') });
        return;
    }

    currentJobId = nanoid();
    toast.info({ message: i18n.t('mubox.offline.started', { count: items.length }) });
    await bridge.keep(currentJobId, items);
};

export const cancelKeepOffline = () => {
    if (bridge && currentJobId) bridge.cancel(currentJobId);
};

export const removeKept = async (target: { all?: boolean; keys?: string[] }) => {
    if (!bridge) return;
    const count = await bridge.remove(target);
    toast.success({ message: i18n.t('mubox.offline.removed', { count }) });
};
