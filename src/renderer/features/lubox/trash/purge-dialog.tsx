import { closeModal, openModal } from '@mantine/modals';
import { useQueryClient } from '@tanstack/react-query';
import i18n from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getLuboxErrorMessage } from '/@/renderer/features/lubox/api/client';
import { luboxKeys, purgeTrash } from '/@/renderer/features/lubox/api/lubox-api';
import '/@/renderer/features/lubox/i18n/register';
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
                    message: t('lubox.trash.purge.done', {
                        count: result.purged.length,
                        size: formatSize(result.freed),
                    }),
                });
            }
            if (result.failed.length > 0) {
                toast.error({
                    message: t('lubox.trash.purge.failed', { count: result.failed.length }),
                });
            }
            queryClient.invalidateQueries({ queryKey: luboxKeys.trash() });
            onDone?.();
            closeModal(modalId);
        } catch (error) {
            toast.error({ message: getLuboxErrorMessage(error) });
            setLoading(false);
        }
    };

    return (
        <ConfirmModal
            labels={{
                cancel: t('lubox.trash.purge.cancel'),
                confirm: t('lubox.trash.purge.confirm'),
            }}
            loading={loading}
            onCancel={() => closeModal(modalId)}
            onConfirm={run}
        >
            <div
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--theme-spacing-sm)' }}
            >
                <Text>
                    {t('lubox.trash.purge.body', {
                        count: target.count,
                        size: target.size ? ` (${formatSize(target.size)})` : '',
                    })}
                </Text>
                <Text isMuted size="sm">
                    {t('lubox.trash.purge.note')}
                </Text>
            </div>
        </ConfirmModal>
    );
};

let counter = 0;

/** Asks before erasing trashed tracks for good. Nothing is deleted until the user confirms. */
export function openPurgeDialog(target: PurgeTarget, onDone?: () => void) {
    const modalId = `lubox-purge-${(counter += 1)}`;
    openModal({
        children: <PurgeDialogBody modalId={modalId} onDone={onDone} target={target} />,
        closeOnClickOutside: false,
        modalId,
        title: i18n.t(target.ids ? 'lubox.trash.purge.title' : 'lubox.trash.purge.titleAll'),
    });
}
