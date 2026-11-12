import isElectron from 'is-electron';
import { useEffect } from 'react';

import { lookupMuboxServer } from '/@/renderer/features/mubox/servers/mubox-info';
import { isOfflineMode } from '/@/renderer/features/offline/offline-store';
import { useAuthStoreActions, useCurrentServer } from '/@/renderer/store';
import { ServerType } from '/@/shared/types/domain-types';

// ids asked this session, so a server that is not a mubox server is asked only once
const asked = new Set<string>();

/** The gateway port of a mubox server (ADR-0013) for servers saved as the plain Navidrome address. */
const GATEWAY_PORT = '9190';

const candidateAddresses = (url: string): string[] => {
    const plain = url.replace(/\/+$/, '').replace(/\/navidrome$/, '');
    const candidates = [plain];
    try {
        const parsed = new URL(plain);
        // a server saved before the connect flow points at Navidrome itself (for example :4533)
        if (parsed.port !== GATEWAY_PORT) {
            candidates.push(`${parsed.protocol}//${parsed.hostname}:${GATEWAY_PORT}`);
        }
    } catch {
        // not a URL: only the plain form
    }
    return candidates;
};

/**
 * Desktop app: a server saved before the connect flow has no mubox address, so the mubox pages
 * (Downloader, Trash, Accounts) would never show. When such a server is selected, ask whether a
 * mubox server answers next to it and keep its address on the entry.
 */
export const useMuboxServerProbe = () => {
    const server = useCurrentServer();
    const { updateServer } = useAuthStoreActions();

    const id = server?.id;
    const url = server?.url;
    const type = server?.type;
    const known = Boolean(server?.muboxUrl);

    useEffect(() => {
        if (!isElectron() || !id || !url || known || type !== ServerType.NAVIDROME) return;
        if (isOfflineMode() || asked.has(id)) return;
        asked.add(id);

        (async () => {
            for (const address of candidateAddresses(url)) {
                const found = await lookupMuboxServer(address);
                if (found.kind === 'mubox') {
                    updateServer(id, { muboxUrl: found.muboxUrl });
                    return;
                }
            }
        })();
    }, [id, known, type, updateServer, url]);
};
