import { useQuery } from '@tanstack/react-query';
import isElectron from 'is-electron';

import { luboxFetch } from '/@/renderer/features/lubox/api/client';
import { luboxKeys } from '/@/renderer/features/lubox/api/lubox-api';
import { LuboxMe } from '/@/renderer/features/lubox/api/types';
import { useCurrentServer } from '/@/renderer/store';
import { ServerType } from '/@/shared/types/domain-types';

export interface LuboxAccess {
    /** Admin in lubox: may delete, use the trash and lift a pause ("Try now"). */
    isAdmin: boolean;
    /** lubox pages exist for this build and server (web build, Navidrome). */
    isSupported: boolean;
}

const COVER_SESSION_MS = 3 * 60 * 60 * 1000;

/**
 * UI gate only: lubox enforces the real rule (ADR-0008). Any signed-in user may download and edit;
 * deleting, the trash and "Try now" are admin only.
 *
 * Who is admin comes from lubox's GET /me once lubox checks tokens (LUBOX_AUTH=navidrome). While
 * that is off, /me calls everyone admin, so the Navidrome admin flag is used instead.
 */
export const useLuboxAccess = (): LuboxAccess => {
    const server = useCurrentServer();
    const isSupported = !isElectron() && server?.type === ServerType.NAVIDROME;

    const { data: me } = useQuery({
        enabled: isSupported,
        queryFn: ({ signal }) => luboxFetch<LuboxMe>('/me', { signal }),
        queryKey: luboxKeys.me(),
        retry: false,
        staleTime: 5 * 60 * 1000,
    });

    const isAdmin = me?.auth ? me.admin : Boolean(server?.isAdmin);

    return { isAdmin: isSupported && isAdmin, isSupported };
};

/**
 * Keeps lubox's cover cookie fresh: covers are plain <img> requests that can not send the token
 * header, so lubox gives an 8-hour cookie instead. Renewed every 3 hours while the app is open.
 */
export const useLuboxCoverSession = () => {
    const { isSupported } = useLuboxAccess();

    useQuery({
        enabled: isSupported,
        queryFn: () => luboxFetch<{ ok: boolean }>('/auth/session', { method: 'POST' }),
        queryKey: luboxKeys.session(),
        refetchInterval: COVER_SESSION_MS,
        retry: false,
        staleTime: COVER_SESSION_MS,
    });
};
