import { useQuery } from '@tanstack/react-query';
import isElectron from 'is-electron';

import { muboxFetch } from '/@/renderer/features/mubox/api/client';
import { muboxKeys } from '/@/renderer/features/mubox/api/mubox-api';
import { MuboxMe } from '/@/renderer/features/mubox/api/types';
import { useCurrentServer } from '/@/renderer/store';
import { ServerType } from '/@/shared/types/domain-types';

export interface MuboxAccess {
    /** Admin in mubox: may delete, use the trash and lift a pause ("Try now"). */
    isAdmin: boolean;
    /** mubox pages exist for this build and server (web build, Navidrome). */
    isSupported: boolean;
}

const COVER_SESSION_MS = 3 * 60 * 60 * 1000;

/**
 * UI gate only: mubox enforces the real rule (ADR-0008). Any signed-in user may download and edit;
 * deleting, the trash and "Try now" are admin only.
 *
 * Who is admin comes from mubox's GET /me once mubox checks tokens (MUBOX_AUTH=navidrome). While
 * that is off, /me calls everyone admin, so the Navidrome admin flag is used instead.
 */
export const useMuboxAccess = (): MuboxAccess => {
    const server = useCurrentServer();
    const isSupported = !isElectron() && server?.type === ServerType.NAVIDROME;

    const { data: me } = useQuery({
        enabled: isSupported,
        queryFn: ({ signal }) => muboxFetch<MuboxMe>('/me', { signal }),
        queryKey: muboxKeys.me(),
        retry: false,
        staleTime: 5 * 60 * 1000,
    });

    const isAdmin = me?.auth ? me.admin : Boolean(server?.isAdmin);

    return { isAdmin: isSupported && isAdmin, isSupported };
};

/**
 * Keeps mubox's cover cookie fresh: covers are plain <img> requests that can not send the token
 * header, so mubox gives an 8-hour cookie instead. Renewed every 3 hours while the app is open.
 */
export const useMuboxCoverSession = () => {
    const { isSupported } = useMuboxAccess();

    useQuery({
        enabled: isSupported,
        queryFn: () => muboxFetch<{ ok: boolean }>('/auth/session', { method: 'POST' }),
        queryKey: muboxKeys.session(),
        refetchInterval: COVER_SESSION_MS,
        retry: false,
        staleTime: COVER_SESSION_MS,
    });
};
