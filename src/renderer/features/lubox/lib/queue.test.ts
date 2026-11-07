// Run: node --test --experimental-strip-types src/renderer/features/lubox/lib/queue.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    buildSelection,
    estimateEta,
    estimateSecondsPerTrack,
    isCopyJob,
    RECENT_LIMIT,
    splitActivity,
    summarize,
    // @ts-expect-error Node's test runner needs the explicit .ts extension; the app tsconfig does not allow it
} from './queue.ts';

const job = (id: number, state: string, updated = 0) => ({ id, state: state as never, updated });

test('splitActivity: active oldest-first (running before queued), failed newest-first', () => {
    const jobs = [
        job(1, 'queued'),
        job(2, 'running'),
        job(3, 'queued'),
        job(4, 'failed', 50),
        job(5, 'canceled', 60),
    ];
    const { active, failed } = splitActivity(jobs);

    assert.deepEqual(
        active.map((j) => j.id),
        [2, 1, 3],
    );
    assert.deepEqual(
        failed.map((j) => j.id),
        [5, 4],
    );
});

test('splitActivity: recent is the newest done jobs, capped, and drops plain skips', () => {
    const jobs = [
        ...Array.from({ length: 12 }, (_, i) => job(100 + i, 'done', 1000 + i)),
        job(1, 'skipped', 5000),
        { ...job(2, 'skipped', 2000), error: 'Already in library · added to “Album X” as a copy' },
    ];
    const { recent } = splitActivity(jobs);

    assert.equal(recent.length, RECENT_LIMIT);
    assert.equal(recent[0].id, 2, 'a copy counts and sorts by time');
    assert.equal(recent[1].id, 111);
    assert.ok(!recent.some((j) => j.id === 1), 'a plain "already in library" skip is not shown');
});

test('splitActivity: nothing to show is empty lists', () => {
    assert.deepEqual(splitActivity([]), { active: [], failed: [], recent: [] });
});

test('isCopyJob', () => {
    assert.equal(isCopyJob({ error: 'added to “A” as a copy', state: 'skipped' }), true);
    assert.equal(isCopyJob({ error: 'Already in library: /music/x', state: 'skipped' }), false);
    assert.equal(isCopyJob({ error: 'as a copy', state: 'done' }), false);
});

test('summarize counts from lubox totals, canceled counts as failed', () => {
    assert.deepEqual(summarize({ canceled: 1, done: 785, failed: 2, queued: 3, running: 1 }), {
        failed: 3,
        running: 1,
        waiting: 3,
    });
});

test('estimateSecondsPerTrack needs data and ignores long idle gaps', () => {
    assert.equal(estimateSecondsPerTrack([job(1, 'done', 100), job(2, 'done', 110)]), null);

    const times = [1000, 990, 980, 970, 100]; // the last gap (870 s) is idle time
    const jobs = times.map((t, i) => job(i, 'done', t));
    assert.equal(estimateSecondsPerTrack(jobs), 10);
});

test('estimateSecondsPerTrack uses the median, not the mean', () => {
    const times = [1000, 995, 990, 985, 880]; // gaps 5, 5, 5, 105
    assert.equal(estimateSecondsPerTrack(times.map((t, i) => job(i, 'done', t))), 5);
});

test('estimateEta', () => {
    assert.equal(estimateEta(5, null), null);
    assert.equal(estimateEta(0, 10), null);
    assert.deepEqual(estimateEta(3, 10), { unit: 'under-a-minute' });
    assert.deepEqual(estimateEta(30, 10), { minutes: 5, unit: 'minutes' });
    assert.deepEqual(estimateEta(400, 10), { hours: 1, minutes: 7, unit: 'hours' });
});

test('buildSelection: videos, playlist entries with context, skips and unchecked entries', () => {
    const items = [
        {
            kind: 'video' as const,
            playlist_id: null,
            selected: true,
            status: 'ok',
            title: 'Song',
            video_id: 'aaaaaaaaaaa',
        },
        {
            kind: 'video' as const,
            playlist_id: null,
            selected: false,
            status: 'ok',
            title: 'No',
            video_id: 'bbbbbbbbbbb',
        },
        {
            kind: 'video' as const,
            playlist_id: null,
            selected: true,
            status: 'invalid',
            title: 'Bad',
            video_id: null,
        },
        {
            entries: [
                { id: 'ccccccccccc', position: 1, selected: true, title: 'One' },
                { id: 'ddddddddddd', position: 2, selected: false, title: 'Two' },
                {
                    id: 'eeeeeeeeeee',
                    position: 3,
                    selected: true,
                    skip: 'Private video',
                    title: 'Three',
                },
                { id: null, position: 4, selected: true, title: 'Four' },
            ],
            kind: 'playlist' as const,
            playlist_id: 'OLAK5uy_x',
            selected: true,
            status: 'ok',
            title: 'Album',
            video_id: null,
        },
    ];

    assert.deepEqual(buildSelection(items), [
        { title: 'Song', video_id: 'aaaaaaaaaaa' },
        {
            playlist_id: 'OLAK5uy_x',
            playlist_title: 'Album',
            position: 1,
            title: 'One',
            video_id: 'ccccccccccc',
        },
    ]);
});
