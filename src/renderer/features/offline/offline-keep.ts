import i18n from 'i18next';
import { nanoid } from 'nanoid/non-secure';

import { api } from '/@/renderer/api';
import {
    isOfflineMode,
    offlineBridge,
    offlineKey,
    useOfflineStore,
} from '/@/renderer/features/offline/offline-store';
import { toast } from '/@/shared/components/toast/toast';
import { LibraryItem, Song } from '/@/shared/types/domain-types';
import { OfflineKeepItem } from '/@/shared/types/offline-types';

/** Copies the songs that are not kept yet (needs the server, so not while the offline library is on). */
export const keepSongsOffline = async (songs: Song[]) => {
    if (!offlineBridge || songs.length === 0) return;
    if (isOfflineMode()) {
        toast.info({ message: i18n.t('mubox.offline.needsServer') });
        return;
    }
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

    toast.info({ message: i18n.t('mubox.offline.started', { count: items.length }) });
    await offlineBridge.keep(nanoid(), items);
};
