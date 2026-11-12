import isElectron from 'is-electron';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import '/@/renderer/features/mubox/i18n/register';
import { offlineKey, useOfflineStore } from '/@/renderer/features/offline/offline-store';
import { ContextMenu } from '/@/shared/components/context-menu/context-menu';
import { toast } from '/@/shared/components/toast/toast';
import { QueueSong, Song } from '/@/shared/types/domain-types';

interface ShowInFileExplorerActionProps {
    items: QueueSong[] | Song[];
}

const utils = isElectron() ? window.api.utils : null;

/**
 * Shows a song's offline copy in the file manager. Only for songs kept offline: the server's own
 * file path means nothing on this device when the music lives on the server (upstream Feishin
 * opened that path, which only worked when the music folder was on the same computer).
 */
export const ShowInFileExplorerAction = ({ items }: ShowInFileExplorerActionProps) => {
    const { t } = useTranslation();
    const first = items[0];
    const keptFile = useOfflineStore((state) =>
        first ? state.entries[offlineKey(first._serverId, first.id)]?.file : undefined,
    );

    const onSelect = useCallback(async () => {
        if (!utils || !keptFile) return;

        try {
            await utils.openItem(keptFile);
        } catch (error) {
            toast.error({
                message: (error as Error).message,
                title: t('error.openError'),
            });
        }
    }, [keptFile, t]);

    if (!utils || !keptFile) {
        return null;
    }

    return (
        <ContextMenu.Item disabled={items.length > 1} leftIcon="folder" onSelect={onSelect}>
            {t('mubox.offline.showCopy')}
        </ContextMenu.Item>
    );
};
