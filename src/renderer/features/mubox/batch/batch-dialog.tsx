import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './batch.module.css';

import { getMuboxErrorMessage } from '/@/renderer/features/mubox/api/client';
import {
    applyBatch,
    fetchLastBatch,
    muboxQueries,
    planBatch,
    trashBatch,
    undoBatch,
} from '/@/renderer/features/mubox/api/mubox-api';
import { BatchPlan } from '/@/renderer/features/mubox/api/types';
import { afterMuboxChange } from '/@/renderer/features/mubox/batch/after-change';
import {
    FailureList,
    PlanSamples,
    plural,
    RunProgress,
    SkippedLine,
} from '/@/renderer/features/mubox/batch/batch-parts';
import {
    BatchActionKey,
    batchLabel,
    buildAction,
    Failure,
    isAutoAction,
    runChunked,
    runUndoChunked,
} from '/@/renderer/features/mubox/lib/batch';
import { Autocomplete } from '/@/shared/components/autocomplete/autocomplete';
import { Button } from '/@/shared/components/button/button';
import { TextInput } from '/@/shared/components/text-input/text-input';

const PLAN_DEBOUNCE_MS = 400;

const newBatchId = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface BatchDialogProps {
    actionKey: BatchActionKey;
    onBusyChange?: (busy: boolean) => void;
    onClose: () => void;
    /** Called once something changed, for page-specific cleanup such as clearing a selection. */
    onDone?: () => void;
    selectedIds: string[];
}

interface Finished {
    batchId: string;
    done: number;
    failed: Failure[];
    stoppedAt: null | number;
}

type Phase = 'edit' | 'finished' | 'running';

/**
 * One batch action: type the value, read the preview (nothing is written until you confirm),
 * apply in chunks with progress and a Stop button, then see what happened. Mount it per action.
 */
