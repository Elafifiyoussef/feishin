/**
 * Pure logic of the Downloader: what the activity panel shows, the time estimate and the download
 * selection. No imports on purpose: it is unit tested with Node's built-in runner (see queue.test.ts).
 */

type Counts = Partial<Record<JobState, number>>;

interface JobLike {
    error?: null | string;
    id: number;
    state: JobState;
    updated: number;
}

type JobState = 'canceled' | 'done' | 'failed' | 'queued' | 'running' | 'skipped';

export const countOf = (counts: Counts, ...states: JobState[]) =>
    states.reduce((n, state) => n + (counts[state] ?? 0), 0);

// --- activity: what is happening, what failed, what just finished ---------------------------------------------

export const RECENT_LIMIT = 8;

export interface Activity<T extends JobLike> {
    /** running first, then waiting, in the order the queue will run them */
    active: T[];
    /** failed and canceled, newest first: the only group that asks for action */
    failed: T[];
    /** the newest finished downloads (plus songs added as a copy), at most RECENT_LIMIT */
    recent: T[];
}

/** A skipped job is only interesting when it created a copy in another album. */
export const isCopyJob = (job: { error?: null | string; state: JobState }) =>
    job.state === 'skipped' && (job.error ?? '').includes('as a copy');

export interface ActivitySummary {
    failed: number;
    running: number;
    waiting: number;
}

export type Eta =
    | { hours: number; minutes: number; unit: 'hours' }
    | { minutes: number; unit: 'minutes' }
    | { unit: 'under-a-minute' };

export interface SelectableItem<E extends EntryLike> extends CheckedLike<E> {
    selected: boolean;
}

// --- time estimate -------------------------------------------------------------------------------------------

export interface SelectionItem {
    playlist_id?: string;
    playlist_title?: string;
    position?: number;
    title?: string;
    video_id: string;
}

interface CheckedLike<E extends EntryLike> {
    entries?: E[];
    kind: 'invalid' | 'playlist' | 'video';
    playlist_id: null | string;
    status: string;
    title?: string;
    video_id: null | string;
}

interface EntryLike {
    id: null | string;
    position: number;
    skip?: null | string;
    title: string;
}

// --- check results and the selection that becomes a download request ----------------------------------------

/** What POST /download takes: one item per selected video, playlist context on playlist entries. */
export function buildSelection<E extends EntryLike & { selected: boolean }>(
    items: (SelectableItem<E> & { entries?: E[] })[],
): SelectionItem[] {
    const out: SelectionItem[] = [];

    for (const item of items) {
        if (item.status !== 'ok' || !item.selected) continue;

        if (item.kind === 'video') {
            if (item.video_id) out.push({ title: item.title, video_id: item.video_id });
            continue;
        }

        for (const entry of item.entries ?? []) {
            if (!entry.selected || entry.skip || !entry.id) continue;
            out.push({
                playlist_id: item.playlist_id ?? undefined,
                playlist_title: item.title,
                position: entry.position,
                title: entry.title,
                video_id: entry.id,
            });
        }
    }

    return out;
}

/** Time left for `tracks` tracks, or null when it can not be estimated. */
export function estimateEta(tracks: number, secondsPerTrack: null | number): Eta | null {
    if (!secondsPerTrack || !tracks) return null;

    const seconds = tracks * secondsPerTrack;
    if (seconds < 60) return { unit: 'under-a-minute' };

    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return { minutes, unit: 'minutes' };

    return { hours: Math.floor(minutes / 60), minutes: minutes % 60, unit: 'hours' };
}

/**
 * Seconds per track from how fast recent downloads finished: the median gap between the newest
 * completions (it already includes the parallel workers and the pause between runs). A long gap is
 * idle time between batches, not speed. Returns null when there is not enough data: no guess.
 */
export function estimateSecondsPerTrack(jobs: JobLike[]): null | number {
    const done = jobs
        .filter((job) => job.state === 'done')
        .map((job) => job.updated)
        .sort((a, b) => b - a)
        .slice(0, 40);

    const gaps: number[] = [];
    for (let i = 0; i + 1 < done.length; i++) {
        const gap = done[i] - done[i + 1];
        if (gap >= 0 && gap < 120) gaps.push(gap);
    }

    if (gaps.length < 3) return null;

    gaps.sort((a, b) => a - b);
    return Math.max(1, gaps[Math.floor(gaps.length / 2)]);
}

/**
 * What the Downloader shows: what is happening now, what failed, and a short recent strip. Finished
 * history is not listed (it lives in the library tools) and plain "already in library" skips are
 * dropped: the Check step already showed that.
 */
export function splitActivity<T extends JobLike>(jobs: T[], limit = RECENT_LIMIT): Activity<T> {
    const of = (...states: JobState[]) => jobs.filter((job) => states.includes(job.state));
    const oldestFirst = (a: T, b: T) => a.id - b.id;
    const newestFirst = (a: T, b: T) => b.updated - a.updated || b.id - a.id;

    return {
        active: [...of('running').sort(oldestFirst), ...of('queued').sort(oldestFirst)],
        failed: of('failed', 'canceled').sort(newestFirst),
        recent: jobs
            .filter((job) => job.state === 'done' || isCopyJob(job))
            .sort(newestFirst)
            .slice(0, limit),
    };
}

/** Counts for the one-line summary, from mubox's totals (not only the loaded jobs). */
export function summarize(counts: Counts): ActivitySummary {
    return {
        failed: countOf(counts, 'failed', 'canceled'),
        running: countOf(counts, 'running'),
        waiting: countOf(counts, 'queued'),
    };
}
