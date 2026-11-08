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
    /** Only lubox admins may use the page (trash). Every other page is for any signed-in user. */
    adminOnly?: boolean;
    /** Content shown to users who may use the page. */
    children: ReactNode;
    /** Number shown as a badge next to the title (undefined while loading). */
    count?: number;
    /** A bar under the header that stays put while the content scrolls (sort, filters). */
    filterBar?: ReactNode;
    /** Pinned below the content, for example the selection bar. */
    footer?: ReactNode;
    /** Right side of the header (search, buttons). */
    headerActions?: ReactNode;
    title: string;
}

/**
 * Shared chrome for every lubox page: Feishin's animated page, error boundary and sticky header,
 * plus the access gate (any user, or admins only). Pages never repeat this.
 */
export const LuboxPage = ({
    adminOnly = false,
    children,
    count,
    filterBar,
    footer,
    headerActions,
    title,
}: LuboxPageProps) => {
    const { t } = useTranslation();
    const { isAdmin, isSupported } = useLuboxAccess();
    const canManage = adminOnly ? isAdmin : isSupported;

    return (
        <AnimatedPage>
            <PageErrorBoundary>
                <PageHeader>
                    <LibraryHeaderBar ignoreMaxWidth>
                        <LibraryHeaderBar.Title>{title}</LibraryHeaderBar.Title>
                        {canManage && count !== undefined && (
                            <LibraryHeaderBar.Badge>{count}</LibraryHeaderBar.Badge>
                        )}
                    </LibraryHeaderBar>
                    {canManage && headerActions}
                </PageHeader>
                {canManage && filterBar}
                {canManage ? (
                    <>
                        <ScrollArea>{children}</ScrollArea>
                        {footer}
                    </>
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
