import { closeModal, openModal, updateModal } from '@mantine/modals';
import i18n from 'i18next';

import { LastBatch } from '/@/renderer/features/lubox/api/types';
import { BatchDialogBody } from '/@/renderer/features/lubox/batch/batch-dialog';
import { UndoDialogBody } from '/@/renderer/features/lubox/batch/undo-dialog';
import '/@/renderer/features/lubox/i18n/register';
import { BatchActionKey } from '/@/renderer/features/lubox/lib/batch';

let counter = 0;

/** While a batch runs the dialog must not be closable (Escape, the X, a click outside). */
const lockWhileBusy = (modalId: string) => (busy: boolean) =>
    updateModal({ closeOnEscape: !busy, modalId, withCloseButton: !busy });

/**
 * Opens a batch action (preview, apply, undo) in Feishin's modal manager, so it works from anywhere,
 * including a context menu that closes the moment you pick an item.
 */
export function openBatchDialog(options: {
    actionKey: BatchActionKey;
    onDone?: () => void;
    selectedIds: string[];
}) {
    const { actionKey, onDone, selectedIds } = options;
    const modalId = `lubox-batch-${(counter += 1)}`;
    const action = i18n.t(`lubox.batch.names.${actionKey}`);
    const count = selectedIds.length;

    openModal({
        children: (
            <BatchDialogBody
                actionKey={actionKey}
                onBusyChange={lockWhileBusy(modalId)}
                onClose={() => closeModal(modalId)}
                onDone={onDone}
                selectedIds={selectedIds}
            />
        ),
        closeOnClickOutside: false,
        modalId,
        size: 'lg',
        title:
            count === 1
                ? i18n.t('lubox.batch.dialog.titleOne', { action })
                : i18n.t('lubox.batch.dialog.title', { action, count }),
    });
}

export function openUndoDialog(options: { last: LastBatch; onDone?: () => void }) {
    const { last, onDone } = options;
    const modalId = `lubox-undo-${(counter += 1)}`;

    openModal({
        children: (
            <UndoDialogBody
                last={last}
                onBusyChange={lockWhileBusy(modalId)}
                onClose={() => closeModal(modalId)}
                onDone={onDone}
            />
        ),
        closeOnClickOutside: false,
        modalId,
        title: i18n.t('lubox.batch.undo.title'),
    });
}
