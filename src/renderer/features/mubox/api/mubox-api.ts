import {
    InfiniteData,
    infiniteQueryOptions,
    queryOptions,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query';

import { muboxFetch } from '/@/renderer/features/mubox/api/client';
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
    MuboxTrackDetail,
    PauseState,
    TagField,
    TrackIdsResponse,
    TrackSort,
    TracksResponse,
    TrashPurgeResult,
    TrashResponse,
    TrashRestoreResult,
} from '/@/renderer/features/mubox/api/types';
import { BatchAction } from '/@/renderer/features/mubox/lib/batch';

/** Query keys for mubox data. Prefixed so they never collide with Feishin's server-scoped keys. */
export const muboxKeys = {
    albums: () => [...muboxKeys.all, 'albums'] as const,
    all: ['mubox'] as const,
    jobs: () => [...muboxKeys.all, 'jobs'] as const,
    lastBatch: () => [...muboxKeys.all, 'last-batch'] as const,
    me: () => [...muboxKeys.all, 'me'] as const,
    session: () => [...muboxKeys.all, 'session'] as const,
    tracks: (filter: TrackFilter) => [...muboxKeys.all, 'tracks', filter] as const,
    tracksAll: () => [...muboxKeys.all, 'tracks'] as const,
    trash: () => [...muboxKeys.all, 'trash'] as const,
};

export const TRASH_PAGE_SIZE = 60;

/** GET /trash, newest first, 60 at a time. */
export const muboxTrashQueries = {
    list: () =>
        infiniteQueryOptions<
            TrashResponse,
            Error,
            InfiniteData<TrashResponse, number>,
            ReturnType<typeof muboxKeys.trash>,
            number
        >({
            getNextPageParam: (last, pages) => {
                const loaded = pages.reduce((n, page) => n + page.items.length, 0);
                return loaded < last.total ? loaded : undefined;
            },
            initialPageParam: 0,
            queryFn: ({ pageParam, signal }) =>
                muboxFetch<TrashResponse>('/trash', {
                    query: { limit: TRASH_PAGE_SIZE, offset: pageParam },
                    signal,
                }),
            queryKey: muboxKeys.trash(),
            retry: false,
        }),
};

// --- covers (ADR-0009): a track's cover is written to its main file and every copy ---

const trackPath = (videoId: string) => `/tracks/${encodeURIComponent(videoId)}`;

/** PUT /tracks/{id}/cover: the image itself is the body (JPEG, PNG or WebP, at most 10 MB). */
export const uploadTrackCover = (videoId: string, image: Blob) =>
    muboxFetch<{ ok: boolean }>(`${trackPath(videoId)}/cover`, { method: 'PUT', upload: image });

/** Back to the original YouTube cover mubox kept. */
export const resetTrackCover = (videoId: string) =>
    muboxFetch<{ ok: boolean }>(`${trackPath(videoId)}/cover/reset`, { method: 'POST' });

/** PUT /albums/cover: one image for every file tagged with that album. */
export const uploadAlbumCover = (album: string, image: Blob) =>
    muboxFetch<{ files: number }>('/albums/cover', {
        method: 'PUT',
        query: { album },
        upload: image,
    });

export const resetAlbumCover = (album: string) =>
    muboxFetch<{ files: number }>('/albums/cover/reset', { body: { album }, method: 'POST' });

export const fetchTrackDetail = (videoId: string) =>
    muboxFetch<MuboxTrackDetail>(`/tracks/${encodeURIComponent(videoId)}`);

/** PATCH /tracks/{id}: set some tags by hand (only the ones that changed). */
export const patchTrack = (videoId: string, changes: Partial<Record<TagField, string>>) =>
    muboxFetch<MuboxTrackDetail>(`/tracks/${encodeURIComponent(videoId)}`, {
        body: changes,
        method: 'PATCH',
    });

/** POST /tracks/{id}/revert: put these tags back to what the download came with. */
export const revertTrack = (videoId: string, fields: TagField[]) =>
    muboxFetch<MuboxTrackDetail>(`/tracks/${encodeURIComponent(videoId)}/revert`, {
        body: { fields },
        method: 'POST',
    });

/** POST /trash/purge: erases the trash folders for good. Name the tracks, or `all`. */
export const purgeTrash = (target: { all: true } | { video_ids: string[] }) =>
    muboxFetch<TrashPurgeResult>('/trash/purge', { body: target, method: 'POST' });

