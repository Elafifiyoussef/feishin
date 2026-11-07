import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import styles from './library.module.css';

import { getLuboxErrorMessage } from '/@/renderer/features/lubox/api/client';
import { luboxLibraryQueries } from '/@/renderer/features/lubox/api/lubox-api';
import { openBatchDialog, openUndoDialog } from '/@/renderer/features/lubox/batch/open-dialogs';
import { LuboxPage } from '/@/renderer/features/lubox/components/lubox-page';
import { LuboxStateMessage } from '/@/renderer/features/lubox/components/lubox-state-message';
import { LuboxPath } from '/@/renderer/features/lubox/constants';
import { BatchActions } from '/@/renderer/features/lubox/library/batch-actions';
import { LibraryToolbar } from '/@/renderer/features/lubox/library/library-toolbar';
import { SelectionBar } from '/@/renderer/features/lubox/library/selection-bar';
import { TrackList } from '/@/renderer/features/lubox/library/track-list';
import { useLibraryFilter } from '/@/renderer/features/lubox/library/use-library-filter';
import { useLibrarySelection } from '/@/renderer/features/lubox/library/use-library-selection';
import { SearchInput } from '/@/renderer/features/shared/components/search-input';
import { Button } from '/@/shared/components/button/button';
import { Icon } from '/@/shared/components/icon/icon';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { toast } from '/@/shared/components/toast/toast';

const SEARCH_DEBOUNCE_MS = 250;

/** Library tools: browse every downloaded track, search, sort, filter by album, and select. */
export const LibraryPage = () => {
    const { t } = useTranslation();
    const { direction, filter, setAlbum, setDirection, setSearch, setSort, setView, view } =
        useLibraryFilter();
    const selection = useLibrarySelection();
    const { data: lastBatch } = useQuery(luboxLibraryQueries.lastBatch());

    const query = useInfiniteQuery(luboxLibraryQueries.tracks(filter));
    const tracks = useMemo(
        () => query.data?.pages.flatMap((page) => page.items) ?? [],
        [query.data],
    );
    const total = query.data?.pages[0]?.total;
    const loadedIds = useMemo(() => tracks.map((track) => track.video_id), [tracks]);

    // The search box types freely and updates the URL a moment later
    const [text, setText] = useState(filter.q);
    useEffect(() => {
        const timer = setTimeout(() => setSearch(text.trim()), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text]);

    // A selection belongs to the search and album it was made in
    const { clear } = selection;
    useEffect(() => clear(), [filter.q, filter.album, clear]);

    const handleSelectMatching = () =>
        selection
            .selectMatching(filter)
            .catch((error) => toast.error({ message: getLuboxErrorMessage(error) }));

    const hasFilter = Boolean(filter.q) || filter.album !== undefined;

    let body;
    if (query.isLoading) {
        body = <Spinner container />;
    } else if (query.isError) {
        body = (
            <LuboxStateMessage
                action={
                    <Button
                        leftSection={<Icon icon="refresh" />}
                        onClick={() => query.refetch()}
                        variant="default"
                    >
                        {t('lubox.status.retry')}
                    </Button>
                }
                description={getLuboxErrorMessage(query.error)}
                icon="wifiOff"
                title={t('lubox.status.unreachable')}
            />
        );
    } else if (tracks.length === 0) {
        body = (
            <LuboxStateMessage
                action={
                    hasFilter ? undefined : (
                        <Button component={Link} to={LuboxPath.DOWNLOAD} variant="default">
                            {t('lubox.library.empty.noneAction')}
                        </Button>
                    )
                }
                icon="emptySongImage"
                title={
                    filter.q
                        ? t('lubox.library.empty.search', { q: filter.q })
                        : hasFilter
                          ? t('lubox.library.empty.filtered')
                          : t('lubox.library.empty.none')
                }
            />
        );
    } else {
        body = (
            <div className={styles.page}>
                <TrackList
                    isSelecting={selection.isSelecting}
                    onToggle={selection.toggle}
                    selected={selection.selected}
                    tracks={tracks}
                    view={view}
                />
                {query.hasNextPage && (
                    <div className={styles.more}>
                        <Button
                            loading={query.isFetchingNextPage}
                            onClick={() => query.fetchNextPage()}
                            variant="default"
                        >
                            {t('lubox.library.loadMore')}
                        </Button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <LuboxPage
            count={total}
            filterBar={
                <LibraryToolbar
                    album={filter.album}
                    direction={direction}
                    isSelecting={selection.isSelecting}
                    lastBatch={lastBatch}
                    onAlbum={setAlbum}
                    onDirection={setDirection}
                    onSelectToggle={() => selection.setMode(!selection.isSelecting)}
                    onSort={setSort}
                    onUndo={() => lastBatch && openUndoDialog({ last: lastBatch })}
                    onView={setView}
                    sort={filter.sort}
                    view={view}
                />
            }
            footer={
                selection.isSelecting && (
                    <SelectionBar
                        actions={
                            <BatchActions
                                disabled={selection.selected.size === 0}
                                onAction={(key) =>
                                    openBatchDialog({
                                        actionKey: key,
                                        onDone: selection.clear,
                                        selectedIds: [...selection.selected],
                                    })
                                }
                            />
                        }
                        loadedIds={loadedIds}
                        onClear={selection.clear}
                        onSelectLoaded={() => selection.selectLoaded(loadedIds)}
                        onSelectMatching={handleSelectMatching}
                        reachedLimit={selection.reachedLimit}
                        selected={selection.selected}
                        total={total ?? 0}
                    />
                )
            }
            headerActions={
                <SearchInput
                    enableHotkey
                    onChange={(event) => setText(event.target.value)}
                    placeholder={t('lubox.library.search')}
                    value={text}
                />
            }
            title={t('lubox.pages.library.title')}
        >
            {body}
        </LuboxPage>
    );
};
