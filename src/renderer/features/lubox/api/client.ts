import { getLuboxApiBase } from '/@/renderer/features/lubox/constants';
import { useAuthStore } from '/@/renderer/store/auth.store';

export type LuboxErrorKind =
    | 'forbidden' // 403: valid token, not an admin
    | 'http' // any other non-2xx
    | 'unauthorized' // 401: missing, invalid or expired token
    | 'unreachable'; // network error, proxy 502/503/504, or lubox 503 (cannot verify)

export class LuboxError extends Error {
    fields?: Record<string, unknown>;
    kind: LuboxErrorKind;
    status: number;

    constructor(
        kind: LuboxErrorKind,
        status: number,
        message: string,
        fields?: Record<string, unknown>,
    ) {
        super(message);
        this.name = 'LuboxError';
        this.kind = kind;
        this.status = status;
        this.fields = fields;
    }
}

export const isLuboxError = (error: unknown): error is LuboxError => error instanceof LuboxError;

export const getLuboxErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

interface LuboxRequestOptions {
    body?: unknown;
    method?: 'DELETE' | 'GET' | 'PATCH' | 'POST';
    query?: Record<string, boolean | null | number | string | undefined>;
    signal?: AbortSignal;
}

const buildUrl = (path: string, query?: LuboxRequestOptions['query']) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
        if (value !== undefined && value !== null) params.set(key, String(value));
    }
    const qs = params.toString();
    return `${getLuboxApiBase()}${path.startsWith('/') ? path : `/${path}`}${qs ? `?${qs}` : ''}`;
};

/** Read the Navidrome JWT at call time: Feishin refreshes it in the auth store. */
const getAuthHeader = (): Record<string, string> => {
    const token = useAuthStore.getState().currentServer?.ndCredential;
    return token ? { 'X-ND-Authorization': `Bearer ${token}` } : {};
};

export async function luboxFetch<T>(path: string, options: LuboxRequestOptions = {}): Promise<T> {
    const { body, method = 'GET', query, signal } = options;

    let response: Response;
    try {
        response = await fetch(buildUrl(path, query), {
            body: body === undefined ? undefined : JSON.stringify(body),
            headers: {
                Accept: 'application/json',
                ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
                ...getAuthHeader(),
            },
            method,
            signal,
        });
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        throw new LuboxError('unreachable', 0, 'lubox is not reachable');
    }

    if (response.ok) {
        if (response.status === 204) return undefined as T;
        try {
            return (await response.json()) as T;
        } catch {
            // 200 with a non-JSON body: almost always a proxy pointing at the wrong place
            throw new LuboxError('unreachable', response.status, 'Unexpected response from lubox');
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

    if (response.status === 401) throw new LuboxError('unauthorized', 401, detail, fields);
    if (response.status === 403) throw new LuboxError('forbidden', 403, detail, fields);
    if ([502, 503, 504].includes(response.status)) {
        throw new LuboxError('unreachable', response.status, detail, fields);
    }
    throw new LuboxError('http', response.status, detail, fields);
}
