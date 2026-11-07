/** Response shapes of the lubox backend (app/routes.py, app/store.py, app/jobs.py). */

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

export interface DownloadResponse {
    jobs: { job_id: number; state: string; video_id: string }[];
}

export interface Job {
    created: number;
    error: null | string;
    id: number;
    library_path?: null | string;
    playlist_id: null | string;
    playlist_title: null | string;
    position: null | number;
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

export interface PauseState {
    backoff: number;
    paused: boolean;
    paused_until: null | number;
    reason: null | string;
}
