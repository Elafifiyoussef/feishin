import { CheckEntry, CheckItem, Job, JobsResponse } from '/@/renderer/features/lubox/api/types';

/**
 * TEMPORARY example data so the Downloader shows every row state for design review. Turn off with
 * SHOW_EXAMPLES = false (or delete this file and its two uses in downloader-page.tsx).
 * Nothing here is sent to lubox: the Download button does nothing while examples are shown.
 */
export const SHOW_EXAMPLES = true;

const NOW = Math.floor(Date.now() / 1000);
const PLAYLIST = 'Night drive mix';

const TRACKS = [
    'Midnight Highway',
    'Neon Rain',
    'City Lights (feat. Aya)',
    'Slow Motion',
    'Afterglow',
    'Tunnel Vision',
    'Rear View',
    'Last Exit',
    'Streetlamp Waltz',
    'Morning Comes Too Soon',
    'Deleted track',
    'Private track',
];

const id = (n: number) => `EXMPL${String(n).padStart(6, '0')}`;

const entries: CheckEntry[] = TRACKS.map((title, i) => ({
    duration: 180 + i * 7,
    id: i < 10 ? id(i + 1) : null,
    in_library: i === 2,
    position: i + 1,
    skip: i === 10 ? 'Deleted video' : i === 11 ? 'Private video' : null,
    title,
    uploader: 'Example Artist',
}));

/** What "Check" returned for a few pasted links. */
export const EXAMPLE_CHECK: CheckItem[] = [
    {
        count: 10,
        entries,
        error: null,
        kind: 'playlist',
        playlist_id: 'PLexample',
        raw: 'https://music.youtube.com/playlist?list=PLexample',
        status: 'ok',
        title: PLAYLIST,
        uploader: 'Example Artist',
        video_id: null,
    },
    {
        duration: 214,
        error: null,
        kind: 'video',
        playlist_id: null,
        raw: 'https://youtu.be/EXMPL000101',
        status: 'ok',
        title: 'A single song',
        uploader: 'Another Artist',
        video_id: id(101),
    },
    {
        duration: 198,
        error: null,
        in_library: true,
        kind: 'video',
        playlist_id: null,
        raw: 'https://youtu.be/EXMPL000102',
        status: 'ok',
        title: 'A song you already have',
        uploader: 'Another Artist',
        video_id: id(102),
    },
    {
        duration: 240,
        error: null,
        kind: 'video',
        playlist_id: 'PLother',
        playlist_url: 'https://music.youtube.com/playlist?list=PLother',
        raw: 'https://youtu.be/EXMPL000103&list=PLother',
        status: 'ok',
        title: 'A song opened from a playlist',
        uploader: 'Another Artist',
        video_id: id(103),
    },
    {
        error: 'This video is not available',
        kind: 'video',
        playlist_id: null,
        raw: 'https://youtu.be/EXMPL000104',
        status: 'unavailable',
        title: '',
        video_id: id(104),
    },
    {
        error: 'Not a YouTube link',
        kind: 'invalid',
        playlist_id: null,
        raw: 'https://example.com/not-youtube',
        status: 'invalid',
        title: '',
        video_id: null,
    },
    {
        error: 'YouTube is limiting requests. Try again in a few minutes.',
        kind: 'video',
        playlist_id: null,
        raw: 'https://youtu.be/EXMPL000105',
        status: 'blocked',
        title: '',
        video_id: id(105),
    },
];

const job = (n: number, state: Job['state'], extra: Partial<Job> = {}): Job => ({
    created: NOW - 900,
    error: null,
    id: 990000 + n,
    playlist_id: 'PLexample',
    playlist_title: PLAYLIST,
    position: n,
    state,
    title: TRACKS[n - 1],
    updated: NOW - 60,
    uploader: 'Example Artist',
    video_id: id(n),
    video_title: TRACKS[n - 1],
    ...extra,
});

/** The queue after downloading that playlist: some done, one running, some waiting, one failed. */
const jobs: Job[] = [
    job(1, 'done', { updated: NOW - 300 }),
    job(2, 'done', { updated: NOW - 200 }),
    job(3, 'skipped', {
        error: `Already in library · added to ${PLAYLIST} as a copy`,
        updated: NOW - 150,
    }),
    job(4, 'failed', { error: 'ERROR: Sign in to confirm you are not a bot', updated: NOW - 100 }),
    job(5, 'running'),
    job(6, 'queued', { requested_name: 'sam' }),
    job(7, 'queued'),
    job(8, 'queued', { follows_other: 1 }),
    job(9, 'canceled', { updated: NOW - 30 }),
    job(10, 'queued'),
];

export const EXAMPLE_JOBS: JobsResponse = {
    counts: jobs.reduce<JobsResponse['counts']>(
        (out, j) => ({ ...out, [j.state]: (out[j.state] ?? 0) + 1 }),
        {},
    ),
    jobs,
    pause: { backoff: 0, paused: false, paused_until: null, reason: null },
};
