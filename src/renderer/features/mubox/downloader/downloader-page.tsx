import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './downloader.module.css';

import { getMuboxErrorMessage } from '/@/renderer/features/mubox/api/client';
import {
    muboxKeys,
    muboxQueries,
    useCheckLinks,
    useDownload,
} from '/@/renderer/features/mubox/api/mubox-api';
import {
    ActivityPanel,
    RecentDownloads,
} from '/@/renderer/features/mubox/downloader/activity-panel';
import { CheckResults } from '/@/renderer/features/mubox/downloader/check-results';
import { LinkComposer } from '/@/renderer/features/mubox/downloader/link-composer';
import { PauseBanner } from '/@/renderer/features/mubox/downloader/pause-banner';
import { CheckedItem, toCheckedItem } from '/@/renderer/features/mubox/downloader/types';
import { useEta } from '/@/renderer/features/mubox/downloader/use-eta';
import { buildSelection, countOf } from '/@/renderer/features/mubox/lib/queue';
import { toast } from '/@/shared/components/toast/toast';

/** The Downloader: paste links, Check, choose, Download, and watch the queue. */
export const DownloaderPage = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { data: jobsData } = useQuery(muboxQueries.jobs());
    const { etaText } = useEta();

    const [text, setText] = useState('');
    const [checked, setChecked] = useState<CheckedItem[]>([]);
    const [status, setStatus] = useState('');

    const checkMutation = useCheckLinks();
    const downloadMutation = useDownload();

    const selection = useMemo(() => buildSelection(checked), [checked]);
    const waiting = jobsData ? countOf(jobsData.counts, 'queued', 'running') : 0;

    const downloadEta = etaText(selection.length);
    const downloadHint =
        selection.length > 0 && downloadEta && waiting
            ? t('mubox.downloader.results.downloadHint', {
                  allEta: etaText(waiting + selection.length),
                  eta: downloadEta,
                  waiting,
              })
            : '';

    const refreshJobs = useCallback(
        () => queryClient.invalidateQueries({ queryKey: muboxKeys.jobs() }),
        [queryClient],
    );

    const runCheck = useCallback(
        (input: string, replace?: CheckedItem) => {
            setStatus(t('mubox.downloader.check.checking'));
            checkMutation.mutate(input, {
                onError: (error) => setStatus(getMuboxErrorMessage(error)),
                onSuccess: (data) => {
                    const items = data.items.map(toCheckedItem);
                    setChecked((current) =>
                        replace ? current.flatMap((i) => (i === replace ? items : [i])) : items,
                    );
                    const ok = items.filter((item) => item.status === 'ok').length;
                    setStatus(
                        items.length === 0
                            ? ''
                            : ok === items.length
                              ? t('mubox.downloader.check.okAll', { count: ok })
                              : t('mubox.downloader.check.okSome', { ok, total: items.length }),
                    );
                    refreshJobs();
                },
            });
        },
        [checkMutation, refreshJobs, t],
    );

    const handleCheck = () => {
        if (text.trim()) runCheck(text.trim());
    };

    const handleWholePlaylist = (item: CheckedItem) => {
        if (item.playlist_url) runCheck(item.playlist_url, item);
    };

    const handleDownload = () => {
        if (!selection.length) return;
        downloadMutation.mutate(selection, {
            onError: (error) => toast.error({ message: getMuboxErrorMessage(error) }),
            onSuccess: (data) => {
                const counts: Record<string, number> = {};
                for (const job of data.jobs) counts[job.state] = (counts[job.state] ?? 0) + 1;

                const parts = [
                    counts.queued && t('mubox.downloader.toast.queued', { count: counts.queued }),
                    counts.skipped &&
                        t('mubox.downloader.toast.skipped', { count: counts.skipped }),
                    counts['over the limit'] &&
                        t('mubox.downloader.toast.overLimit', {
                            count: counts['over the limit'],
                        }),
                    counts['already queued'] &&
                        t('mubox.downloader.toast.alreadyQueued', {
                            count: counts['already queued'],
                        }),
                ].filter(Boolean);

                toast.success({
                    message: parts.join(', '),
                    title: t('mubox.downloader.toast.title'),
                });
                setChecked([]);
                setText('');
                setStatus('');
            },
        });
    };

    // recent downloads take the results' place once they clear (right after Download)
    const showRecent = checked.length === 0;

    return (
        <div className={styles.page}>
            <PauseBanner />
            {/* stacked (narrow): link box, results or activity, then recent downloads; wide: activity on the right */}
            <div className={styles.layout} data-recent={showRecent}>
                <div className={styles.main}>
                    <LinkComposer
                        isChecking={checkMutation.isPending}
                        onChange={setText}
                        onCheck={handleCheck}
                        status={status}
                        value={text}
                    />
                    <CheckResults
                        downloadEta={downloadEta}
                        downloadHint={downloadHint}
                        isDownloading={downloadMutation.isPending}
                        items={checked}
                        onChange={setChecked}
                        onDownload={handleDownload}
                        onWholePlaylist={handleWholePlaylist}
                        selectedCount={selection.length}
                    />
                </div>
                <ActivityPanel />
                {showRecent && (
                    <div className={styles.recentArea}>
                        <RecentDownloads />
                    </div>
                )}
            </div>
        </div>
    );
};
