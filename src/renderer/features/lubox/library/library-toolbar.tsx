import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './library.module.css';

import { luboxQueries } from '/@/renderer/features/lubox/api/lubox-api';
import { LastBatch, TrackSort } from '/@/renderer/features/lubox/api/types';
import { Direction, flipDirection } from '/@/renderer/features/lubox/lib/library';
import { LibraryView } from '/@/renderer/features/lubox/library/use-library-filter';
import { FilterBar } from '/@/renderer/features/shared/components/filter-bar';
import { OrderToggleButton } from '/@/renderer/features/shared/components/order-toggle-button';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Button } from '/@/shared/components/button/button';
import { Icon } from '/@/shared/components/icon/icon';
import { Select } from '/@/shared/components/select/select';
import { SortOrder } from '/@/shared/types/domain-types';

// Mantine's Select can not hold '' or undefined as an option value, so the two special albums get names
const ALL = '__all__';
const NONE = '__none__';

interface LibraryToolbarProps {
    album: string | undefined;
    direction: Direction;
    isSelecting: boolean;
    /** The batch that can be undone (global, one level), if any. */
    lastBatch?: LastBatch | null;
    onAlbum: (album: string | undefined) => void;
    onDirection: (direction: Direction) => void;
    onSelectToggle: () => void;
    onSort: (sort: TrackSort) => void;
    onUndo: () => void;
    onView: (view: LibraryView) => void;
    sort: TrackSort;
    view: LibraryView;
}

/** Sort, direction, album filter, view and the Select toggle, in Feishin's filter bar. */
export const LibraryToolbar = ({
    album,
    direction,
    isSelecting,
    lastBatch,
    onAlbum,
    onDirection,
    onSelectToggle,
    onSort,
    onUndo,
    onView,
    sort,
    view,
}: LibraryToolbarProps) => {
    const { t } = useTranslation();
    const { data: albums } = useQuery(luboxQueries.albums());

    const sortOptions = (['added', 'title', 'artist', 'album', 'date'] as const).map((value) => ({
        label: t(`lubox.library.sort.${value}`),
        value,
    }));

    const albumOptions = useMemo(() => {
        const options = [
            { label: t('lubox.library.album.all'), value: ALL },
            {
                label: t('lubox.library.album.none', { count: albums?.none ?? 0 }),
                value: NONE,
            },
            ...(albums?.albums ?? []).map((a) => ({
                label: t('lubox.library.album.option', { album: a.album, count: a.count }),
                value: a.album,
            })),
        ];
        // an album from a shared link that no longer exists must stay selectable
        if (album && !options.some((option) => option.value === album)) {
            options.push({ label: album, value: album });
        }
        return options;
    }, [album, albums, t]);

    const albumValue = album === undefined ? ALL : album === '' ? NONE : album;

    return (
        <FilterBar>
            <div className={styles.toolbar}>
                <div className={`${styles.toolbarField} ${styles.toolbarFieldSort}`}>
                    <Select
                        aria-label={t('lubox.library.sort.label')}
                        data={sortOptions}
                        onChange={(value) => value && onSort(value as TrackSort)}
                        searchable={false}
                        value={sort}
                        width="100%"
                    />
                </div>
                <OrderToggleButton
                    onToggle={() => onDirection(flipDirection(direction))}
                    sortOrder={direction === 'asc' ? SortOrder.ASC : SortOrder.DESC}
                />
                <div className={styles.toolbarField}>
                    <Select
                        aria-label={t('lubox.library.album.label')}
                        data={albumOptions}
                        onChange={(value) =>
                            onAlbum(
                                value === ALL || value === null
                                    ? undefined
                                    : value === NONE
                                      ? ''
                                      : value,
                            )
                        }
                        searchable
                        value={albumValue}
                        width="100%"
                    />
                </div>
                <span className={styles.toolbarSpacer} />
                <ActionIcon
                    aria-pressed={view === 'cards'}
                    icon={view === 'cards' ? 'layoutGrid' : 'layoutList'}
                    iconProps={{ size: 'lg' }}
                    onClick={() => onView(view === 'cards' ? 'list' : 'cards')}
                    tooltip={{
                        label: t(
                            view === 'cards'
                                ? 'lubox.library.view.list'
                                : 'lubox.library.view.cards',
                        ),
                    }}
                    variant="subtle"
                />
                {lastBatch && (
                    <Button
                        leftSection={<Icon icon="undo" />}
                        onClick={onUndo}
                        title={lastBatch.label || undefined}
                        variant="subtle"
                    >
                        {t('lubox.batch.undo.button', { count: lastBatch.count })}
                    </Button>
                )}
                <Button
                    aria-pressed={isSelecting}
                    leftSection={<Icon icon={isSelecting ? 'squareCheck' : 'square'} />}
                    onClick={onSelectToggle}
                    variant={isSelecting ? 'filled' : 'default'}
                >
                    {t('lubox.library.select.toggle')}
                </Button>
            </div>
        </FilterBar>
    );
};
