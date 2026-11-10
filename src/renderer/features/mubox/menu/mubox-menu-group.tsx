import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
    openAlbumDialog,
    openBatchDialog,
    openEditTagsDialog,
} from '/@/renderer/features/mubox/batch/open-dialogs';
import { openCoverEditor } from '/@/renderer/features/mubox/cover/cover-actions';
import { useMuboxAccess } from '/@/renderer/features/mubox/hooks/use-mubox-access';
import '/@/renderer/features/mubox/i18n/register';
import { BatchActionKey } from '/@/renderer/features/mubox/lib/batch';
import { resolveVideoIds } from '/@/renderer/features/mubox/lib/video-id';
import { getAlbumSongsById } from '/@/renderer/features/player/utils';
import { useAuthStore } from '/@/renderer/store/auth.store';
import { ContextMenu } from '/@/shared/components/context-menu/context-menu';
import { toast } from '/@/shared/components/toast/toast';

interface MuboxMenuGroupProps {
    /** Albums the menu was opened for: their songs are fetched when an action is picked. */
    albumIds?: string[];
    /** The album's name when the menu is for exactly one album (album cover actions use it). */
    albumName?: string;
    /** The songs the menu was opened for (one, or the whole selection). */
    songs?: { path?: null | string }[];
}

/**
 * "Edit in mubox" for Feishin's song and album context menus: change album, artist or date, or move to
 * trash, for the selected songs (or every song of the selected albums). Every action opens the same
 * preview first, and nothing is written until you confirm.
 * Any signed-in user may edit; "Move to trash" shows for admins only. Hidden on the desktop app and
 * on servers other than Navidrome.
 */
export const MuboxMenuGroup = ({ albumIds, albumName, songs }: MuboxMenuGroupProps) => {
    const { t } = useTranslation();
    const { isAdmin, isSupported } = useMuboxAccess();
    const queryClient = useQueryClient();
    const { ids, unresolved } = useMemo(() => resolveVideoIds(songs ?? []), [songs]);

    if (!isSupported) return null;

    /** The mubox video ids of the chosen albums' songs, or null (with a message) when there are none. */
    const albumVideoIds = async () => {
        try {
            const serverId = useAuthStore.getState().currentServer?.id ?? '';
            const res = await getAlbumSongsById({ id: albumIds ?? [], queryClient, serverId });
            const resolved = resolveVideoIds(res?.items ?? []);
            if (resolved.ids.length > 0) return resolved.ids;
            toast.warn({ message: t('mubox.menu.noTracks') });
        } catch {
            toast.error({ message: t('mubox.menu.noTracks') });
        }
        return null;
    };

    const run = (actionKey: BatchActionKey) => async () => {
        const selectedIds = albumIds ? await albumVideoIds() : ids;
        if (selectedIds) openBatchDialog({ actionKey, selectedIds });
    };

    // name, track titles, playlist link and clear live together in one "Edit album" dialog
    const editAlbum = async () => {
        const selectedIds = albumIds ? await albumVideoIds() : ids;
        if (selectedIds) openAlbumDialog({ selectedIds });
    };

    // the cover editor works on one song (with its copies) or one whole album
    const canEditCover = albumIds
        ? albumIds.length === 1 && Boolean(albumName)
        : ids.length === 1 && unresolved === 0;

    const editCover = async () => {
        if (!albumIds) return openCoverEditor({ kind: 'track', videoId: ids[0] });
        // an album starts from its first song's cover
        const albumIdsResolved = await albumVideoIds();
        if (albumIdsResolved && albumName) {
            openCoverEditor({ album: albumName, kind: 'album', videoId: albumIdsResolved[0] });
        }
    };

    const disabled = albumIds ? albumIds.length === 0 : ids.length === 0;

    return (
        <ContextMenu.Submenu isCloseDisabled>
            <ContextMenu.SubmenuTarget>
                <ContextMenu.Item
                    disabled={disabled}
                    leftIcon="edit"
                    // a click on the submenu entry must not close the whole menu
                    onSelect={(event) => event.preventDefault()}
                    rightIcon="arrowRightS"
                >
                    {t('mubox.menu.title')}
                </ContextMenu.Item>
            </ContextMenu.SubmenuTarget>
            <ContextMenu.SubmenuContent>
                {!albumIds && unresolved > 0 && (
                    <ContextMenu.Label>
                        {t('mubox.menu.notMubox', { count: unresolved })}
                    </ContextMenu.Label>
                )}
                {!albumIds && ids.length === 1 && unresolved === 0 && (
                    <>
                        <ContextMenu.Item
                            leftIcon="edit"
                            onSelect={() => openEditTagsDialog(ids[0])}
                        >
                            {t('mubox.editTags.title')}…
                        </ContextMenu.Item>
                        <ContextMenu.Divider />
                    </>
                )}
                <ContextMenu.Item leftIcon="album" onSelect={editAlbum}>
                    {t('mubox.batch.actions.albumEdit')}
                </ContextMenu.Item>
                <ContextMenu.Item leftIcon="artist" onSelect={run('artist')}>
                    {t('mubox.batch.actions.artist')}
                </ContextMenu.Item>
                <ContextMenu.Item leftIcon="duration" onSelect={run('date')}>
                    {t('mubox.batch.actions.date')}
                </ContextMenu.Item>
                {canEditCover && (
                    <>
                        <ContextMenu.Divider />
                        <ContextMenu.Item leftIcon="image" onSelect={editCover}>
                            {t('mubox.cover.edit')}
                        </ContextMenu.Item>
                    </>
                )}
                {/* deleting is admin only in mubox */}
                {isAdmin && (
                    <>
                        <ContextMenu.Divider />
                        <ContextMenu.Item leftIcon="delete" onSelect={run('delete')}>
                            {t('mubox.batch.actions.trash')}
                        </ContextMenu.Item>
                    </>
                )}
            </ContextMenu.SubmenuContent>
        </ContextMenu.Submenu>
    );
};
