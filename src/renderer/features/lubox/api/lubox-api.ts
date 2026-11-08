import {
    InfiniteData,
    infiniteQueryOptions,
    queryOptions,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query';

import { luboxFetch } from '/@/renderer/features/lubox/api/client';
import {
    AlbumsResponse,
    BatchApplyResult,
    BatchPlan,
    BatchUndoResult,
    CheckResponse,
    DownloadItem,
    DownloadResponse,
    Job,
    JobsResponse,
    LastBatch,
    LuboxTrackDetail,
    PauseState,
    TagField,
    TrackIdsResponse,
    TrackSort,
    TracksResponse,
    TrashPurgeResult,
    TrashResponse,
    TrashRestoreResult,
} from '/@/renderer/features/lubox/api/types';
import { BatchAction } from '/@/renderer/features/lubox/lib/batch';

/** Query keys for lubox data. Prefixed so they never collide with Feishin's server-scoped keys. */
export const luboxKeys = {
    albums: () => [...luboxKeys.all, 'albums'] as const,
    all: ['lubox'] as const,
    jobs: () => [...luboxKeys.all, 'jobs'] as const,
    lastBatch: () => [...luboxKeys.all, 'last-batch'] as const,
    me: () => [...luboxKeys.all, 'me'] as const,
    session: () => [...luboxKeys.all, 'session'] as const,
    tracks: (filter: TrackFilter) => [...luboxKeys.all, 'tracks', filter] as const,
    tracksAll: () => [...luboxKeys.all, 'tracks'] as const,
    trash: () => [...luboxKeys.all, 'trash'] as const,
};

export const TRASH_PAGE_SIZE = 60;

/** GET /trash, newest first, 60 at a time. */
export const luboxTrashQueries = {
    list: () =>
        infiniteQueryOptions<
            TrashResponse,
            Error,
            InfiniteData<TrashResponse, number>,
            ReturnType<typeof luboxKeys.trash>,
            number
        >({
            getNextPageParam: (last, pages) => {
                const loaded = pages.reduce((n, page) => n + page.items.length, 0);
                return loaded < last.total ? loaded : undefined;
            },
            initialPageParam: 0,
            queryFn: ({ pageParam, signal }) =>
                luboxFetch<TrashResponse>('/trash', {
                    query: { limit: TRASH_PAGE_SIZE, offset: pageParam },
                    signal,
                }),
            queryKey: luboxKeys.trash(),
            retry: false,
        }),
};

// --- covers (ADR-0009): a track's cover is written to its main file and every copy ---

const trackPath = (videoId: string) => `/tracks/${encodeURIComponent(videoId)}`;

/** PUT /tracks/{id}/cover: the image itself is the body (JPEG, PNG or WebP, at most 10 MB). */
export const uploadTrackCover = (videoId: string, image: Blob) =>
    luboxFetch<{ ok: boolean }>(`${trackPath(videoId)}/cover`, { method: 'PUT', upload: image });

/** Back to the original YouTube cover lubox kept. */
export const resetTrackCover = (videoId: string) =>
    luboxFetch<{ ok: boolean }>(`${trackPath(videoId)}/cover/reset`, { method: 'POST' });

/** PUT /albums/cover: one image for every file tagged with that album. */
export const uploadAlbumCover = (album: string, image: Blob) =>
    luboxFetch<{ files: number }>('/albums/cover', {
        method: 'PUT',
        query: { album },
        upload: image,
    });

export const resetAlbumCover = (album: string) =>
    luboxFetch<{ files: number }>('/albums/cover/reset', { body: { album }, method: 'POST' });

export const fetchTrackDetail = (videoId: string) =>
    luboxFetch<LuboxTrackDetail>(`/tracks/${encodeURIComponent(videoId)}`);

/** PATCH /tracks/{id}: set some tags by hand (only the ones that changed). */
export const patchTrack = (videoId: string, changes: Partial<Record<TagField, string>>) =>
    luboxFetch<LuboxTrackDetail>(`/tracks/${encodeURIComponent(videoId)}`, {
        body: changes,
        method: 'PATCH',
    });

/** POST /tracks/{id}/revert: put these tags back to what the download came with. */
export const revertTrack = (videoId: string, fields: TagField[]) =>
    luboxFetch<LuboxTrackDetail>(`/tracks/${encodeURIComponent(videoId)}/revert`, {
        body: { fields },
        method: 'POST',
    });

/** POST /trash/purge: erases the trash folders for good. Name the tracks, or `all`. */
export const purgeTrash = (target: { all: true } | { video_ids: string[] }) =>
    luboxFetch<TrashPurgeResult>('/trash/purge', { body: target, method: 'POST' });

export const restoreFromTrash = (ids: string[]) =>
    luboxFetch<TrashRestoreResult>('/trash/restore', {
        body: { video_ids: ids },
        method: 'POST',
    });

export const TRACKS_PAGE_SIZE = 60;

/** What the library list is showing. `album`: undefined = any, '' = no album, else that album. */
export interface TrackFilter {
    album?: string;
    order?: 'asc' | 'desc';
    q: string;
    sort: TrackSort;
}

const trackQuery = (filter: TrackFilter) => ({
    album: filter.album,
    order: filter.order,
    q: filter.q,
    sort: filter.sort,
});

const ACTIVE_POLL_MS = 3000;

export const luboxQueries = {
    /** GET /albums: the filter options, with the number of tracks in each (and in none). */
    albums: () =>
        queryOptions({
            queryFn: ({ signal }) => luboxFetch<AlbumsResponse>('/albums', { signal }),
            queryKey: luboxKeys.albums(),
            retry: false,
        }),

    /**
     * GET /jobs. Polls every 3 s while anything is waiting or running, and stops when the queue is
     * idle (a download or retry refetches it).
     */
    jobs: () =>
        queryOptions({
            queryFn: ({ signal }) => luboxFetch<JobsResponse>('/jobs', { signal }),
            queryKey: luboxKeys.jobs(),
            refetchInterval: (query) => {
                const counts = query.state.data?.counts;
                const active = (counts?.queued ?? 0) + (counts?.running ?? 0);
                return active > 0 ? ACTIVE_POLL_MS : false;
            },
            retry: false,
        }),
};

export const useCheckLinks = () =>
    useMutation({
        mutationFn: (text: string) =>
            luboxFetch<CheckResponse>('/check', { body: { text }, method: 'POST' }),
    });

export const useDownload = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (items: DownloadItem[]) =>
            luboxFetch<DownloadResponse>('/download', { body: { items }, method: 'POST' }),
        onSettled: () => queryClient.invalidateQueries({ queryKey: luboxKeys.jobs() }),
    });
};

