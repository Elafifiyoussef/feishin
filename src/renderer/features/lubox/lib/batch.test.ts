// Run: node --test --experimental-strip-types src/renderer/features/lubox/lib/batch.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

// @ts-expect-error Node's test runner needs the explicit .ts extension; the app tsconfig does not allow it
import * as batch from './batch.ts';

const {
    batchLabel,
    buildAction,
    chunk,
    isAutoAction,
    runChunked,
    runUndoChunked,
    summarizeSkipped,
} = batch;

test('buildAction maps every action to the body lubox expects', () => {
    assert.deepEqual(buildAction('album', 'Best Of'), {
        fields: { album: 'Best Of' },
        type: 'set',
    });
    assert.deepEqual(buildAction('artist', 'A'), { fields: { artist: 'A' }, type: 'set' });
    assert.deepEqual(buildAction('date', '2020'), { fields: { date: '2020' }, type: 'set' });
    assert.deepEqual(buildAction('clear', ''), { type: 'clear_album' });
    assert.deepEqual(buildAction('single', ''), { type: 'single' });
    assert.deepEqual(buildAction('delete', ''), { type: 'delete' });
    assert.deepEqual(buildAction('playlist', 'https://x'), { type: 'playlist', url: 'https://x' });
});

test('isAutoAction: only actions without input preview immediately', () => {
    assert.equal(isAutoAction('delete'), true);
    assert.equal(isAutoAction('single'), true);
    assert.equal(isAutoAction('clear'), true);
    assert.equal(isAutoAction('album'), false);
    assert.equal(isAutoAction('playlist'), false);
});

test('batchLabel', () => {
    assert.equal(batchLabel('Set album', 'album', '  Hits ', null), 'Set album: Hits');
    assert.equal(
        batchLabel('Album from a playlist', 'playlist', 'u', 'Mix'),
        'Album from a playlist: Mix',
    );
    assert.equal(batchLabel('Move to trash', 'delete', '', null), 'Move to trash');
});

test('summarizeSkipped groups reasons', () => {
    assert.deepEqual(
        summarizeSkipped([
            { reason: 'File missing' },
            { reason: 'Already like that' },
            { reason: 'File missing' },
        ]),
        [
            { count: 2, reason: 'file missing' },
            { count: 1, reason: 'already like that' },
        ],
    );
    assert.deepEqual(summarizeSkipped([]), []);
});

test('chunk', () => {
    assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
    assert.deepEqual(chunk([], 25), []);
});

test('runChunked sends every chunk, adds up done and failed, and reports progress', async () => {
    const items = Array.from({ length: 60 }, (_, i) => i);
    const sizes: number[] = [];
    const progress: number[] = [];
    const result = await runChunked({
        items,
        onProgress: (seen) => progress.push(seen),
        runChunk: async (part) => {
            sizes.push(part.length);
            return {
                done: part.length - 1,
                failed: [{ error: 'file missing', video_id: `v${part[0]}` }],
            };
        },
        shouldStop: () => false,
    });

    assert.deepEqual(sizes, [25, 25, 10]);
    assert.equal(result.done, 57);
    assert.equal(result.failed.length, 3);
    assert.equal(result.seen, 60);
    assert.equal(result.stopped, false);
    assert.deepEqual(progress, [0, 25, 50, 60]);
});

test('runChunked honors stop between chunks only', async () => {
    let calls = 0;
    const result = await runChunked({
        items: Array.from({ length: 100 }, (_, i) => i),
        onProgress: () => {},
        runChunk: async (part) => {
            calls += 1;
            return { done: part.length, failed: [] };
        },
        shouldStop: () => calls >= 2,
    });

    assert.equal(calls, 2, 'the chunk in flight finishes, the next one never starts');
    assert.equal(result.done, 50);
    assert.equal(result.seen, 50);
    assert.equal(result.stopped, true);
});

test('runChunked ends the run when a request fails, keeping what was done', async () => {
    let calls = 0;
    const result = await runChunked({
        items: Array.from({ length: 75 }, (_, i) => i),
        onProgress: () => {},
        runChunk: async (part) => {
            calls += 1;
            if (calls === 2) throw new Error('lubox is not reachable');
            return { done: part.length, failed: [] };
        },
        shouldStop: () => false,
    });

    assert.equal(calls, 2);
    assert.equal(result.done, 25);
    assert.deepEqual(result.failed, [{ error: 'lubox is not reachable', video_id: '' }]);
});

test('runUndoChunked loops until nothing remains', async () => {
    const answers = [
        { failed: [], remaining: 30, restored: 25 },
        { failed: [], remaining: 5, restored: 25 },
        { failed: [], remaining: 0, restored: 5 },
    ];
    const progress: number[] = [];
    const result = await runUndoChunked({
        onProgress: (restored) => progress.push(restored),
        total: 55,
        undoChunk: async () => answers.shift()!,
    });

    assert.equal(result.restored, 55);
    assert.deepEqual(progress, [0, 25, 50, 55]);
});

test('runUndoChunked stops when a call makes no progress, and on a request error', async () => {
    const stuck = await runUndoChunked({
        onProgress: () => {},
        total: 10,
        undoChunk: async () => ({ failed: [], remaining: 10, restored: 0 }),
    });
    assert.equal(stuck.restored, 0);

    const broken = await runUndoChunked({
        onProgress: () => {},
        total: 10,
        undoChunk: async () => {
            throw new Error('boom');
        },
    });
    assert.deepEqual(broken.failed, [{ error: 'boom', video_id: '' }]);
});
