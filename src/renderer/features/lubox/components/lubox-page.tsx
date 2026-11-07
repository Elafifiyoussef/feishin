import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '/@/renderer/components/page-header/page-header';
import { LuboxStateMessage } from '/@/renderer/features/lubox/components/lubox-state-message';
import { useLuboxAccess } from '/@/renderer/features/lubox/hooks/use-lubox-access';
import '/@/renderer/features/lubox/i18n/register';
import { AnimatedPage } from '/@/renderer/features/shared/components/animated-page';
import { LibraryHeaderBar } from '/@/renderer/features/shared/components/library-header-bar';
import { PageErrorBoundary } from '/@/renderer/features/shared/components/page-error-boundary';
import { ScrollArea } from '/@/shared/components/scroll-area/scroll-area';

interface LuboxPageProps {
    /** Content shown to users who may use the page. */
    children: ReactNode;
    /** Right side of the header (search, buttons). */
    headerActions?: ReactNode;
    title: string;
}

/**
 * Shared chrome for every lubox page: Feishin's animated page, error boundary and sticky header,
 * plus the admin gate. Pages never repeat this.
 */
export const LuboxPage = ({ children, headerActions, title }: LuboxPageProps) => {
    const { t } = useTranslation();
    const { canManage } = useLuboxAccess();

    return (
        <AnimatedPage>
            <PageErrorBoundary>
                <PageHeader>
                    <LibraryHeaderBar ignoreMaxWidth>
                        <LibraryHeaderBar.Title>{title}</LibraryHeaderBar.Title>
                    </LibraryHeaderBar>
                    {canManage && headerActions}
                </PageHeader>
                {canManage ? (
                    <ScrollArea>{children}</ScrollArea>
                ) : (
                    <LuboxStateMessage
                        description={t('lubox.access.adminOnlyDescription')}
                        icon="lock"
                        title={t('lubox.access.adminOnlyTitle')}
                    />
                )}
            </PageErrorBoundary>
        </AnimatedPage>
    );
};
