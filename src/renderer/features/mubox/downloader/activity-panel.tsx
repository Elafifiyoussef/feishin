import { useQuery } from '@tanstack/react-query';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import styles from './downloader.module.css';

import { getMuboxErrorMessage } from '/@/renderer/features/mubox/api/client';
import { muboxQueries, useJobAction } from '/@/renderer/features/mubox/api/mubox-api';
import { Job, JobsResponse, JobState } from '/@/renderer/features/mubox/api/types';
import { MuboxCover } from '/@/renderer/features/mubox/components/mubox-cover';
import { useEta } from '/@/renderer/features/mubox/downloader/use-eta';
import { useMuboxAccess } from '/@/renderer/features/mubox/hooks/use-mubox-access';
import { splitActivity, summarize } from '/@/renderer/features/mubox/lib/queue';
import { AppRoute } from '/@/renderer/router/routes';
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
    const { isAdmin } = useMuboxAccess();

    const from = job.playlist_title
        ? `${job.playlist_title}${job.position ? ` #${job.position}` : ''}`
        : '';
    const note =
        job.state === 'canceled'
            ? t('mubox.downloader.activity.note.canceled')
            : job.state === 'queued'
              ? job.follows_other
                  ? t('mubox.downloader.activity.note.followsOther')
                  : t('mubox.downloader.activity.note.waiting')
              : null;
    // admins see everyone's downloads, so say whose it is
    const owner =
        isAdmin && job.requested_name
            ? t('mubox.downloader.activity.note.byUser', { name: job.requested_name })
            : null;

    const run = (what: 'cancel' | 'retry') =>
        action.mutate(
            { action: what, id: job.id },
            { onError: (error) => toast.error({ message: getMuboxErrorMessage(error) }) },
        );

    const mark = STATE_ICON[job.state];

    return (
        <li className={styles.row}>
            <span
                aria-label={t(`mubox.downloader.activity.states.${job.state}`)}
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
                <MetaLine parts={[job.uploader, from, owner, note]} />
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
                        {t('mubox.downloader.activity.actions.retry')}
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
                        {t('mubox.downloader.activity.actions.cancel')}
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
            <MuboxCover videoId={job.video_id} />
            <div className={styles.body}>
                <TitleLink job={job} />
                <MetaLine parts={[job.uploader, formatRelative(job.updated, locale), copyNote]} />
            </div>
        </li>
    );
});

/** One count in the summary: a colored state icon and the number, with the full words on hover. */
const SummaryCount = ({
    count,
    label,
    state,
}: {
    count: number;
    label: string;
    state: JobState;
}) => {
    const mark = STATE_ICON[state];
    return (
        <span aria-label={label} className={styles.summaryCount} role="img" title={label}>
            <Icon color={mark.color} icon={mark.icon} />
            {count}
        </span>
    );
};

/** Downloading, waiting and failed as colored icons on the left; the time left, short, on the right. */
const Summary = ({ data }: { data?: JobsResponse }) => {
    const { t } = useTranslation();
    const { etaShort, etaText } = useEta();

    if (!data) return null;

    const { failed, running, waiting } = summarize(data.counts);
    const busy = running + waiting > 0 && !data.pause.paused;
    const eta = busy ? etaShort(running + waiting) : '';

    if (running + waiting + failed === 0) {
        return (
            <div aria-live="polite" className={styles.summary}>
                {t('mubox.downloader.activity.idle')}
            </div>
        );
    }

    return (
        <div aria-live="polite" className={styles.summary}>
            <div className={styles.summaryCounts}>
                {running > 0 && (
                    <SummaryCount
                        count={running}
                        label={t('mubox.downloader.activity.summary.running', { count: running })}
                        state="running"
                    />
                )}
                {waiting > 0 && (
                    <SummaryCount
                        count={waiting}
                        label={t('mubox.downloader.activity.summary.waiting', { count: waiting })}
                        state="queued"
                    />
                )}
                {failed > 0 && (
                    <SummaryCount
                        count={failed}
                        label={t('mubox.downloader.activity.summary.failed', { count: failed })}
                        state="failed"
                    />
                )}
            </div>
            {eta && (
                <span
                    className={styles.summaryEta}
                    title={t('mubox.downloader.activity.summary.timeLeftHint', {
                        eta: etaText(running + waiting),
                    })}
                >
                    {eta}
                </span>
            )}
        </div>
    );
};

const ListSection = ({
    children,
    kind,
    title,
}: {
    children: React.ReactNode;
    kind?: 'failed';
    title: string;
}) => (
    <section className={styles.activitySection} data-kind={kind}>
        <h3 className={styles.groupHead}>{title}</h3>
        {children}
    </section>
);

/**
 * The activity panel: what is happening now, what failed (only when something did), and the newest
 * few finished downloads. The full history is in the library tools.
 */
export const ActivityPanel = ({ data: preset }: { data?: JobsResponse } = {}) => {
    const { t } = useTranslation();
    // `data` is only passed for the example rows; everywhere else the panel loads and polls /jobs
    const query = useQuery({ ...muboxQueries.jobs(), enabled: !preset });
    const data = preset ?? query.data;
    const isLoading = !preset && query.isLoading;

    const activity = useMemo(() => (data ? splitActivity(data.jobs) : null), [data]);

    if (isLoading) return <Spinner container />;
    if (!data || !activity) return null;

    return (
        <aside className={styles.activity}>
            {/* title and the one-line summary under it, as one compact header */}
            <div className={styles.activityHead}>
                <TextTitle fw={600} order={4}>
                    {t('mubox.downloader.activity.title')}
                </TextTitle>
                <Summary data={data} />
            </div>

            {activity.failed.length > 0 && (
                <ListSection kind="failed" title={t('mubox.downloader.activity.failed')}>
                    <ul className={`${styles.list} ${styles.scrollY}`}>
                        {activity.failed.map((job) => (
                            <ActiveRow job={job} key={job.id} />
                        ))}
                    </ul>
                </ListSection>
            )}

            {activity.active.length > 0 && (
                <ListSection title={t('mubox.downloader.activity.inProgress')}>
                    {/* Long batches scroll inside this box instead of pushing the page down */}
                    <div
                        aria-label={t('mubox.downloader.activity.inProgress')}
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
        </aside>
    );
};

/**
 * The newest few finished downloads. Shown in the left column under the link box whenever there are no
 * check results (after Download the results clear, so this takes their place).
 */
export const RecentDownloads = ({ data: preset }: { data?: JobsResponse } = {}) => {
    const { i18n, t } = useTranslation();
    // `data` is only passed for the example rows; otherwise this reads the same polled /jobs query
    const query = useQuery({ ...muboxQueries.jobs(), enabled: !preset });
    const data = preset ?? query.data;
    const recent = useMemo(() => (data ? splitActivity(data.jobs).recent : null), [data]);

    if (!recent) return null;

    return (
        <ListSection title={t('mubox.downloader.activity.recent')}>
            {recent.length === 0 ? (
                <p className={styles.empty}>{t('mubox.downloader.activity.recentEmpty')}</p>
            ) : (
                <ul className={`${styles.list} ${styles.scrollY}`}>
                    {recent.map((job) => (
                        <RecentRow job={job} key={job.id} locale={i18n.language} />
                    ))}
                </ul>
            )}
            <Link className={styles.seeAll} to={AppRoute.LIBRARY_SONGS}>
                {t('mubox.downloader.activity.seeAll')}
            </Link>
        </ListSection>
    );
};
