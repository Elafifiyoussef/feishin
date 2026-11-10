/**
 * Math for the square cover crop. The crop box is a fixed square viewport of `v` pixels; the image moves
 * and zooms behind it. A view is the image's top-left corner inside the viewport plus a zoom, where zoom 1
 * means the image just covers the square (its short side fits). No imports on purpose: unit tested with
 * Node's built-in runner (see crop.test.ts).
 */

export interface CropRect {
    size: number;
    sx: number;
    sy: number;
}

export interface CropView {
    x: number;
    y: number;
    zoom: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Scale at zoom 1: the image's short side fills the square. */
export const baseScale = (w: number, h: number, v: number) => v / Math.min(w, h);

/** The start: fully zoomed out and centred, the same as cropping the middle square. */
export function centeredView(w: number, h: number, v: number): CropView {
    const scale = baseScale(w, h, v);
    return { x: (v - w * scale) / 2, y: (v - h * scale) / 2, zoom: 1 };
}

/** Keep the square covered: the image can not be dragged so far that empty space shows. */
export function clampView(view: CropView, w: number, h: number, v: number): CropView {
    const zoom = clamp(view.zoom, MIN_ZOOM, MAX_ZOOM);
    const scale = baseScale(w, h, v) * zoom;
    return {
        x: clamp(view.x, v - w * scale, 0),
        y: clamp(view.y, v - h * scale, 0),
        zoom,
    };
}

/** The part of the original image inside the square, in the image's own pixels. */
export function cropRect(view: CropView, w: number, h: number, v: number): CropRect {
    const scale = baseScale(w, h, v) * view.zoom;
    return { size: v / scale, sx: -view.x / scale, sy: -view.y / scale };
}

/** Zoom while keeping the point under (px, py) in the viewport still (the cursor, or the centre). */
export function zoomAt(
    view: CropView,
    zoom: number,
    px: number,
    py: number,
    w: number,
    h: number,
    v: number,
): CropView {
    const next = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    const ratio = next / view.zoom;
    return clampView(
        { x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio, zoom: next },
        w,
        h,
        v,
    );
}
