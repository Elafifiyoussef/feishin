import { MuboxPath } from '/@/renderer/features/mubox/constants';
import { AppIconSelection } from '/@/shared/components/icon/icon';

export interface MuboxNavItem {
    adminOnly: boolean;
    icon: AppIconSelection;
    id: string;
    labelKey: string;
    to: string;
}

/** Single source for every mubox navigation entry (desktop, collapsed and mobile sidebars). */
export const muboxNavItems: MuboxNavItem[] = [
    {
        adminOnly: false,
        icon: 'download',
        id: 'download',
        labelKey: 'mubox.nav.download',
        to: MuboxPath.DOWNLOAD,
    },
    {
        adminOnly: true,
        icon: 'delete',
        id: 'trash',
        labelKey: 'mubox.nav.trash',
        to: MuboxPath.TRASH,
    },
    {
        adminOnly: true,
        icon: 'user',
        id: 'users',
        labelKey: 'mubox.nav.users',
        to: MuboxPath.USERS,
    },
];
