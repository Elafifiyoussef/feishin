import { useTranslation } from 'react-i18next';

import { useIsKept } from '/@/renderer/features/offline/offline-store';
import { Icon } from '/@/shared/components/icon/icon';
import { Song } from '/@/shared/types/domain-types';

/** Small "kept offline" mark after a song title. Renders nothing for songs that are not kept (and on the web). */
export const OfflineBadge = ({ song }: { song: Pick<Song, '_serverId' | 'id'> | undefined }) => {
    const { t } = useTranslation();
    const isKept = useIsKept(song);

    if (!isKept) return null;

    return (
        <span
            aria-label={t('mubox.offline.kept')}
            style={{ display: 'inline-flex', marginLeft: 'var(--theme-spacing-xs)' }}
            title={t('mubox.offline.kept')}
        >
            <Icon color="muted" icon="cache" size="sm" />
        </span>
    );
};
