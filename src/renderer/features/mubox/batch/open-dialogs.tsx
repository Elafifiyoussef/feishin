import { closeModal, openModal, updateModal } from '@mantine/modals';
import i18n from 'i18next';

import { LastBatch } from '/@/renderer/features/mubox/api/types';
import { AlbumDialogBody } from '/@/renderer/features/mubox/batch/album-dialog';
import { BatchDialogBody } from '/@/renderer/features/mubox/batch/batch-dialog';
import { EditTagsDialogBody } from '/@/renderer/features/mubox/batch/edit-tags-dialog';
import { UndoDialogBody } from '/@/renderer/features/mubox/batch/undo-dialog';
import '/@/renderer/features/mubox/i18n/register';
import { BatchActionKey } from '/@/renderer/features/mubox/lib/batch';

let counter = 0;

/** While a batch runs the dialog must not be closable (Escape, the X, a click outside). */
const lockWhileBusy = (modalId: string) => (busy: boolean) =>
    updateModal({ closeOnEscape: !busy, modalId, withCloseButton: !busy });

/** "Edit album" for the selected tracks: set a name, use the track titles, a playlist, or clear it. */
export function openAlbumDialog(options: { onDone?: () => void; selectedIds: string[] }) {
    const { onDone, selectedIds } = options;
    const modalId = `mubox-album-${(counter += 1)}`;
    const count = selectedIds.length;

    openModal({
        children: (
            <AlbumDialogBody
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
                ? i18n.t('mubox.batch.dialog.albumTitleOne')
                : i18n.t('mubox.batch.dialog.albumTitle', { count }),
    });
}

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
    const modalId = `mubox-batch-${(counter += 1)}`;
    const action = i18n.t(`mubox.batch.names.${actionKey}`);
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
                ? i18n.t('mubox.batch.dialog.titleOne', { action })
                : i18n.t('mubox.batch.dialog.title', { action, count }),
    });
}

/** Edit the tags of one track (a mubox video id). */
export function openEditTagsDialog(videoId: string) {
    const modalId = `mubox-tags-${(counter += 1)}`;
    openModal({
        children: <EditTagsDialogBody onClose={() => closeModal(modalId)} videoId={videoId} />,
        closeOnClickOutside: false,
        modalId,
        title: i18n.t('mubox.editTags.title'),
    });
}

export function openUndoDialog(options: { last: LastBatch; onDone?: () => void }) {
    const { last, onDone } = options;
    const modalId = `mubox-undo-${(counter += 1)}`;

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
        title: i18n.t('mubox.batch.undo.title'),
    });
}
