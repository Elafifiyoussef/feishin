import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { openBatchDialog, openEditTagsDialog } from '/@/renderer/features/lubox/batch/open-dialogs';
import { useLuboxAccess } from '/@/renderer/features/lubox/hooks/use-lubox-access';
import '/@/renderer/features/lubox/i18n/register';
import { BatchActionKey } from '/@/renderer/features/lubox/lib/batch';
import { resolveVideoIds } from '/@/renderer/features/lubox/lib/video-id';
import { getAlbumSongsById } from '/@/renderer/features/player/utils';
import { useAuthStore } from '/@/renderer/store/auth.store';
import { ContextMenu } from '/@/shared/components/context-menu/context-menu';
import { toast } from '/@/shared/components/toast/toast';

interface LuboxMenuGroupProps {
    /** Albums the menu was opened for: their songs are fetched when an action is picked. */
    albumIds?: string[];
    /** The songs the menu was opened for (one, or the whole selection). */
    songs?: { path?: null | string }[];
}

/**
 * "Edit in lubox" for Feishin's song and album context menus: change album, artist or date, or move to
 * trash, for the selected songs (or every song of the selected albums). Every action opens the same
 * preview first, and nothing is written until you confirm.
 * Any signed-in user may edit; "Move to trash" shows for admins only. Hidden on the desktop app and
 * on servers other than Navidrome.
 */
export const LuboxMenuGroup = ({ albumIds, songs }: LuboxMenuGroupProps) => {
    const { t } = useTranslation();
    const { isAdmin, isSupported } = useLuboxAccess();
    const queryClient = useQueryClient();
    const { ids, unresolved } = useMemo(() => resolveVideoIds(songs ?? []), [songs]);

    if (!isSupported) return null;

    const run = (actionKey: BatchActionKey) => async () => {
        if (!albumIds) return openBatchDialog({ actionKey, selectedIds: ids });

        try {
            const serverId = useAuthStore.getState().currentServer?.id ?? '';
            const res = await getAlbumSongsById({ id: albumIds, queryClient, serverId });
            const resolved = resolveVideoIds(res?.items ?? []);
            if (resolved.ids.length === 0) {
                toast.warn({ message: t('lubox.menu.noTracks') });
                return;
            }
            openBatchDialog({ actionKey, selectedIds: resolved.ids });
        } catch {
            toast.error({ message: t('lubox.menu.noTracks') });
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
                    {t('lubox.menu.title')}
                </ContextMenu.Item>
            </ContextMenu.SubmenuTarget>
            <ContextMenu.SubmenuContent>
                {!albumIds && unresolved > 0 && (
                    <ContextMenu.Label>
                        {t('lubox.menu.notLubox', { count: unresolved })}
                    </ContextMenu.Label>
                )}
                {!albumIds && ids.length === 1 && unresolved === 0 && (
                    <>
                        <ContextMenu.Item
                            leftIcon="edit"
                            onSelect={() => openEditTagsDialog(ids[0])}
                        >
                            {t('lubox.editTags.title')}…
                        </ContextMenu.Item>
                        <ContextMenu.Divider />
                    </>
                )}
                <ContextMenu.Item leftIcon="album" onSelect={run('album')}>
                    {t('lubox.batch.actions.albumSet')}
                </ContextMenu.Item>
                <ContextMenu.Item leftIcon="artist" onSelect={run('artist')}>
                    {t('lubox.batch.actions.artist')}
                </ContextMenu.Item>
                <ContextMenu.Item leftIcon="duration" onSelect={run('date')}>
                    {t('lubox.batch.actions.date')}
                </ContextMenu.Item>
                <ContextMenu.Divider />
                <ContextMenu.Item leftIcon="itemSong" onSelect={run('single')}>
                    {t('lubox.batch.actions.albumSingle')}
                </ContextMenu.Item>
                <ContextMenu.Item leftIcon="playlist" onSelect={run('playlist')}>
                    {t('lubox.batch.actions.albumFromPlaylist')}
                </ContextMenu.Item>
                <ContextMenu.Item leftIcon="circleSlash" onSelect={run('clear')}>
                    {t('lubox.batch.actions.albumClear')}
                </ContextMenu.Item>
                {/* deleting is admin only in lubox */}
                {isAdmin && (
                    <>
                        <ContextMenu.Divider />
                        <ContextMenu.Item leftIcon="delete" onSelect={run('delete')}>
                            {t('lubox.batch.actions.trash')}
                        </ContextMenu.Item>
                    </>
                )}
            </ContextMenu.SubmenuContent>
        </ContextMenu.Submenu>
    );
};
