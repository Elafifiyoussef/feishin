/** Response shapes of the lubox backend (app/routes.py, app/store.py, app/jobs.py). */

export interface AlbumsResponse {
    albums: { album: string; count: number }[];
    /** tracks that are in no album */
    none: number;
}

export interface BatchApplyResult {
    done: number;
    failed: BatchFailure[];
}

export interface BatchFailure {
    error: string;
    video_id: string;
}

export interface BatchPlan {
    items: BatchPlanItem[];
    playlist_title: null | string;
    /** tracks left out, each with the reason */
    skipped: { reason: string; title: string; video_id: string }[];
    type: 'clear_album' | 'delete' | 'playlist' | 'set' | 'single';
}

export interface BatchPlanItem {
    /** what each field is now, for the fields that would change */
    before?: Record<string, string>;
    /** the new value of each field that would change (edits only) */
    changes?: Record<string, string>;
    title: string;
    video_id: string;
}

export interface BatchUndoResult {
    failed: BatchFailure[];
    remaining: number;
    restored: number;
}

export interface CheckEntry {
    duration?: null | number;
    id: null | string;
    in_library?: boolean;
    position: number;
    /** Why the entry can not be downloaded (private, deleted, ...). */
    skip?: null | string;
    title: string;
    uploader?: null | string;
}

export interface CheckItem {
    canonical?: null | string;
    /** playlist only: the number of downloadable entries */
    count?: number;
    duration?: null | number;
    entries?: CheckEntry[];
    error: null | string;
    in_library?: boolean;
    kind: 'invalid' | 'playlist' | 'video';
    playlist_id: null | string;
    /** video links that also carry a playlist: offer the whole playlist instead */
    playlist_url?: string;
    raw: string;
    status: CheckStatus;
    thumbnail?: null | string;
    title?: string;
    uploader?: null | string;
    video_id: null | string;
}

export interface CheckResponse {
    items: CheckItem[];
    pause: PauseState;
}

export type CheckStatus = 'blocked' | 'error' | 'invalid' | 'ok' | 'unavailable';

export interface DownloadItem {
    playlist_id?: null | string;
    playlist_title?: null | string;
    position?: null | number;
    title?: null | string;
    video_id: string;
}

// --- library ------------------------------------------------------------------------------------------------

export interface DownloadResponse {
    jobs: { job_id: number; state: string; video_id: string }[];
}

export interface Job {
    created: number;
    error: null | string;
    /** waits for another download of the same video and ends as "Already in library" */
    follows_other?: boolean | number;
    id: number;
    library_path?: null | string;
    playlist_id: null | string;
    playlist_title: null | string;
    position: null | number;
    /** Navidrome user id of whoever asked for it */
    requested_by?: null | string;
    requested_name?: null | string;
    state: JobState;
    title: null | string;
    updated: number;
    uploader?: null | string;
    video_id: string;
    video_title?: null | string;
}

export type JobCounts = Partial<Record<JobState, number>>;

export interface JobsResponse {
    counts: JobCounts;
    jobs: Job[];
    pause: PauseState;
}

export type JobState = 'canceled' | 'done' | 'failed' | 'queued' | 'running' | 'skipped';

// --- batch actions (ADR-0005 in lubox) ------------------------------------------------------------------------

export interface LastBatch {
    count: number;
    id: string;
    kind: 'edit' | 'trash';
    label: string;
}

/** GET /me: who lubox thinks you are. `auth` is false while lubox does not check tokens. */
export interface LuboxMe {
    admin: boolean;
    auth: boolean;
    id: string;
    name: string;
}

export interface LuboxTrack {
    added_at: null | number;
    album: null | string;
    /** how many albums the song is in: 1 main file plus its copies */
    albums: number;
    artist: null | string;
    date: null | string;
    duration: null | number;
    /** title, artist or date was changed by hand */
    edited: boolean;
    /** the file is gone from disk */
    missing: boolean;
    title: null | string;
    track: null | number | string;
    video_id: string;
}

/** GET /tracks/{id} (the parts the tag editor uses). `raw` is what the download came with. */
export interface LuboxTrackDetail {
    edits: Partial<Record<TagField, unknown>>;
    raw: TagValues;
    tags: TagValues;
    video_id: string;
}

export interface PauseState {
    backoff: number;
    paused: boolean;
    paused_until: null | number;
    reason: null | string;
}

/** The tags lubox lets you change on one track. */
export type TagField = 'album' | 'artist' | 'date' | 'title' | 'track';

export type TagValues = Record<TagField, null | number | string>;

export interface TrackIdsResponse {
    capped: boolean;
    ids: string[];
}

export type TrackSort = 'added' | 'album' | 'artist' | 'date' | 'title';

export interface TracksResponse {
    items: LuboxTrack[];
    total: number;
}

/** A track moved to lubox's trash. Shape proposed to lubox, to be confirmed. */
export interface TrashItem {
    album: null | string;
    artist: null | string;
    batch: null | string;
    copies: number;
    files: string[];
    /** downloaded again since: the trashed folder only holds an old file */
    in_library: boolean;
    /** why it can not be restored (null when it can) */
    reason: null | string;
    restorable: boolean;
    /** bytes, all files of the track */
    size: null | number;
    title: null | string;
    /** unix seconds */
    trashed_at: null | number;
    video_id: string;
}

export interface TrashPurgeResult {
    failed: BatchFailure[];
    /** bytes freed */
    freed: number;
    purged: string[];
}

export interface TrashResponse {
    items: TrashItem[];
    /** bytes, the whole trash */
    size: number;
    total: number;
}

export interface TrashRestoreResult {
    failed: BatchFailure[];
    restored: string[];
}
