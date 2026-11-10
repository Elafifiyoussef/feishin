// Run: node --test --experimental-strip-types src/renderer/features/mubox/lib/library.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

// @ts-expect-error Node's test runner needs the explicit .ts extension; the app tsconfig does not allow it
import * as library from './library.ts';

const { directionOf, flipDirection, loadedSelectionState, rangeIds, toggleSelection } = library;

const ids = ['a', 'b', 'c', 'd', 'e'];

test('directionOf: natural direction per sort, an explicit order wins', () => {
    assert.equal(directionOf('added', null), 'desc');
    assert.equal(directionOf('date', null), 'desc');
    assert.equal(directionOf('title', null), 'asc');
    assert.equal(directionOf('artist', null), 'asc');
    assert.equal(directionOf('title', 'desc'), 'desc');
    assert.equal(flipDirection('asc'), 'desc');
});

test('rangeIds is inclusive in both directions and tolerates a missing anchor', () => {
    assert.deepEqual(rangeIds(ids, 1, 3), ['b', 'c', 'd']);
    assert.deepEqual(rangeIds(ids, 3, 1), ['b', 'c', 'd']);
    assert.deepEqual(rangeIds(ids, null, 2), ['c']);
    assert.deepEqual(rangeIds(ids, 9, 2), ['c']);
    assert.deepEqual(rangeIds(ids, 0, 9), []);
});

test('toggleSelection: single toggle does not mutate the input', () => {
    const start = new Set(['a']);
    const next = toggleSelection(start, ids, 1, null, false);
    assert.deepEqual([...next].sort(), ['a', 'b']);
    assert.deepEqual([...start], ['a']);
    assert.deepEqual([...toggleSelection(next, ids, 0, null, false)], ['b']);
});

test('toggleSelection: shift selects a range, shift on a selected row clears it', () => {
    const selected = toggleSelection(new Set(), ids, 3, 1, true);
    assert.deepEqual([...selected].sort(), ['b', 'c', 'd']);
    const cleared = toggleSelection(selected, ids, 3, 1, true);
    assert.equal(cleared.size, 0);
    // anchored on a different row, over an already partly selected range
    const merged = toggleSelection(new Set(['c']), ids, 4, 2, true);
    assert.deepEqual([...merged].sort(), ['c', 'd', 'e']);
});

test('loadedSelectionState', () => {
    assert.deepEqual(loadedSelectionState(new Set(), ids), { all: false, partial: false });
    assert.deepEqual(loadedSelectionState(new Set(['a']), ids), { all: false, partial: true });
    assert.deepEqual(loadedSelectionState(new Set(ids), ids), { all: true, partial: false });
    assert.deepEqual(loadedSelectionState(new Set(ids), []), { all: false, partial: false });
    assert.deepEqual(loadedSelectionState(new Set(['zzz', ...ids]), ids), {
        all: true,
        partial: false,
    });
});