export const useResumeQueue = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => luboxFetch<{ pause: PauseState }>('/jobs/resume', { method: 'POST' }),
        onSettled: () => queryClient.invalidateQueries({ queryKey: luboxKeys.jobs() }),
    });
};

export const useJobAction = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ action, id }: { action: 'cancel' | 'retry'; id: number }) =>
            luboxFetch<Job>(`/jobs/${id}/${action}`, { method: 'POST' }),
        onSettled: () => queryClient.invalidateQueries({ queryKey: luboxKeys.jobs() }),
    });
};

export const luboxLibraryQueries = {
    /** GET /batch/last: the one batch that can be undone (global, one level), or none. */
    lastBatch: () =>
        queryOptions({
            queryFn: async ({ signal }) =>
                (await luboxFetch<{ last: LastBatch | null }>('/batch/last', { signal })).last,
            queryKey: luboxKeys.lastBatch(),
            retry: false,
        }),

    /** GET /tracks, 60 at a time. */
    tracks: (filter: TrackFilter) =>
        infiniteQueryOptions<
            TracksResponse,
            Error,
            InfiniteData<TracksResponse, number>,
            ReturnType<typeof luboxKeys.tracks>,
            number
        >({
            getNextPageParam: (last, pages) => {
                const loaded = pages.reduce((n, page) => n + page.items.length, 0);
                return loaded < last.total ? loaded : undefined;
            },
            initialPageParam: 0,
            queryFn: ({ pageParam, signal }) =>
                luboxFetch<TracksResponse>('/tracks', {
                    query: { ...trackQuery(filter), limit: TRACKS_PAGE_SIZE, offset: pageParam },
                    signal,
                }),
            queryKey: luboxKeys.tracks(filter),
            retry: false,
        }),
};

/** GET /track-ids: every id matching the filter (capped by lubox at 5000), for "select all N matching". */
export const fetchMatchingTrackIds = (filter: TrackFilter) =>
    luboxFetch<TrackIdsResponse>('/track-ids', { query: trackQuery(filter) });

// --- batch actions. Plans change nothing; apply, trash and undo write, in chunks driven by the page. ---

export const planBatch = (ids: string[], action: BatchAction) =>
    luboxFetch<BatchPlan>('/batch/plan', { body: { action, ids }, method: 'POST' });

export const applyBatch = (
    items: { changes: Record<string, string>; video_id: string }[],
    batch: string,
    label: string,
) =>
    luboxFetch<BatchApplyResult>('/batch/apply', { body: { batch, items, label }, method: 'POST' });

export const trashBatch = (ids: string[], batch: string, label: string) =>
    luboxFetch<BatchApplyResult>('/batch/delete', { body: { batch, ids, label }, method: 'POST' });

export const undoBatch = (limit: number) =>
    luboxFetch<BatchUndoResult>('/batch/undo', { body: { limit }, method: 'POST' });

export const fetchLastBatch = async (): Promise<LastBatch | null> =>
    (await luboxFetch<{ last: LastBatch | null }>('/batch/last')).last;
