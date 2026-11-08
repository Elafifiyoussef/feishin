import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './downloader.module.css';

import { getLuboxErrorMessage } from '/@/renderer/features/lubox/api/client';
import {
    luboxKeys,
    luboxQueries,
    useCheckLinks,
    useDownload,
} from '/@/renderer/features/lubox/api/lubox-api';
import {
    ActivityPanel,
    RecentDownloads,
} from '/@/renderer/features/lubox/downloader/activity-panel';
import { CheckResults } from '/@/renderer/features/lubox/downloader/check-results';
import { LinkComposer } from '/@/renderer/features/lubox/downloader/link-composer';
import { PauseBanner } from '/@/renderer/features/lubox/downloader/pause-banner';
import { CheckedItem, toCheckedItem } from '/@/renderer/features/lubox/downloader/types';
import { useEta } from '/@/renderer/features/lubox/downloader/use-eta';
import { buildSelection, countOf } from '/@/renderer/features/lubox/lib/queue';
import { toast } from '/@/shared/components/toast/toast';

/** The Downloader: paste links, Check, choose, Download, and watch the queue. */
export const DownloaderPage = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { data: jobsData } = useQuery(luboxQueries.jobs());
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
            ? t('lubox.downloader.results.downloadHint', {
                  allEta: etaText(waiting + selection.length),
                  eta: downloadEta,
                  waiting,
              })
            : '';

    const refreshJobs = useCallback(
        () => queryClient.invalidateQueries({ queryKey: luboxKeys.jobs() }),
        [queryClient],
    );

    const runCheck = useCallback(
        (input: string, replace?: CheckedItem) => {
            setStatus(t('lubox.downloader.check.checking'));
            checkMutation.mutate(input, {
                onError: (error) => setStatus(getLuboxErrorMessage(error)),
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
                              ? t('lubox.downloader.check.okAll', { count: ok })
                              : t('lubox.downloader.check.okSome', { ok, total: items.length }),
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
            onError: (error) => toast.error({ message: getLuboxErrorMessage(error) }),
            onSuccess: (data) => {
                const counts: Record<string, number> = {};
                for (const job of data.jobs) counts[job.state] = (counts[job.state] ?? 0) + 1;

                const parts = [
                    counts.queued && t('lubox.downloader.toast.queued', { count: counts.queued }),
                    counts.skipped &&
                        t('lubox.downloader.toast.skipped', { count: counts.skipped }),
                    counts['over the limit'] &&
                        t('lubox.downloader.toast.overLimit', {
                            count: counts['over the limit'],
                        }),
                    counts['already queued'] &&
                        t('lubox.downloader.toast.alreadyQueued', {
                            count: counts['already queued'],
                        }),
                ].filter(Boolean);

                toast.success({
                    message: parts.join(', '),
                    title: t('lubox.downloader.toast.title'),
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
