import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { isLuboxError } from '/@/renderer/features/lubox/api/client';
import { luboxQueries } from '/@/renderer/features/lubox/api/lubox-api';
import { LuboxStateMessage } from '/@/renderer/features/lubox/components/lubox-state-message';
import { Button } from '/@/shared/components/button/button';
import { Icon } from '/@/shared/components/icon/icon';
import { Spinner } from '/@/shared/components/spinner/spinner';

/**
 * Phase 1 placeholder body: proves the proxy, the token header and the error mapping work.
 * Replaced by the real page content in later phases.
 */
export const LuboxStatusProbe = () => {
    const { t } = useTranslation();
    const query = useQuery(luboxQueries.jobs());

    if (query.isLoading) return <Spinner container />;

    if (query.isError) {
        const error = query.error;
        const isAuth = isLuboxError(error) && error.kind === 'unauthorized';
        const isForbidden = isLuboxError(error) && error.kind === 'forbidden';

        let message = t('lubox.status.unreachable');
        if (isAuth) message = t('lubox.status.unauthorized');
        if (isForbidden) message = t('lubox.access.adminOnlyTitle');

        return (
            <LuboxStateMessage
                action={
                    <Button
                        leftSection={<Icon icon="refresh" />}
                        onClick={() => query.refetch()}
                        variant="default"
                    >
                        {t('lubox.status.retry')}
                    </Button>
                }
                description={
                    isLuboxError(error) && error.kind === 'http' ? error.message : undefined
                }
                icon={isAuth || isForbidden ? 'lock' : 'wifiOff'}
                title={message}
            />
        );
    }

    return (
        <LuboxStateMessage
            description={t('lubox.status.comingSoon')}
            icon="success"
            title={t('lubox.status.reachable')}
        />
    );
};
