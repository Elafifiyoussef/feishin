import isElectron from 'is-electron';

import { useCurrentServer } from '/@/renderer/store';
import { ServerType } from '/@/shared/types/domain-types';

export interface LuboxAccess {
    /** Signed-in Navidrome admin on a supported build. Cosmetic: lubox enforces the real rule. */
    canManage: boolean;
    isAdmin: boolean;
    /** lubox pages exist for this build and server (web build, Navidrome). */
    isSupported: boolean;
}

/**
 * UI gate only. lubox itself verifies the Navidrome token and requires admin on writes
 * (docs/lubox/PLAN.md section 5).
 */
export const useLuboxAccess = (): LuboxAccess => {
    const server = useCurrentServer();

    const isSupported = !isElectron() && server?.type === ServerType.NAVIDROME;
    const isAdmin = Boolean(server?.isAdmin);

    return { canManage: isSupported && isAdmin, isAdmin, isSupported };
};
