import { LuboxPath } from '/@/renderer/features/lubox/constants';
import { AppIconSelection } from '/@/shared/components/icon/icon';

export interface LuboxNavItem {
    adminOnly: boolean;
    icon: AppIconSelection;
    id: string;
    labelKey: string;
    to: string;
}

/** Single source for every lubox navigation entry (desktop, collapsed and mobile sidebars). */
export const luboxNavItems: LuboxNavItem[] = [
    {
        adminOnly: true,
        icon: 'download',
        id: 'download',
        labelKey: 'lubox.nav.download',
        to: LuboxPath.DOWNLOAD,
    },
    {
        adminOnly: true,
        icon: 'delete',
        id: 'trash',
        labelKey: 'lubox.nav.trash',
        to: LuboxPath.TRASH,
    },
];
