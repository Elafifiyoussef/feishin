import { closeModal, openModal } from '@mantine/modals';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';

import styles from './offline-dialog.module.css';

import '/@/renderer/features/mubox/i18n/register';
import {
    cancelKeepOffline,
    removeKept,
    setOfflineMode,
    useOfflineStore,
} from '/@/renderer/features/offline/offline-store';
import { Button } from '/@/shared/components/button/button';
import { Icon } from '/@/shared/components/icon/icon';
import { Stack } from '/@/shared/components/stack/stack';
import { Switch } from '/@/shared/components/switch/switch';
import { Text } from '/@/shared/components/text/text';

const formatSize = (bytes: number) =>
    bytes >= 1024 ** 3
        ? `${(bytes / 1024 ** 3).toFixed(1)} GB`
        : `${(bytes / 1024 ** 2).toFixed(1)} MB`;

const MODAL_ID = 'offline-manager';

const OfflineManager = () => {
    const { t } = useTranslation();
    const entries = useOfflineStore((state) => state.entries);
    const job = useOfflineStore((state) => state.job);
    const offlineMode = useOfflineStore((state) => state.offlineMode);

    const list = Object.values(entries);
    const totalSize = list.reduce((sum, entry) => sum + entry.size, 0);
    const fraction =
        job && job.total > 0
            ? (job.done + (job.bytesTotal > 0 ? job.bytes / job.bytesTotal : 0)) / job.total
            : 0;

    return (
        <Stack gap="lg">
            <Switch
                checked={offlineMode}
                description={t('mubox.offline.modeHint')}
                disabled={list.length === 0 && !offlineMode}
                label={t('mubox.offline.mode')}
                onChange={(event) => {
                    setOfflineMode(event.currentTarget.checked);
                    if (event.currentTarget.checked) closeModal(MODAL_ID);
                }}
            />

            {job && (
                <div className={styles.progress}>
                    <div className={styles.progressHead}>
                        <span>
                            {t('mubox.offline.progress', { done: job.done, total: job.total })}
                        </span>
                        <Button onClick={cancelKeepOffline} size="compact-sm" variant="default">
                            {t('common.cancel')}
                        </Button>
                    </div>
                    <div className={styles.bar}>
                        <div
                            className={styles.barFill}
                            style={{ width: `${Math.min(100, fraction * 100)}%` }}
                        />
                    </div>
                    <Text isMuted size="sm">
                        {job.current}
                    </Text>
                </div>
            )}

            <div className={styles.space}>
                <Text>
                    {t('mubox.offline.space', { count: list.length, size: formatSize(totalSize) })}
                </Text>
                <Button
                    color="red"
                    disabled={list.length === 0}
                    leftSection={<Icon icon="delete" />}
                    onClick={() => removeKept({ all: true })}
                    variant="default"
                >
                    {t('mubox.offline.removeAll')}
                </Button>
            </div>
            <Text isMuted size="sm">
                {t('mubox.offline.manageHint')}
            </Text>
        </Stack>
    );
};

/** Offline mode, copy progress, space used and "remove all" in one small dialog (desktop app). */
export const openOfflineManager = () => {
    openModal({
        children: <OfflineManager />,
        modalId: MODAL_ID,
        title: i18n.t('mubox.offline.title'),
    });
};
