// Run: node --test --experimental-strip-types src/renderer/features/mubox/lib/crop.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

// @ts-expect-error Node's test runner needs the explicit .ts extension; the app tsconfig does not allow it
import * as crop from './crop.ts';

const { centeredView, clampView, cropRect, zoomAt } = crop;

// pixel math: compare to a millionth of a pixel (floating point leaves 280.00000000000006, or -0)
const near = (actual: { size: number; sx: number; sy: number }, expected: typeof actual) => {
    for (const key of ['size', 'sx', 'sy'] as const) {
        assert.ok(
            Math.abs(actual[key] - expected[key]) < 1e-6,
            `${key}: ${actual[key]} vs ${expected[key]}`,
        );
    }
};

// a 16:9 YouTube thumbnail in a 300 px square
const W = 1280;
const H = 720;
const V = 300;

test('the start view crops the centre square of a wide image', () => {
    const view = centeredView(W, H, V);
    assert.equal(view.zoom, 1);
    assert.equal(view.y, 0);
    near(cropRect(view, W, H, V), { size: 720, sx: 280, sy: 0 });
});

test('dragging stops where the image edge meets the square', () => {
    const start = centeredView(W, H, V);
    const left = clampView({ ...start, x: 500 }, W, H, V);
    near(cropRect(left, W, H, V), { size: 720, sx: 0, sy: 0 });

    const right = clampView({ ...start, x: -5000 }, W, H, V);
    near(cropRect(right, W, H, V), { size: 720, sx: 560, sy: 0 });

    near(cropRect(clampView({ ...start, y: 40 }, W, H, V), W, H, V), { size: 720, sx: 280, sy: 0 });
});

test('zoom stays between 1 and 4', () => {
    const start = centeredView(W, H, V);
    assert.equal(zoomAt(start, 0.2, 150, 150, W, H, V).zoom, 1);
    assert.equal(zoomAt(start, 9, 150, 150, W, H, V).zoom, 4);
});

test('zooming on the centre keeps the crop centred and makes it smaller', () => {
    const view = zoomAt(centeredView(W, H, V), 2, V / 2, V / 2, W, H, V);
    const rect = cropRect(view, W, H, V);
    assert.equal(rect.size, 360);
    assert.ok(Math.abs(rect.sx + rect.size / 2 - 640) < 1e-9);
    assert.ok(Math.abs(rect.sy + rect.size / 2 - 360) < 1e-9);
});

test('a square image starts as the whole image', () => {
    near(cropRect(centeredView(500, 500, V), 500, 500, V), { size: 500, sx: 0, sy: 0 });
});
