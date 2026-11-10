/**
 * Pure logic of the library list: sort direction and shift-range selection.
 * No imports on purpose: it is unit tested with Node's built-in runner (see library.test.ts).
 */

export type Direction = 'asc' | 'desc';
export type TrackSortKey = 'added' | 'album' | 'artist' | 'date' | 'title';

/** Newest and latest dates first, everything else A to Z, until the direction is changed by hand. */
const NATURAL_DIRECTION: Record<TrackSortKey, Direction> = {
    added: 'desc',
    album: 'asc',
    artist: 'asc',
    date: 'desc',
    title: 'asc',
};

export const directionOf = (sort: TrackSortKey, order: Direction | null): Direction =>
    order ?? NATURAL_DIRECTION[sort];

export const flipDirection = (direction: Direction): Direction =>
    direction === 'asc' ? 'desc' : 'asc';

export interface SelectionState {
    all: boolean;
    /** some but not all of the loaded rows */
    partial: boolean;
}

/** State of the "select all loaded" checkbox. */
export function loadedSelectionState(selected: ReadonlySet<string>, ids: string[]): SelectionState {
    const count = ids.filter((id) => selected.has(id)).length;
    return {
        all: ids.length > 0 && count === ids.length,
        partial: count > 0 && count < ids.length,
    };
}

/** The ids between the anchor and the clicked row, both included (a shift-click range). */
export function rangeIds(ids: string[], anchor: null | number, index: number): string[] {
    if (index < 0 || index >= ids.length) return [];
    if (anchor === null || anchor < 0 || anchor >= ids.length) return [ids[index]];
    const from = Math.min(anchor, index);
    const to = Math.max(anchor, index);
    return ids.slice(from, to + 1);
}

/**
 * Toggle a row, or a whole range with shift. A range takes the state the clicked row is moving to
 * (so shift-clicking an unselected row selects the range, a selected one clears it).
 */
export function toggleSelection(
    selected: ReadonlySet<string>,
    ids: string[],
    index: number,
    anchor: null | number,
    shift: boolean,
): Set<string> {
    const next = new Set(selected);
    const turnOn = !selected.has(ids[index]);
    const affected = shift ? rangeIds(ids, anchor, index) : [ids[index]];

    for (const id of affected) {
        if (turnOn) next.add(id);
        else next.delete(id);
    }

    return next;
}
