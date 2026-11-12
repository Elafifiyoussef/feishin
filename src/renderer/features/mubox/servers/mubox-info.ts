import isElectron from 'is-electron';

/** What a mubox server says about itself at `<address>/mubox/info` (ADR-0013, no sign-in needed). */
export interface MuboxInfo {
    api: number;
    app: string;
    auth: 'navidrome' | 'off';
    configured: boolean;
    name: string;
    paths: { mubox: string; navidrome: null | string };
    version: string;
}

/** The API level this app understands. A server with a higher `api` made a breaking change. */
export const MUBOX_API_LEVEL = 1;

export type MuboxLookup =
    | { address: string; info: MuboxInfo; kind: 'mubox'; muboxUrl: string; navidromeUrl: string }
    | { kind: 'other' }
    | { kind: 'tooNew'; version: string }
    | { kind: 'unconfigured'; name: string }
    | { kind: 'unreachable' };

const trimSlashes = (value: string) => value.replace(/\/+$/, '');

/**
 * Asks `<address>/mubox/info`. `unreachable` is a network or CORS failure; `other` means the address is not a mubox server (it may still be a plain
 * Navidrome), `tooNew` means this app is older than the server.
 */
export const lookupMuboxServer = async (
    rawAddress: string,
    signal?: AbortSignal,
): Promise<MuboxLookup> => {
    const address = trimSlashes(rawAddress.trim());

    let info: MuboxInfo;
    if (isElectron()) {
        // asked from the main process: no CORS, whatever the renderer is served from
        const answer = await window.api.mubox.fetchInfo(address);
        if (!answer) return { kind: 'unreachable' };
        if (answer.status < 200 || answer.status >= 300) return { kind: 'other' };
        info = answer.body;
    } else {
        try {
            const response = await fetch(`${address}/mubox/info`, {
                headers: { Accept: 'application/json' },
                signal,
            });
            if (!response.ok) return { kind: 'other' };
            info = await response.json().catch(() => null);
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') throw error;
            // network failure, or the browser refusing it (CORS)
            return { kind: 'unreachable' };
        }
    }

    if (info?.app !== 'mubox') return { kind: 'other' };
    if (typeof info.api === 'number' && info.api > MUBOX_API_LEVEL) {
        return { kind: 'tooNew', version: String(info.version ?? '') };
    }
    const name = String(info.name || 'mubox');
    if (!info.paths?.navidrome) return { kind: 'unconfigured', name };

    return {
        address,
        info,
        kind: 'mubox',
        muboxUrl: `${address}${info.paths.mubox || '/mubox'}`,
        navidromeUrl: `${address}${info.paths.navidrome}`,
    };
};
