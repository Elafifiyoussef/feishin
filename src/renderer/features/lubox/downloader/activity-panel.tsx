import { useQuery } from '@tanstack/react-query';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import styles from './downloader.module.css';

import { getLuboxErrorMessage } from '/@/renderer/features/lubox/api/client';
import { luboxQueries, useJobAction } from '/@/renderer/features/lubox/api/lubox-api';
import { Job, JobState } from '/@/renderer/features/lubox/api/types';
import { LuboxCover } from '/@/renderer/features/lubox/components/lubox-cover';
import { LuboxPath } from '/@/renderer/features/lubox/constants';
import { useEta } from '/@/renderer/features/lubox/downloader/use-eta';
import { splitActivity, summarize } from '/@/renderer/features/lubox/lib/queue';
import { Button } from '/@/shared/components/button/button';
import { AppIconSelection, Icon, IconColor } from '/@/shared/components/icon/icon';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { TextTitle } from '/@/shared/components/text-title/text-title';
import { toast } from '/@/shared/components/toast/toast';

const STATE_ICON: Record<JobState, { color: IconColor; icon: AppIconSelection; spin?: boolean }> = {
    canceled: { color: 'muted', icon: 'circleSlash' },
    done: { color: 'success', icon: 'success' },
    failed: { color: 'error', icon: 'xCircle' },
    queued: { color: 'muted', icon: 'duration' },
    running: { color: 'info', icon: 'spinner', spin: true },
    skipped: { color: 'info', icon: 'info' },
};

// The track on YouTube Music (works for any video id). Files only carry YOUTUBE_ID; the link is rebuilt from it.
const trackUrl = (id: string) => `https://music.youtube.com/watch?v=${encodeURIComponent(id)}`;

const jobTitle = (job: Job) => job.video_title || job.title || job.video_id;

const MetaLine = ({ parts }: { parts: (false | null | string | undefined)[] }) => {
    const shown = parts.filter((part): part is string => Boolean(part));
    if (shown.length === 0) return null;
    return (
        <div className={styles.meta}>
            {shown.map((part, index) => (
                <span key={`${part}-${index}`}>{index > 0 ? `· ${part}` : part}</span>
            ))}
        </div>
    );
};

const TitleLink = ({ job }: { job: Job }) => (
    <div className={styles.title}>
        <a
            className={styles.titleText}
            href={trackUrl(job.video_id)}
            rel="noopener noreferrer"
            target="_blank"
            title={jobTitle(job)}
        >
            {jobTitle(job)}
        </a>
    </div>
);

/** A job that is waiting, running or failed: state icon, title, and the one action it allows. */
const ActiveRow = memo(({ job }: { job: Job }) => {
    const { t } = useTranslation();
    const action = useJobAction();

    const from = job.playlist_title
        ? `${job.playlist_title}${job.position ? ` #${job.position}` : ''}`
        : '';
    const note =
        job.state === 'canceled'
            ? t('lubox.downloader.activity.note.canceled')
            : job.state === 'queued'
              ? t('lubox.downloader.activity.note.waiting')
              : null;

    const run = (what: 'cancel' | 'retry') =>
        action.mutate(
            { action: what, id: job.id },
            { onError: (error) => toast.error({ message: getLuboxErrorMessage(error) }) },
        );

    const mark = STATE_ICON[job.state];

    return (
        <li className={styles.row}>
            <span
                aria-label={t(`lubox.downloader.activity.states.${job.state}`)}
                className={styles.rowLead}
                role="img"
            >
                <Icon
                    animate={mark.spin ? 'spin' : undefined}
                    color={mark.color}
                    icon={mark.icon}
                />
            </span>
            <div className={styles.body}>
                <TitleLink job={job} />
                <MetaLine parts={[job.uploader, from, note]} />
                {job.state === 'failed' && job.error && (
                    <div className={styles.errorText} title={job.error}>
                        {job.error}
                    </div>
                )}
            </div>
            {(job.state === 'failed' || job.state === 'canceled') && (
                <div className={styles.actions}>
                    <Button
                        loading={action.isPending}
                        onClick={() => run('retry')}
                        size="compact-sm"
                        variant="default"
                    >
                        {t('lubox.downloader.activity.actions.retry')}
                    </Button>
                </div>
            )}
            {job.state === 'queued' && (
                <div className={styles.actions}>
                    <Button
                        loading={action.isPending}
                        onClick={() => run('cancel')}
                        size="compact-sm"
                        variant="subtle"
                    >
                        {t('lubox.downloader.activity.actions.cancel')}
                    </Button>
                </div>
            )}
        </li>
    );
});