export const BatchDialogBody = ({
    actionKey,
    onBusyChange,
    onClose,
    onDone,
    selectedIds,
}: BatchDialogProps) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    // a trash removes the tracks from mubox's lists at once; Feishin's follow after the quick rescan
    const onChanged = (removed?: string[]) => {
        afterMuboxChange(queryClient, { fast: actionKey === 'delete', removed });
        onDone?.();
    };
    const { data: albums } = useQuery({
        ...muboxQueries.albums(),
        enabled: actionKey === 'album',
    });

    const isTrash = actionKey === 'delete';
    const [value, setValue] = useState('');
    const [plan, setPlan] = useState<BatchPlan | null>(null);
    const [planning, setPlanning] = useState(false);
    const [planError, setPlanError] = useState('');
    const [phase, setPhase] = useState<Phase>('edit');
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [finished, setFinished] = useState<Finished | null>(null);
    const [undoGone, setUndoGone] = useState(false);
    // set once this batch was undone from the result view: how many tracks were put back
    const [undone, setUndone] = useState<null | number>(null);
    const [undoing, setUndoing] = useState(false);

    const seq = useRef(0);
    const stop = useRef(false);

    const title = t(`mubox.batch.names.${actionKey}`);

    const runPlan = useCallback(
        async (input: string) => {
            const mine = ++seq.current;
            if (!isAutoAction(actionKey) && !input.trim()) {
                setPlan(null);
                setPlanError('');
                setPlanning(false);
                return;
            }
            setPlanning(true);
            setPlan(null);
            setPlanError('');
            try {
                const result = await planBatch(selectedIds, buildAction(actionKey, input));
                if (mine !== seq.current) return;
                setPlan(result);
            } catch (error) {
                if (mine !== seq.current) return;
                const fields = isMuboxFieldError(error) ? Object.values(error.fields)[0] : null;
                setPlanError(typeof fields === 'string' ? fields : getMuboxErrorMessage(error));
            }
            if (mine === seq.current) setPlanning(false);
        },
        [actionKey, selectedIds],
    );

    // Actions without input preview straight away; typed ones a moment after you stop typing
    // (a playlist link waits for the Read button, because reading it asks YouTube).
    useEffect(() => {
        if (isAutoAction(actionKey)) {
            runPlan('');
            return;
        }
        if (actionKey === 'playlist') return;
        const timer = setTimeout(() => runPlan(value), PLAN_DEBOUNCE_MS);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const names = useMemo(
        () => Object.fromEntries((plan?.items ?? []).map((item) => [item.video_id, item.title])),
        [plan],
    );

    const apply = async () => {
        if (!plan || plan.items.length === 0) return;
        const batchId = newBatchId();
        const label = batchLabel(title, actionKey, value, plan.playlist_title);
        stop.current = false;
        setPhase('running');

        const result = await runChunked({
            items: plan.items,
            onProgress: (done, total) => setProgress({ done, total }),
            runChunk: (part) =>
                isTrash
                    ? trashBatch(
                          part.map((item) => item.video_id),
                          batchId,
                          label,
                      )
                    : applyBatch(
                          part.map(({ changes, video_id }) => ({
                              changes: changes ?? {},
                              video_id,
                          })),
                          batchId,
                          label,
                      ),
            shouldStop: () => stop.current,
        });

        setFinished({
            batchId,
            done: result.done,
            failed: result.failed,
            stoppedAt: result.stopped && result.seen < plan.items.length ? result.seen : null,
        });
        setPhase('finished');
        if (result.done > 0) {
            const failedIds = new Set(result.failed.map((f) => f.video_id));
            onChanged(
                isTrash
                    ? plan.items.map((i) => i.video_id).filter((id) => !failedIds.has(id))
                    : undefined,
            );
        }
    };

    // Undo right after a run: mubox's undo is global and one level, so make sure the last batch is still ours
    const undoThis = async () => {
        if (!finished) return;
        setUndoing(true);
        try {
            const last = await fetchLastBatch();
            if (!last || last.id !== finished.batchId) {
                setUndoGone(true);
                return;
            }
            const result = await runUndoChunked({
                onProgress: () => {},
                total: last.count,
                undoChunk: () => undoBatch(25),
            });
            setFinished({ ...finished, failed: result.failed, stoppedAt: null });
            setUndone(result.restored);
            onChanged();
        } catch (error) {
            setPlanError(getMuboxErrorMessage(error));
        } finally {
            setUndoing(false);
        }
    };

    const changeCount = plan?.items.length ?? 0;
    const busy = phase === 'running';
    useEffect(() => {
        onBusyChange?.(busy);
    }, [busy, onBusyChange]);

    return (
        <div className={styles.body}>
            {phase === 'edit' && (
                <>
                    {(actionKey === 'album' || actionKey === 'artist' || actionKey === 'date') && (
                        <div className={styles.fieldRow}>
                            <div className={styles.fieldGrow}>
                                {actionKey === 'album' ? (
                                    <Autocomplete
                                        data={(albums?.albums ?? []).map((a) => a.album)}
                                        data-autofocus
                                        description={t('mubox.batch.fields.albumPick')}
                                        label={t('mubox.batch.fields.album')}
                                        limit={12}
                                        onChange={setValue}
                                        value={value}
                                    />
                                ) : (
                                    <TextInput
                                        data-autofocus
                                        label={t(`mubox.batch.fields.${actionKey}`)}
                                        onChange={(event) => setValue(event.currentTarget.value)}
                                        placeholder={
                                            actionKey === 'date'
                                                ? t('mubox.batch.fields.datePlaceholder')
                                                : undefined
                                        }
                                        value={value}
                                    />
                                )}
                            </div>
                        </div>
                    )}
                    {actionKey === 'playlist' && (
                        <>
                            <div className={styles.fieldRow}>
                                <div className={styles.fieldGrow}>
                                    <TextInput
                                        data-autofocus
                                        label={t('mubox.batch.fields.playlist')}
                                        onChange={(event) => setValue(event.currentTarget.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                event.preventDefault();
                                                runPlan(value);
                                            }
                                        }}
                                        value={value}
                                    />
                                </div>
                                <Button onClick={() => runPlan(value)} variant="default">
                                    {t('mubox.batch.fields.playlistRead')}
                                </Button>
                            </div>
                            <p className={styles.note}>{t('mubox.batch.fields.playlistNote')}</p>
                        </>
                    )}

                    <div aria-live="polite" className={styles.plan}>
                        {planning && (
                            <span className={styles.note}>{t('mubox.batch.dialog.checking')}</span>
                        )}
                        {planError && <span className={styles.error}>{planError}</span>}
                        {plan && !planning && !planError && (
                            <>
                                {plan.type === 'delete' ? (
                                    <>
                                        <p>
                                            <strong>
                                                {plural(t, 'mubox.batch.undo.tracks', changeCount)}
                                            </strong>{' '}
                                            {t('mubox.batch.preview.trash')}
                                        </p>
                                        <p className={styles.note}>
                                            {t('mubox.batch.preview.trashHint')}
                                        </p>
                                    </>
                                ) : changeCount > 0 ? (
                                    <p>
                                        <strong>
                                            {plural(
                                                t,
                                                'mubox.batch.dialog.willChange',
                                                changeCount,
                                            )}
                                        </strong>
                                        {plan.playlist_title
                                            ? t('mubox.batch.dialog.using', {
                                                  title: plan.playlist_title,
                                              })
                                            : ''}
                                        .
                                    </p>
                                ) : (
                                    <p>{t('mubox.batch.dialog.nothing')}</p>
                                )}
                                <PlanSamples plan={plan} />
                                <SkippedLine plan={plan} />
                            </>
                        )}
                    </div>

                    <div className={styles.footer}>
                        <Button onClick={onClose} variant="default">
                            {t('mubox.batch.dialog.cancel')}
                        </Button>
                        <Button
                            disabled={changeCount === 0 || planning}
                            onClick={apply}
                            variant={isTrash ? 'state-error' : 'filled'}
                        >
                            {isTrash
                                ? plural(t, 'mubox.batch.dialog.trashApply', changeCount)
                                : plural(t, 'mubox.batch.dialog.apply', changeCount)}
                        </Button>
                    </div>
                </>
            )}

            {phase === 'running' && (
                <>
                    <RunProgress done={progress.done} total={progress.total} />
                    <div className={styles.footer}>
                        <Button
                            onClick={() => {
                                stop.current = true;
                            }}
                            variant="default"
                        >
                            {t('mubox.batch.dialog.stop')}
                        </Button>
                    </div>
                </>
            )}

            {phase === 'finished' && finished && (
                <>
                    <div aria-live="polite" className={styles.plan}>
                        {planError && <span className={styles.error}>{planError}</span>}
                        <p>
                            <strong>
                                {undone !== null
                                    ? plural(t, 'mubox.batch.result.restored', undone)
                                    : plural(
                                          t,
                                          isTrash
                                              ? 'mubox.batch.result.moved'
                                              : 'mubox.batch.result.changed',
                                          finished.done,
                                      )}
                            </strong>
                            {undone === null &&
                                finished.stoppedAt !== null &&
                                t('mubox.batch.result.stoppedAfter', {
                                    seen: finished.stoppedAt,
                                    total: plan?.items.length ?? 0,
                                })}
                        </p>
                        {undone === null && finished.done > 0 && (
                            <p className={styles.note}>{t('mubox.batch.result.undoHint')}</p>
                        )}
                        {undone !== null && (
                            <p className={styles.note}>{t('mubox.batch.result.restoredHint')}</p>
                        )}
                        {undoGone && (
                            <p className={styles.note}>{t('mubox.batch.result.undoGone')}</p>
                        )}
                        <FailureList failures={finished.failed} names={names} />
                    </div>
                    <div className={styles.footer}>
                        {finished.done > 0 && !undoGone && undone === null && (
                            <Button loading={undoing} onClick={undoThis} variant="default">
                                {t('mubox.batch.result.undoThis')}
                            </Button>
                        )}
                        <Button onClick={onClose} variant="filled">
                            {t('mubox.batch.dialog.close')}
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
};

const isMuboxFieldError = (error: unknown): error is { fields: Record<string, unknown> } =>
    typeof error === 'object' &&
    error !== null &&
    'fields' in error &&
    typeof (error as { fields: unknown }).fields === 'object' &&
    (error as { fields: unknown }).fields !== null &&
    Object.keys((error as { fields: object }).fields).length > 0;
