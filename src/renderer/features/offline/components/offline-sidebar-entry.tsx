import { useTranslation } from 'react-i18next';

import { openOfflineManager } from '/@/renderer/features/offline/components/offline-dialog';
import { setOfflineMode, useOfflineStore } from '/@/renderer/features/offline/offline-store';
import { CollapsedSidebarItem } from '/@/renderer/features/sidebar/components/collapsed-sidebar-item';
import styles from '/@/renderer/features/sidebar/components/sidebar-item.module.css';
import { Button } from '/@/shared/components/button/button';
import { Group } from '/@/shared/components/group/group';
import { Icon } from '/@/shared/components/icon/icon';
import { Switch } from '/@/shared/components/switch/switch';

/** "Offline library" in the sidebar: the switch turns it on and off, the row opens the manager. */
export const OfflineSidebarEntry = () => {
    const { t } = useTranslation();
    const offlineMode = useOfflineStore((state) => state.offlineMode);
    const hasKept = useOfflineStore((state) => Object.keys(state.entries).length > 0);

    return (
        <Button
            className={`${styles.root} ${styles.link}`}
            classNames={{ inner: styles.inner, label: styles.label }}
            onClick={openOfflineManager}
            variant="subtle"
        >
            <Group gap="md" justify="space-between" w="100%" wrap="nowrap">
                <Group gap="md" wrap="nowrap">
                    <Icon icon="server" />
                    {t('mubox.offline.title')}
                </Group>
                <span onClick={(event) => event.stopPropagation()}>
                    <Switch
                        aria-label={t('mubox.offline.mode')}
                        checked={offlineMode}
                        disabled={!hasKept && !offlineMode}
                        onChange={(event) => setOfflineMode(event.currentTarget.checked)}
                        size="xs"
                    />
                </span>
            </Group>
        </Button>
    );
};

export const OfflineCollapsedEntry = () => {
    const { t } = useTranslation();
    const offlineMode = useOfflineStore((state) => state.offlineMode);

    return (
        <CollapsedSidebarItem
            activeIcon={<Icon color="primary" icon="server" size="2xl" />}
            icon={<Icon color={offlineMode ? 'primary' : 'muted'} icon="server" size="2xl" />}
            label={t('mubox.offline.title')}
            onClick={openOfflineManager}
        />
    );
};
