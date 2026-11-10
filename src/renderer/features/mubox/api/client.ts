import { getMuboxApiBase } from '/@/renderer/features/mubox/constants';
import { useAuthStore } from '/@/renderer/store/auth.store';

export type MuboxErrorKind =
    | 'forbidden' // 403: valid token, not an admin
    | 'http' // any other non-2xx
    | 'unauthorized' // 401: missing, invalid or expired token
    | 'unreachable'; // network error, proxy 502/503/504, or mubox 503 (cannot verify)

export class MuboxError extends Error {
    fields?: Record<string, unknown>;
    kind: MuboxErrorKind;
    status: number;

    constructor(
        kind: MuboxErrorKind,
        status: number,
        message: string,
        fields?: Record<string, unknown>,
    ) {
        super(message);
        this.name = 'MuboxError';
        this.kind = kind;
        this.status = status;
        this.fields = fields;
    }
}

export const isMuboxError = (error: unknown): error is MuboxError => error instanceof MuboxError;

export const getMuboxErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

interface MuboxRequestOptions {
    body?: unknown;
    method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
    query?: Record<string, boolean | null | number | string | undefined>;
    signal?: AbortSignal;
    /** Sent as the raw request body with its own type (an image), instead of JSON `body`. */
    upload?: Blob;
}

const buildUrl = (path: string, query?: MuboxRequestOptions['query']) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
        if (value !== undefined && value !== null) params.set(key, String(value));
    }
    const qs = params.toString();
    return `${getMuboxApiBase()}${path.startsWith('/') ? path : `/${path}`}${qs ? `?${qs}` : ''}`;
};

/** Read the Navidrome JWT at call time: Feishin refreshes it in the auth store. */
const getAuthHeader = (): Record<string, string> => {
    const token = useAuthStore.getState().currentServer?.ndCredential;
    return token ? { 'X-ND-Authorization': `Bearer ${token}` } : {};
};

export async function muboxFetch<T>(path: string, options: MuboxRequestOptions = {}): Promise<T> {
    const { body, method = 'GET', query, signal, upload } = options;

    let contentType: Record<string, string> = {};
    if (upload) contentType = { 'Content-Type': upload.type || 'application/octet-stream' };
    else if (body !== undefined) contentType = { 'Content-Type': 'application/json' };

    let response: Response;
    try {
        response = await fetch(buildUrl(path, query), {
            body: upload ?? (body === undefined ? undefined : JSON.stringify(body)),
            headers: {
                Accept: 'application/json',
                ...contentType,
                ...getAuthHeader(),
            },
            method,
            signal,
        });
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        throw new MuboxError('unreachable', 0, 'mubox is not reachable');
    }

    if (response.ok) {
        if (response.status === 204) return undefined as T;
        try {
            return (await response.json()) as T;
        } catch {
            // 200 with a non-JSON body: almost always a proxy pointing at the wrong place
            throw new MuboxError('unreachable', response.status, 'Unexpected response from mubox');
        }
    }

    let detail = response.statusText;
    let fields: Record<string, unknown> | undefined;
    try {
        const json = await response.json();
        if (typeof json?.detail === 'string') detail = json.detail;
        if (json?.fields && typeof json.fields === 'object') fields = json.fields;
    } catch {
        // non-JSON body (for example an nginx error page)
    }

    if (response.status === 401) throw new MuboxError('unauthorized', 401, detail, fields);
    if (response.status === 403) throw new MuboxError('forbidden', 403, detail, fields);
    if ([502, 503, 504].includes(response.status)) {
        throw new MuboxError('unreachable', response.status, detail, fields);
    }
    throw new MuboxError('http', response.status, detail, fields);
}
