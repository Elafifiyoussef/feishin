import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './batch.module.css';

import { undoBatch } from '/@/renderer/features/lubox/api/lubox-api';
import { LastBatch } from '/@/renderer/features/lubox/api/types';
import { afterLuboxChange } from '/@/renderer/features/lubox/batch/after-change';
import { FailureList, plural, RunProgress } from '/@/renderer/features/lubox/batch/batch-parts';
import { Failure, runUndoChunked } from '/@/renderer/features/lubox/lib/batch';
import { Button } from '/@/shared/components/button/button';

interface UndoDialogProps {
    last: LastBatch;
    onBusyChange?: (busy: boolean) => void;
    onClose: () => void;
    onDone?: () => void;
}

/** Undo the last batch (lubox keeps one level, for the whole library). Says what it will undo first. */
export const UndoDialogBody = ({ last, onBusyChange, onClose, onDone }: UndoDialogProps) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [phase, setPhase] = useState<'confirm' | 'finished' | 'running'>('confirm');
    const [progress, setProgress] = useState({ done: 0, total: last.count });
    const [result, setResult] = useState<null | { failed: Failure[]; restored: number }>(null);

    const run = async () => {
        setPhase('running');
        const outcome = await runUndoChunked({
            onProgress: (done, total) => setProgress({ done, total }),
            total: last.count,
            undoChunk: () => undoBatch(25),
        });
        setResult(outcome);
        setPhase('finished');
        if (outcome.restored > 0) {
            afterLuboxChange(queryClient, { fast: last.kind === 'trash' });
            onDone?.();
        }
    };

    const busy = phase === 'running';
    useEffect(() => {
        onBusyChange?.(busy);
    }, [busy, onBusyChange]);

    return (
        <div className={styles.body}>
            {phase === 'confirm' && (
                <>
                    <div className={styles.plan}>
                        <p>
                            <strong>{last.label || t('lubox.batch.undo.unnamed')}</strong>
                            {' · '}
                            {plural(t, 'lubox.batch.undo.tracks', last.count)}
                        </p>
                        <p className={styles.note}>
                            {last.kind === 'trash'
                                ? t('lubox.batch.undo.trashHint')
                                : t('lubox.batch.undo.editHint')}
                        </p>
                    </div>
                    <div className={styles.footer}>
                        <Button onClick={onClose} variant="default">
                            {t('lubox.batch.dialog.cancel')}
                        </Button>
                        <Button onClick={run} variant="filled">
                            {t('lubox.batch.undo.confirm')}
                        </Button>
                    </div>
                </>
            )}
            {phase === 'running' && <RunProgress done={progress.done} total={progress.total} />}
            {phase === 'finished' && result && (
                <>
                    <div aria-live="polite" className={styles.plan}>
                        <p>
                            <strong>
                                {plural(t, 'lubox.batch.result.restored', result.restored)}
                            </strong>
                        </p>
                        {result.restored > 0 && (
                            <p className={styles.note}>{t('lubox.batch.result.restoredHint')}</p>
                        )}
                        <FailureList failures={result.failed} names={{}} />
                    </div>
                    <div className={styles.footer}>
                        <Button onClick={onClose} variant="filled">
                            {t('lubox.batch.dialog.close')}
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
};
