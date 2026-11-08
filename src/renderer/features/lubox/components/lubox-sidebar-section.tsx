import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';

import { luboxNavItems } from '/@/renderer/features/lubox/components/lubox-nav-items';
import {
    useLuboxAccess,
    useLuboxCoverSession,
} from '/@/renderer/features/lubox/hooks/use-lubox-access';
import '/@/renderer/features/lubox/i18n/register';
import { CollapsedSidebarItem } from '/@/renderer/features/sidebar/components/collapsed-sidebar-item';
import { SidebarItem } from '/@/renderer/features/sidebar/components/sidebar-item';
import { Accordion } from '/@/shared/components/accordion/accordion';
import { Group } from '/@/shared/components/group/group';
import { Icon } from '/@/shared/components/icon/icon';
import { Text } from '/@/shared/components/text/text';

const useVisibleLuboxItems = () => {
    const { isAdmin, isSupported } = useLuboxAccess();

    if (!isSupported) return [];
    return luboxNavItems.filter((item) => !item.adminOnly || isAdmin);
};

interface LuboxSidebarSectionProps {
    /** `collapsed` renders the icon rail entries used by the collapsed sidebar. */
    variant?: 'collapsed' | 'expanded';
}

/**
 * Self-contained lubox navigation. In `expanded` form it is an Accordion.Item, so it must be mounted
 * inside the sidebar's Accordion. Renders nothing unless the current user may see at least one
 * lubox page, so upstream sidebars can mount it unconditionally.
 */
export const LuboxSidebarSection = ({ variant = 'expanded' }: LuboxSidebarSectionProps) => {
    const { t } = useTranslation();
    const items = useVisibleLuboxItems();
    // the sidebar is always mounted, so it keeps the cover cookie fresh for every lubox page
    useLuboxCoverSession();

    if (items.length === 0) return null;

    if (variant === 'collapsed') {
        return (
            <>
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
        <Accordion.Item value="lubox">
            <Accordion.Control>
                <Text fw={500} variant="secondary">
                    {t('lubox.nav.title')}
                </Text>
            </Accordion.Control>
            <Accordion.Panel>
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