export const restoreFromTrash = (ids: string[]) =>
    muboxFetch<TrashRestoreResult>('/trash/restore', {
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

export const muboxQueries = {
    /** GET /albums: the filter options, with the number of tracks in each (and in none). */
    albums: () =>
        queryOptions({
            queryFn: ({ signal }) => muboxFetch<AlbumsResponse>('/albums', { signal }),
            queryKey: muboxKeys.albums(),
            retry: false,
        }),

    /**
     * GET /jobs. Polls every 3 s while anything is waiting or running, and stops when the queue is
     * idle (a download or retry refetches it).
     */
    jobs: () =>
        queryOptions({
            queryFn: ({ signal }) => muboxFetch<JobsResponse>('/jobs', { signal }),
            queryKey: muboxKeys.jobs(),
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
            muboxFetch<CheckResponse>('/check', { body: { text }, method: 'POST' }),
    });

export const useDownload = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (items: DownloadItem[]) =>
            muboxFetch<DownloadResponse>('/download', { body: { items }, method: 'POST' }),
        onSettled: () => queryClient.invalidateQueries({ queryKey: muboxKeys.jobs() }),
    });
};

export const useResumeQueue = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => muboxFetch<{ pause: PauseState }>('/jobs/resume', { method: 'POST' }),
        onSettled: () => queryClient.invalidateQueries({ queryKey: muboxKeys.jobs() }),
    });
};

export const useJobAction = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ action, id }: { action: 'cancel' | 'retry'; id: number }) =>
            muboxFetch<Job>(`/jobs/${id}/${action}`, { method: 'POST' }),
        onSettled: () => queryClient.invalidateQueries({ queryKey: muboxKeys.jobs() }),
    });
};

export const muboxLibraryQueries = {
    /** GET /batch/last: the one batch that can be undone (global, one level), or none. */
    lastBatch: () =>
        queryOptions({
            queryFn: async ({ signal }) =>
                (await muboxFetch<{ last: LastBatch | null }>('/batch/last', { signal })).last,
            queryKey: muboxKeys.lastBatch(),
            retry: false,
        }),

    /** GET /tracks, 60 at a time. */
    tracks: (filter: TrackFilter) =>
        infiniteQueryOptions<
            TracksResponse,
            Error,
            InfiniteData<TracksResponse, number>,
            ReturnType<typeof muboxKeys.tracks>,
            number
        >({
            getNextPageParam: (last, pages) => {
                const loaded = pages.reduce((n, page) => n + page.items.length, 0);
                return loaded < last.total ? loaded : undefined;
            },
            initialPageParam: 0,
            queryFn: ({ pageParam, signal }) =>
                muboxFetch<TracksResponse>('/tracks', {
                    query: { ...trackQuery(filter), limit: TRACKS_PAGE_SIZE, offset: pageParam },
                    signal,
                }),
            queryKey: muboxKeys.tracks(filter),
            retry: false,
        }),
};

/** GET /track-ids: every id matching the filter (capped by mubox at 5000), for "select all N matching". */
export const fetchMatchingTrackIds = (filter: TrackFilter) =>
    muboxFetch<TrackIdsResponse>('/track-ids', { query: trackQuery(filter) });

// --- batch actions. Plans change nothing; apply, trash and undo write, in chunks driven by the page. ---

export const planBatch = (ids: string[], action: BatchAction) =>
    muboxFetch<BatchPlan>('/batch/plan', { body: { action, ids }, method: 'POST' });

export const applyBatch = (
    items: { changes: Record<string, string>; video_id: string }[],
    batch: string,
    label: string,
) =>
    muboxFetch<BatchApplyResult>('/batch/apply', { body: { batch, items, label }, method: 'POST' });

export const trashBatch = (ids: string[], batch: string, label: string) =>
    muboxFetch<BatchApplyResult>('/batch/delete', { body: { batch, ids, label }, method: 'POST' });

export const undoBatch = (limit: number) =>
    muboxFetch<BatchUndoResult>('/batch/undo', { body: { limit }, method: 'POST' });

export const fetchLastBatch = async (): Promise<LastBatch | null> =>
    (await muboxFetch<{ last: LastBatch | null }>('/batch/last')).last;
