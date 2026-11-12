import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';

import { muboxNavItems } from '/@/renderer/features/mubox/components/mubox-nav-items';
import {
    useMuboxAccess,
    useMuboxCoverSession,
} from '/@/renderer/features/mubox/hooks/use-mubox-access';
import {
    OfflineCollapsedEntry,
    OfflineSidebarEntry,
} from '/@/renderer/features/offline/components/offline-sidebar-entry';
import { isOfflineSupported } from '/@/renderer/features/offline/offline-store';
import '/@/renderer/features/mubox/i18n/register';
import { CollapsedSidebarItem } from '/@/renderer/features/sidebar/components/collapsed-sidebar-item';
import { SidebarItem } from '/@/renderer/features/sidebar/components/sidebar-item';
import { Accordion } from '/@/shared/components/accordion/accordion';
import { Group } from '/@/shared/components/group/group';
import { Icon } from '/@/shared/components/icon/icon';
import { Text } from '/@/shared/components/text/text';

const useVisibleMuboxItems = () => {
    const { isAdmin, isSupported } = useMuboxAccess();

    if (!isSupported) return [];
    return muboxNavItems.filter((item) => !item.adminOnly || isAdmin);
};

interface MuboxSidebarSectionProps {
    /** `collapsed` renders the icon rail entries used by the collapsed sidebar. */
    variant?: 'collapsed' | 'expanded';
}

/**
 * Self-contained mubox navigation. In `expanded` form it is an Accordion.Item, so it must be mounted
 * inside the sidebar's Accordion. Renders nothing unless the current user may see at least one
 * mubox page, so upstream sidebars can mount it unconditionally.
 */
export const MuboxSidebarSection = ({ variant = 'expanded' }: MuboxSidebarSectionProps) => {
    const { t } = useTranslation();
    const items = useVisibleMuboxItems();
    // the sidebar is always mounted, so it keeps the cover cookie fresh for every mubox page
    useMuboxCoverSession();

    // kept songs (offline library) exist on the desktop app for every server, mubox or not
    if (items.length === 0 && !isOfflineSupported) return null;

    if (variant === 'collapsed') {
        return (
            <>
                {isOfflineSupported && <OfflineCollapsedEntry />}
                {items.map((item) => (
                    <CollapsedSidebarItem
                        activeIcon={<Icon color="primary" icon={item.icon} size="2xl" />}
                        component={NavLink}
                        icon={<Icon color="muted" icon={item.icon} size="2xl" />}
                        key={item.id}
                        label={t(item.labelKey)}
                        route={item.to}
                        to={item.to}
                    />
                ))}
            </>
        );
    }

    return (
        <Accordion.Item value="mubox">
            <Accordion.Control>
                <Text fw={500} variant="secondary">
                    {t('mubox.nav.title')}
                </Text>
            </Accordion.Control>
            <Accordion.Panel>
                {isOfflineSupported && <OfflineSidebarEntry />}
                {items.map((item) => (
                    <SidebarItem key={item.id} to={item.to}>
                        <Group gap="md">
                            <Icon icon={item.icon} />
                            {t(item.labelKey)}
                        </Group>
                    </SidebarItem>
                ))}
            </Accordion.Panel>
        </Accordion.Item>
    );
};
