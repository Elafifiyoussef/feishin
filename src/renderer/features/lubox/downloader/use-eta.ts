import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { luboxQueries } from '/@/renderer/features/lubox/api/lubox-api';
import { estimateEta, estimateSecondsPerTrack, Eta } from '/@/renderer/features/lubox/lib/queue';

/** Estimated time text for N tracks, from how fast recent downloads actually finished. */
export const useEta = () => {
    const { t } = useTranslation();
    const { data } = useQuery(luboxQueries.jobs());

    const secondsPerTrack = useMemo(
        () => (data ? estimateSecondsPerTrack(data.jobs) : null),
        [data],
    );

    const format = useCallback(
        (eta: Eta | null): string => {
            if (!eta) return '';
            if (eta.unit === 'under-a-minute') return t('lubox.downloader.eta.underAMinute');
            if (eta.unit === 'minutes') {
                return t('lubox.downloader.eta.minutes', { minutes: eta.minutes });
            }
            return t('lubox.downloader.eta.hours', { hours: eta.hours, minutes: eta.minutes });
        },
        [t],
    );

    const etaText = useCallback(
        (tracks: number) => format(estimateEta(tracks, secondsPerTrack)),
        [format, secondsPerTrack],
    );

    /** The same estimate, short: "<1m", "~12m", "~1h 5m". */
    const etaShort = useCallback(
        (tracks: number): string => {
            const eta = estimateEta(tracks, secondsPerTrack);
            if (!eta) return '';
            if (eta.unit === 'under-a-minute') return t('lubox.downloader.eta.short.underAMinute');
            if (eta.unit === 'minutes') {
                return t('lubox.downloader.eta.short.minutes', { minutes: eta.minutes });
            }
            return t('lubox.downloader.eta.short.hours', {
                hours: eta.hours,
                minutes: eta.minutes,
            });
        },
        [secondsPerTrack, t],
    );

    return { etaShort, etaText };
};
