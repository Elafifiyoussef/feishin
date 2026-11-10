import { closeModal, openModal } from '@mantine/modals';
import { useQueryClient } from '@tanstack/react-query';
import i18n from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getMuboxErrorMessage } from '/@/renderer/features/mubox/api/client';
import { muboxKeys, purgeTrash } from '/@/renderer/features/mubox/api/mubox-api';
import '/@/renderer/features/mubox/i18n/register';
import { ConfirmModal } from '/@/shared/components/modal/modal';
import { Text } from '/@/shared/components/text/text';
import { toast } from '/@/shared/components/toast/toast';

const formatSize = (bytes: number) =>
    bytes >= 1024 ** 3
        ? `${(bytes / 1024 ** 3).toFixed(1)} GB`
        : `${(bytes / 1024 ** 2).toFixed(1)} MB`;

interface PurgeTarget {
    /** how many tracks, for the message */
    count: number;
    /** `all` empties the trash; otherwise only these tracks */
    ids?: string[];
    /** bytes about to be freed */
    size?: number;
}

const PurgeDialogBody = ({
    modalId,
    onDone,
    target,
}: {
    modalId: string;
    onDone?: () => void;
    target: PurgeTarget;
}) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);

    const run = async () => {
        setLoading(true);
        try {
            const result = await purgeTrash(target.ids ? { video_ids: target.ids } : { all: true });
            if (result.purged.length > 0) {
                toast.success({
                    message: t('mubox.trash.purge.done', {
                        count: result.purged.length,
                        size: formatSize(result.freed),
                    }),
                });
            }
            if (result.failed.length > 0) {
                toast.error({
                    message: t('mubox.trash.purge.failed', { count: result.failed.length }),
                });
            }
            queryClient.invalidateQueries({ queryKey: muboxKeys.trash() });
            onDone?.();
            closeModal(modalId);
        } catch (error) {
            toast.error({ message: getMuboxErrorMessage(error) });
            setLoading(false);
        }
    };

    return (
        <ConfirmModal
            labels={{
                cancel: t('mubox.trash.purge.cancel'),
                confirm: t('mubox.trash.purge.confirm'),
            }}
            loading={loading}
            onCancel={() => closeModal(modalId)}
            onConfirm={run}
        >
            <div
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--theme-spacing-sm)' }}
            >
                <Text>
                    {t('mubox.trash.purge.body', {
                        count: target.count,
                        size: target.size ? ` (${formatSize(target.size)})` : '',
                    })}
                </Text>
                <Text isMuted size="sm">
                    {t('mubox.trash.purge.note')}
                </Text>
            </div>
        </ConfirmModal>
    );
};

let counter = 0;

/** Asks before erasing trashed tracks for good. Nothing is deleted until the user confirms. */
export function openPurgeDialog(target: PurgeTarget, onDone?: () => void) {
    const modalId = `mubox-purge-${(counter += 1)}`;
    openModal({
        children: <PurgeDialogBody modalId={modalId} onDone={onDone} target={target} />,
        closeOnClickOutside: false,
        modalId,
        title: i18n.t(target.ids ? 'mubox.trash.purge.title' : 'mubox.trash.purge.titleAll'),
    });
}
