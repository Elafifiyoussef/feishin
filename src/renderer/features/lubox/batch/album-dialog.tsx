import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './batch.module.css';

import { BatchDialogBody } from '/@/renderer/features/lubox/batch/batch-dialog';
import { SegmentedControl } from '/@/shared/components/segmented-control/segmented-control';

/** The four ways to set the album, as tabs of one dialog. */
const MODES = ['album', 'single', 'playlist', 'clear'] as const;
interface AlbumDialogProps {
    onBusyChange?: (busy: boolean) => void;
    onClose: () => void;
    onDone?: () => void;
    selectedIds: string[];
}

type AlbumMode = (typeof MODES)[number];

/**
 * "Edit album": name it, use each track's title (singles), take it from a playlist link, or clear it.
 * Each tab is the usual batch flow (preview first, nothing is written until you confirm). Switching tab
 * starts that tab fresh; while a change is running the tabs are locked.
 */
export const AlbumDialogBody = ({
    onBusyChange,
    onClose,
    onDone,
    selectedIds,
}: AlbumDialogProps) => {
    const { t } = useTranslation();
    const [mode, setMode] = useState<AlbumMode>('album');
    const [busy, setBusy] = useState(false);

    const handleBusy = useCallback(
        (next: boolean) => {
            setBusy(next);
            onBusyChange?.(next);
        },
        [onBusyChange],
    );

    return (
        <div className={styles.body}>
            <SegmentedControl
                data={MODES.map((value) => ({
                    label: t(`lubox.batch.albumModes.${value}`),
                    value,
                }))}
                disabled={busy}
                fullWidth
                onChange={(value) => setMode(value as AlbumMode)}
                value={mode}
            />
            <BatchDialogBody
                actionKey={mode}
                key={mode}
                onBusyChange={handleBusy}
                onClose={onClose}
                onDone={onDone}
                selectedIds={selectedIds}
            />
        </div>
    );
};