const formatRelative = (updatedSeconds: number, locale: string) => {
    const diff = Math.round(updatedSeconds - Date.now() / 1000); // negative: in the past
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
    const abs = Math.abs(diff);

    if (abs < 60) return formatter.format(Math.min(diff, 0), 'second');
    if (abs < 3600) return formatter.format(Math.round(diff / 60), 'minute');
    if (abs < 86400) return formatter.format(Math.round(diff / 3600), 'hour');
    return formatter.format(Math.round(diff / 86400), 'day');
};

/** A finished download (or a copy): cover, title, who and when. */
const RecentRow = memo(({ job, locale }: { job: Job; locale: string }) => {
    const copyNote =
        job.state === 'skipped' ? (job.error ?? '').replace('Already in library · a', 'A') : null;

    return (
        <li className={styles.row}>
            <LuboxCover videoId={job.video_id} />
            <div className={styles.body}>
                <TitleLink job={job} />
                <MetaLine parts={[job.uploader, formatRelative(job.updated, locale), copyNote]} />
            </div>
        </li>
    );
});

const Summary = () => {
    const { t } = useTranslation();
    const { data } = useQuery(luboxQueries.jobs());
    const { etaText } = useEta();

    if (!data) return null;

    const { failed, running, waiting } = summarize(data.counts);
    const eta = running + waiting > 0 && !data.pause.paused ? etaText(running + waiting) : '';

    const parts = [
        running > 0 && t('lubox.downloader.activity.summary.running', { count: running }),
        waiting > 0 && t('lubox.downloader.activity.summary.waiting', { count: waiting }),
        eta && t('lubox.downloader.activity.summary.timeLeft', { eta }),
        failed > 0 && t('lubox.downloader.activity.summary.failed', { count: failed }),
    ].filter(Boolean) as string[];

    return (
        <div
            aria-live="polite"
            className={styles.summary}
            title={eta ? t('lubox.downloader.activity.summary.timeLeftHint') : undefined}
        >
            {parts.length > 0 ? parts.join(' · ') : t('lubox.downloader.activity.idle')}
        </div>
    );
};

const ListSection = ({ children, title }: { children: React.ReactNode; title: string }) => (
    <section>
        <h3 className={styles.groupHead}>{title}</h3>
        {children}
    </section>
);

/**
 * The activity panel: what is happening now, what failed (only when something did), and the newest
 * few finished downloads. The full history is in the library tools.
 */
export const ActivityPanel = () => {
    const { i18n, t } = useTranslation();
    const { data, isLoading } = useQuery(luboxQueries.jobs());

    const activity = useMemo(() => (data ? splitActivity(data.jobs) : null), [data]);

    if (isLoading) return <Spinner container />;
    if (!data || !activity) return null;

    return (
        <aside className={styles.activity}>
            <div className={styles.sectionHead}>
                <TextTitle fw={600} order={4}>
                    {t('lubox.downloader.activity.title')}
                </TextTitle>
            </div>
            <Summary />

            {activity.failed.length > 0 && (
                <ListSection title={t('lubox.downloader.activity.failed')}>
                    <ul className={styles.list}>
                        {activity.failed.map((job) => (
                            <ActiveRow job={job} key={job.id} />
                        ))}
                    </ul>
                </ListSection>
            )}

            {activity.active.length > 0 && (
                <ListSection title={t('lubox.downloader.activity.inProgress')}>
                    {/* Long batches scroll inside this box instead of pushing the page down */}
                    <div
                        aria-label={t('lubox.downloader.activity.inProgress')}
                        className={styles.scrollBox}
                        role="region"
                        tabIndex={0}
                    >
                        <ul className={styles.listBare}>
                            {activity.active.map((job) => (
                                <ActiveRow job={job} key={job.id} />
                            ))}
                        </ul>
                    </div>
                </ListSection>
            )}

            <ListSection title={t('lubox.downloader.activity.recent')}>
                {activity.recent.length === 0 ? (
                    <p className={styles.empty}>{t('lubox.downloader.activity.recentEmpty')}</p>
                ) : (
                    <ul className={styles.list}>
                        {activity.recent.map((job) => (
                            <RecentRow job={job} key={job.id} locale={i18n.language} />
                        ))}
                    </ul>
                )}
                <Link className={styles.seeAll} to={LuboxPath.LIBRARY}>
                    {t('lubox.downloader.activity.seeAll')}
                </Link>
            </ListSection>
        </aside>
    );
};
