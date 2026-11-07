import { useCallback, useRef, useState } from 'react';

import { fetchMatchingTrackIds, TrackFilter } from '/@/renderer/features/lubox/api/lubox-api';
import { toggleSelection } from '/@/renderer/features/lubox/lib/library';

/**
 * Select mode for the library list: a set of video ids that survives "Load more", with shift ranges
 * and "all N matching" across pages. Cleared by the page whenever the search or album changes.
 */
export const useLibrarySelection = () => {
    const [isSelecting, setIsSelecting] = useState(false);
    const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
    const [reachedLimit, setReachedLimit] = useState(false);
    const anchor = useRef<null | number>(null);

    const clear = useCallback(() => {
        setSelected(new Set());
        setReachedLimit(false);
        anchor.current = null;
    }, []);

    const toggle = useCallback((ids: string[], index: number, shift: boolean) => {
        // read the anchor now: the updater below runs later, after the anchor has moved on
        const from = anchor.current;
        setSelected((current) => toggleSelection(current, ids, index, from, shift));
        setReachedLimit(false);
        anchor.current = index;
    }, []);

    const selectLoaded = useCallback((ids: string[]) => {
        setSelected(new Set(ids));
        setReachedLimit(false);
    }, []);

    const selectMatching = useCallback(async (filter: TrackFilter) => {
        const { capped, ids } = await fetchMatchingTrackIds(filter);
        setSelected(new Set(ids));
        setReachedLimit(capped);
    }, []);

    const setMode = useCallback(
        (on: boolean) => {
            setIsSelecting(on);
            if (!on) clear();
        },
        [clear],
    );

    return {
        clear,
        isSelecting,
        reachedLimit,
        selected,
        selectLoaded,
        selectMatching,
        setMode,
        toggle,
    };
};
