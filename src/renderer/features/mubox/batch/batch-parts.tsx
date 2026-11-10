import { useTranslation } from 'react-i18next';

import styles from './batch.module.css';

import { BatchPlan } from '/@/renderer/features/mubox/api/types';
import { Failure, summarizeSkipped } from '/@/renderer/features/mubox/lib/batch';
import { Progress } from '/@/shared/components/progress/progress';

export const plural = (
    t: (key: string, options?: Record<string, unknown>) => string,
    key: string,
    count: number,
    extra: Record<string, unknown> = {},
) => (count === 1 ? t(`${key}One`, extra) : t(key, { count, ...extra }));

/** A few example tracks with what would change: title, then "album: none → “Best Of”". */
export const PlanSamples = ({ plan }: { plan: BatchPlan }) => {
    const { t } = useTranslation();
    if (plan.items.length === 0) return null;

    const none = t('mubox.batch.preview.none');
    const shown = plan.items.slice(0, 5);
    const more = plan.items.length - shown.length;
    const quote = (value: string | undefined) => (value ? `“${value}”` : none);

    return (
        <ul className={styles.samples}>
            {shown.map((item) => (
                <li className={styles.sample} key={item.video_id}>
                    <span className={styles.sampleTitle} title={item.title}>
                        {item.title}
                    </span>
                    {item.changes && (
                        <span className={styles.sampleDiff}>
                            {Object.keys(item.changes)
                                .map(
                                    (field) =>
                                        `${field}: ${quote(item.before?.[field])} → ${quote(item.changes?.[field])}`,
                                )
                                .join(' · ')}
                        </span>
                    )}
                </li>
            ))}
            {more > 0 && (
                <li className={styles.sample}>
                    <span className={styles.sampleDiff}>
                        {t('mubox.batch.preview.andMore', { count: more })}
                    </span>
                </li>
            )}
        </ul>
    );
};

export const SkippedLine = ({ plan }: { plan: BatchPlan }) => {
    const { t } = useTranslation();
    if (plan.skipped.length === 0) return null;

    const reasons = summarizeSkipped(plan.skipped)
        .map(({ count, reason }) => `${count} ${reason}`)
        .join(', ');

    return (
        <p className={styles.note}>
            {plural(t, 'mubox.batch.preview.leftOut', plan.skipped.length, { reasons })}
        </p>
    );
};

export const RunProgress = ({ done, total }: { done: number; total: number }) => (
    <div aria-live="polite" className={styles.plan}>
        <Progress aria-label={`${done} / ${total}`} value={total > 0 ? (done / total) * 100 : 0} />
        <span className={styles.note}>
            {done} / {total}
        </span>
    </div>
);

export const FailureList = ({
    failures,
    names,
}: {
    failures: Failure[];
    names: Record<string, string>;
}) => {
    const { t } = useTranslation();
    if (failures.length === 0) return null;

    return (
        <div>
            <p className={styles.error}>
                {plural(t, 'mubox.batch.result.failed', failures.length)}
            </p>
            <ul className={styles.samples}>
                {failures.slice(0, 8).map((failure, index) => (
                    <li className={styles.sample} key={`${failure.video_id}-${index}`}>
                        <span className={styles.sampleTitle}>
                            {names[failure.video_id] || failure.video_id || '—'}
                        </span>
                        <span className={styles.sampleDiff}>{failure.error}</span>
                    </li>
                ))}
                {failures.length > 8 && (
                    <li className={styles.sample}>
                        <span className={styles.sampleDiff}>
                            {t('mubox.batch.preview.andMore', { count: failures.length - 8 })}
                        </span>
                    </li>
                )}
            </ul>
        </div>
    );
};
