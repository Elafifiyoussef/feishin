import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { openBatchDialog } from '/@/renderer/features/lubox/batch/open-dialogs';
import { useLuboxAccess } from '/@/renderer/features/lubox/hooks/use-lubox-access';
import '/@/renderer/features/lubox/i18n/register';
import { BatchActionKey } from '/@/renderer/features/lubox/lib/batch';
import { resolveVideoIds } from '/@/renderer/features/lubox/lib/video-id';
import { ContextMenu } from '/@/shared/components/context-menu/context-menu';

interface LuboxMenuGroupProps {
    /** The songs the menu was opened for (one, or the whole selection). */
    songs: { path?: null | string }[];
}

/**
 * "Edit in lubox" for Feishin's song context menu: change album, artist or date, or move to trash, for
 * the selected songs. Every action opens the same preview first, and nothing is written until you confirm.
 * Shows nothing unless the current user may manage lubox (admin, web build, Navidrome).
 */
export const LuboxMenuGroup = ({ songs }: LuboxMenuGroupProps) => {
    const { t } = useTranslation();
    const { canManage } = useLuboxAccess();
    const { ids, unresolved } = useMemo(() => resolveVideoIds(songs), [songs]);

    if (!canManage) return null;

    const run = (actionKey: BatchActionKey) => () =>
        openBatchDialog({ actionKey, selectedIds: ids });

    return (
        <ContextMenu.Submenu isCloseDisabled>
            <ContextMenu.SubmenuTarget>
                <ContextMenu.Item
                    disabled={ids.length === 0}
                    leftIcon="edit"
                    // a click on the submenu entry must not close the whole menu
                    onSelect={(event) => event.preventDefault()}
                    rightIcon="arrowRightS"
                >
                    {t('lubox.menu.title')}
                </ContextMenu.Item>
            </ContextMenu.SubmenuTarget>
            <ContextMenu.SubmenuContent>
                {unresolved > 0 && (
                    <ContextMenu.Label>
                        {t('lubox.menu.notLubox', { count: unresolved })}
                    </ContextMenu.Label>
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
                <ContextMenu.Divider />
                <ContextMenu.Item leftIcon="delete" onSelect={run('delete')}>
                    {t('lubox.batch.actions.trash')}
                </ContextMenu.Item>
            </ContextMenu.SubmenuContent>
        </ContextMenu.Submenu>
    );
};
