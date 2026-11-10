import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import styles from './downloader.module.css';

import { getMuboxErrorMessage } from '/@/renderer/features/mubox/api/client';
import { muboxQueries, useResumeQueue } from '/@/renderer/features/mubox/api/mubox-api';
import { useMuboxAccess } from '/@/renderer/features/mubox/hooks/use-mubox-access';
import { Button } from '/@/shared/components/button/button';
import { Icon } from '/@/shared/components/icon/icon';
import { Text } from '/@/shared/components/text/text';
import { toast } from '/@/shared/components/toast/toast';

/** Shown while mubox backs off because YouTube refused requests. "Try now" lifts the pause. */
export const PauseBanner = () => {
    const { t } = useTranslation();
    const { data } = useQuery(muboxQueries.jobs());
    const resume = useResumeQueue();
    // lifting the pause is admin only in mubox; everyone else just sees when it ends
    const { isAdmin } = useMuboxAccess();

    const pause = data?.pause;
    if (!pause?.paused || !pause.paused_until) return null;

    const until = new Date(pause.paused_until * 1000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <div className={styles.banner} role="status">
            <div className={styles.bannerText}>
                <Text fw={600}>{t('mubox.downloader.banner.paused', { time: until })}</Text>
                <Text isMuted size="sm">
                    {t('mubox.downloader.banner.pausedReason')}
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
                                    message: getMuboxErrorMessage(error),
                                }),
                        })
                    }
                    variant="default"
                >
                    {t('mubox.downloader.banner.tryNow')}
                </Button>
            )}
        </div>
    );
};
