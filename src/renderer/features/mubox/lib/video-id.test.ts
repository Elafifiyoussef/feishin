// Run: node --test --experimental-strip-types src/renderer/features/mubox/lib/video-id.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

// @ts-expect-error Node's test runner needs the explicit .ts extension; the app tsconfig does not allow it
import * as videoId from './video-id.ts';

const { parseVideoId, resolveVideoIds } = videoId;

test('parseVideoId reads the id from a mubox file name', () => {
    assert.equal(parseVideoId('Sumia/FOMENT [OHpmkW9QzmA].opus'), 'OHpmkW9QzmA');
    assert.equal(
        parseVideoId('/music/23.exe - Topic/CHO -DARI- [LgVBG747EKA].opus'),
        'LgVBG747EKA',
    );
    assert.equal(parseVideoId('C:\\music\\a\\b [-IBHY3-x_Lw].m4a'), '-IBHY3-x_Lw');
});

test('parseVideoId only looks at the file name, not the folders', () => {
    assert.equal(parseVideoId('Artist [AAAAAAAAAAA]/song.mp3'), null);
});

test('parseVideoId rejects anything that is not a mubox name', () => {
    assert.equal(parseVideoId('Artist/Song.opus'), null);
    assert.equal(parseVideoId('Artist/Song [short].opus'), null);
    assert.equal(parseVideoId('Artist/Song [OHpmkW9QzmAx].opus'), null);
    assert.equal(parseVideoId('Artist/Song [OHpmkW9QzmA]'), null);
    assert.equal(parseVideoId(''), null);
    assert.equal(parseVideoId(null), null);
    assert.equal(parseVideoId(undefined), null);
});

test('parseVideoId takes the id at the end when the title has brackets too', () => {
    assert.equal(parseVideoId('A/Song [Live] [OHpmkW9QzmA].opus'), 'OHpmkW9QzmA');
    assert.equal(parseVideoId('A/Song [aaaaaaaaaaa] [OHpmkW9QzmA].opus'), 'OHpmkW9QzmA');
});

test('resolveVideoIds de-duplicates and counts what could not be linked', () => {
    const result = resolveVideoIds([
        { path: 'A/x [AAAAAAAAAAA].opus' },
        { path: 'B/copy [AAAAAAAAAAA].opus' },
        { path: 'C/y [BBBBBBBBBBB].opus' },
        { path: 'D/no id.mp3' },
        {},
    ]);
    assert.deepEqual(result, { ids: ['AAAAAAAAAAA', 'BBBBBBBBBBB'], unresolved: 2 });
});
