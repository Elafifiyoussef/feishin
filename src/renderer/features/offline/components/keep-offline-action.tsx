import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { keepSongsOffline } from '/@/renderer/features/offline/offline-keep';
import {
    isOfflineSupported,
    offlineKey,
    removeKept,
    useOfflineStore,
} from '/@/renderer/features/offline/offline-store';
import { getAlbumSongsById, getPlaylistSongsById } from '/@/renderer/features/player/utils';
import { useCurrentServerId } from '/@/renderer/store';
import { ContextMenu } from '/@/shared/components/context-menu/context-menu';
import { toast } from '/@/shared/components/toast/toast';
import { Song } from '/@/shared/types/domain-types';

interface KeepOfflineActionProps {
    /** keep the songs of these albums */
    albumIds?: string[];
    /** keep the songs of these playlists */
    playlistIds?: string[];
    /** keep these songs */
    songs?: Song[];
}

/** "Keep offline" for songs, albums and playlists: copies them into the app's own folder (desktop only). */
export const KeepOfflineAction = ({ albumIds, playlistIds, songs }: KeepOfflineActionProps) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const serverId = useCurrentServerId();
    const entries = useOfflineStore((state) => state.entries);

    const keptKeys = (() => {
        if (songs) {
            return songs
                .map((song) => offlineKey(song._serverId, song.id))
                .filter((key) => entries[key]);
        }
        if (albumIds) {
            return Object.values(entries)
                .filter((entry) => albumIds.includes(String(entry.song.albumId)))
                .map((entry) => entry.key);
        }
        return [];
    })();
    // for songs, "remove" replaces "keep" once every one of them is kept
    const allKept = Boolean(songs) && songs!.length > 0 && keptKeys.length === songs!.length;

    const keep = useCallback(async () => {
        try {
            let toKeep: Song[] = songs ?? [];
            if (albumIds?.length) {
                const res = await getAlbumSongsById({ id: albumIds, queryClient, serverId });
                toKeep = res.items;
            } else if (playlistIds?.length) {
                const lists = await Promise.all(
                    playlistIds.map((id) => getPlaylistSongsById({ id, queryClient, serverId })),
                );
                toKeep = lists.flatMap((list) => list?.items ?? []);
            }
            await keepSongsOffline(toKeep);
        } catch (error) {
            toast.error({ message: (error as Error)?.message ?? String(error) });
        }
    }, [albumIds, playlistIds, queryClient, serverId, songs]);

    if (!isOfflineSupported) return null;

    return (
        <>
            {!allKept && (
                <ContextMenu.Item leftIcon="cache" onSelect={keep}>
                    {t('mubox.offline.keep')}
                </ContextMenu.Item>
            )}
            {keptKeys.length > 0 && (
                <ContextMenu.Item leftIcon="delete" onSelect={() => removeKept({ keys: keptKeys })}>
                    {t('mubox.offline.removeCopy')}
                </ContextMenu.Item>
            )}
        </>
    );
};
