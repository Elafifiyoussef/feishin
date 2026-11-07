import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { TrackFilter } from '/@/renderer/features/lubox/api/lubox-api';
import { TrackSort } from '/@/renderer/features/lubox/api/types';
import { Direction, directionOf } from '/@/renderer/features/lubox/lib/library';

const SORTS: TrackSort[] = ['added', 'title', 'artist', 'album', 'date'];
const VIEW_KEY = 'lubox.library.view';

export type LibraryView = 'cards' | 'list';

const readView = (): LibraryView => {
    try {
        return localStorage.getItem(VIEW_KEY) === 'cards' ? 'cards' : 'list';
    } catch {
        return 'list';
    }
};

/**
 * The library list's filter lives in the URL (q, sort, order, album, view) so back, reload and links
 * keep your place. `album` absent = any, empty = no album, otherwise that album.
 */
export const useLibraryFilter = () => {
    const [params, setParams] = useSearchParams();

    const sortParam = params.get('sort') as TrackSort;
    const orderParam = params.get('order');

    const filter: TrackFilter = useMemo(
        () => ({
            album: params.has('album') ? (params.get('album') ?? '') : undefined,
            order: orderParam === 'asc' || orderParam === 'desc' ? orderParam : undefined,
            q: (params.get('q') ?? '').trim(),
            sort: SORTS.includes(sortParam) ? sortParam : 'added',
        }),
        [params, orderParam, sortParam],
    );

    const viewParam = params.get('view');
    const view: LibraryView =
        viewParam === 'cards' || viewParam === 'list' ? viewParam : readView();

    /** Changes the given params; replaces the history entry so typing does not fill the back button. */
    const update = useCallback(
        (changes: Record<string, null | string>) => {
            setParams(
                (current) => {
                    const next = new URLSearchParams(current);
                    for (const [key, value] of Object.entries(changes)) {
                        if (value === null) next.delete(key);
                        else next.set(key, value);
                    }
                    return next;
                },
                { replace: true },
            );
        },
        [setParams],
    );

    return {
        direction: directionOf(filter.sort, (filter.order as Direction | undefined) ?? null),
        filter,
        setAlbum: (album: string | undefined) =>
            update({ album: album === undefined ? null : album }),
        setDirection: (order: Direction) => update({ order }),
        setSearch: (q: string) => update({ q: q || null }),
        // a new sort starts in its natural direction
        setSort: (sort: TrackSort) => update({ order: null, sort: sort === 'added' ? null : sort }),
        setView: (next: LibraryView) => {
            try {
                localStorage.setItem(VIEW_KEY, next);
            } catch {
                // not kept: the view still changes for this visit
            }
            update({ view: next });
        },
        view,
    };
};
