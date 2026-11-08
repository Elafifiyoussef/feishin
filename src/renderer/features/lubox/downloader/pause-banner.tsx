import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import styles from './downloader.module.css';

import { getLuboxErrorMessage } from '/@/renderer/features/lubox/api/client';
import { luboxQueries, useResumeQueue } from '/@/renderer/features/lubox/api/lubox-api';
import { useLuboxAccess } from '/@/renderer/features/lubox/hooks/use-lubox-access';
import { Button } from '/@/shared/components/button/button';
import { Icon } from '/@/shared/components/icon/icon';
import { Text } from '/@/shared/components/text/text';
import { toast } from '/@/shared/components/toast/toast';

/** Shown while lubox backs off because YouTube refused requests. "Try now" lifts the pause. */
export const PauseBanner = () => {
    const { t } = useTranslation();
    const { data } = useQuery(luboxQueries.jobs());
    const resume = useResumeQueue();
    // lifting the pause is admin only in lubox; everyone else just sees when it ends
    const { isAdmin } = useLuboxAccess();

    const pause = data?.pause;
    if (!pause?.paused || !pause.paused_until) return null;

    const until = new Date(pause.paused_until * 1000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <div className={styles.banner} role="status">
            <div className={styles.bannerText}>
                <Text fw={600}>{t('lubox.downloader.banner.paused', { time: until })}</Text>
                <Text isMuted size="sm">
                    {t('lubox.downloader.banner.pausedReason')}
                    {pause.reason ? ` · ${pause.reason}` : ''}
                </Text>
            </div>
            {isAdmin && (
                <Button
                    leftSection={<Icon icon="refresh" />}
                    loading={resume.isPending}
                    onClick={() =>
                        resume.mutate(undefined, {
                            onError: (error) =>
                                toast.error({
                                    message: getLuboxErrorMessage(error),
                                }),
                        })
                    }
                    variant="default"
                >
                    {t('lubox.downloader.banner.tryNow')}
                </Button>
            )}
        </div>
    );
};
