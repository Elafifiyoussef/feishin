import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from '../library/library.module.css';

import { getLuboxErrorMessage } from '/@/renderer/features/lubox/api/client';
import {
    luboxKeys,
    luboxLibraryQueries,
    luboxTrashQueries,
    restoreFromTrash,
} from '/@/renderer/features/lubox/api/lubox-api';
import { TrashItem } from '/@/renderer/features/lubox/api/types';
import { afterLuboxChange } from '/@/renderer/features/lubox/batch/after-change';
import { openUndoDialog } from '/@/renderer/features/lubox/batch/open-dialogs';
import { LuboxCover } from '/@/renderer/features/lubox/components/lubox-cover';
import { LuboxPage } from '/@/renderer/features/lubox/components/lubox-page';
import { LuboxStateMessage } from '/@/renderer/features/lubox/components/lubox-state-message';
import { useLuboxAccess } from '/@/renderer/features/lubox/hooks/use-lubox-access';
import { useLibrarySelection } from '/@/renderer/features/lubox/library/use-library-selection';
import { openPurgeDialog } from '/@/renderer/features/lubox/trash/purge-dialog';
import { Badge } from '/@/shared/components/badge/badge';
import { Button } from '/@/shared/components/button/button';
import { Checkbox } from '/@/shared/components/checkbox/checkbox';
import { Icon } from '/@/shared/components/icon/icon';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { toast } from '/@/shared/components/toast/toast';

const formatSize = (bytes: null | number) =>
    bytes ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : '';

const TrashRow = ({
    index,
    isSelected,
    item,
    onToggle,
}: {
    index: number;
    isSelected: boolean;
    item: TrashItem;
    onToggle: (index: number, shift: boolean) => void;
}) => {
    const { t } = useTranslation();
    const trashed = item.trashed_at ? new Date(item.trashed_at * 1000).toLocaleDateString() : '';

    return (
        <li>
            <div
                aria-checked={isSelected}
                aria-label={item.title || item.video_id}
                className={styles.row}
                data-selected={isSelected}
                onClick={(event) => onToggle(index, event.shiftKey)}
                onKeyDown={(event) => {
                    if (event.key === ' ' || event.key === 'Enter') {
                        event.preventDefault();
                        onToggle(index, event.shiftKey);
                    }
                }}
                role="checkbox"
                tabIndex={0}
            >
                <span className={styles.check}>
                    <Checkbox checked={isSelected} onChange={() => {}} tabIndex={-1} />
                </span>
                <LuboxCover videoId={item.video_id} />
                <div style={{ minWidth: 0 }}>
                    <div className={styles.titleLine}>
                        <span className={styles.titleText} title={item.title ?? undefined}>
                            {item.title || item.video_id}
                        </span>
                        {!item.restorable && (
                            <Badge title={item.reason ?? undefined} variant="outline">
                                {item.in_library
                                    ? t('lubox.trash.badge.again')
                                    : t('lubox.trash.badge.gone')}
                            </Badge>
                        )}
                    </div>
                    <div className={styles.sub} title={item.artist ?? undefined}>
                        {item.artist}
                    </div>
                </div>
                <span className={`${styles.rowAlbum} ${styles.sub}`} title={item.album ?? ''}>
                    {item.album}
                </span>
                <span className={`${styles.muted} ${styles.num}`}>{formatSize(item.size)}</span>
                <span className={`${styles.rowAdded} ${styles.muted}`}>{trashed}</span>
            </div>
        </li>
    );
};

/** Trash: everything an admin moved to the trash, with Restore for the selected tracks. */
export const TrashPage = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const selection = useLibrarySelection();
    const [restoring, setRestoring] = useState(false);

    // the trash is admin only in lubox: do not even ask for it otherwise
    const { isAdmin } = useLuboxAccess();
    const { data: lastBatch } = useQuery({
        ...luboxLibraryQueries.lastBatch(),
        enabled: isAdmin,
    });
    const query = useInfiniteQuery({ ...luboxTrashQueries.list(), enabled: isAdmin });
    const items = useMemo(
        () => query.data?.pages.flatMap((page) => page.items) ?? [],
        [query.data],
    );
    const ids = useMemo(() => items.map((item) => item.video_id), [items]);
    const total = query.data?.pages[0]?.total;
    const count = selection.selected.size;
    // tracks that were downloaded again (or whose file is gone) can not be restored
    const restorableIds = useMemo(
        () =>
            items
                .filter((item) => item.restorable && selection.selected.has(item.video_id))
                .map((item) => item.video_id),
        [items, selection.selected],
    );

    const restore = async () => {
        setRestoring(true);
        try {
            const result = await restoreFromTrash(restorableIds);
            if (result.restored.length > 0) {
                toast.success({
                    message: t('lubox.trash.restored', { count: result.restored.length }),
                });
                afterLuboxChange(queryClient, { fast: true });
            }
            if (result.failed.length > 0) {
                toast.error({ message: t('lubox.trash.failed', { count: result.failed.length }) });
            }
            selection.clear();
            queryClient.invalidateQueries({ queryKey: luboxKeys.trash() });
        } catch (error) {
            toast.error({ message: getLuboxErrorMessage(error) });
        } finally {
            setRestoring(false);
        }
    };

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
    } else if (items.length === 0) {
        body = <LuboxStateMessage icon="delete" title={t('lubox.trash.empty')} />;
    } else {
        body = (
            <div className={styles.page}>
                <ul className={styles.list}>
                    {items.map((item, index) => (
                        <TrashRow
                            index={index}
                            isSelected={selection.selected.has(item.video_id)}
                            item={item}
                            key={item.video_id}
                            onToggle={(i, shift) => selection.toggle(ids, i, shift)}
                        />
                    ))}
                </ul>
                {query.hasNextPage && (
                    <div className={styles.more}>
                        <Button
                            loading={query.isFetchingNextPage}
                            onClick={() => query.fetchNextPage()}
                            variant="default"
                        >
                            {t('lubox.trash.loadMore')}
                        </Button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <LuboxPage
            adminOnly
            count={total}
            footer={
                items.length > 0 && (
                    <div className={styles.selectionBar}>
                        <Checkbox
                            aria-label={t('lubox.library.select.all')}
                            checked={count > 0 && count === ids.length}
                            indeterminate={count > 0 && count < ids.length}
                            onChange={() =>
                                count === ids.length
                                    ? selection.clear()
                                    : selection.selectLoaded(ids)
                            }
                        />
                        <span aria-live="polite">
                            {count === 0
                                ? t('lubox.trash.selectNone')
                                : t('lubox.trash.selected', { count })}
                        </span>
                        <div className={styles.selectionActions}>
                            <Button
                                color="red"
                                disabled={count === 0}
                                onClick={() =>
                                    openPurgeDialog(
                                        {
                                            count,
                                            ids: [...selection.selected],
                                            size: items
                                                .filter((i) => selection.selected.has(i.video_id))
                                                .reduce((n, i) => n + (i.size ?? 0), 0),
                                        },
                                        selection.clear,
                                    )
                                }
                                variant="default"
                            >
                                {t('lubox.trash.purge.button')}
                            </Button>
                            <Button
                                disabled={restorableIds.length === 0}
                                leftSection={<Icon icon="refresh" />}
                                loading={restoring}
                                onClick={restore}
                                variant="default"
                            >
                                {t('lubox.trash.restore')}
                            </Button>
                        </div>
                    </div>
                )
            }
            headerActions={
                // the header is a shrinking flex row: keep the labels whole
                <div
                    style={{
                        display: 'flex',
                        flexShrink: 0,
                        gap: 'var(--theme-spacing-sm)',
                        marginRight: 'var(--theme-spacing-md)',
                    }}
                >
                    {lastBatch && (
                        <Button
                            leftSection={<Icon icon="refresh" />}
                            onClick={() =>
                                openUndoDialog({
                                    last: lastBatch,
                                    onDone: () =>
                                        queryClient.invalidateQueries({
                                            queryKey: luboxKeys.trash(),
                                        }),
                                })
                            }
                            style={{ flexShrink: 0 }}
                            title={lastBatch.label || undefined}
                            variant="default"
                        >
                            {t('lubox.trash.undo')}
                        </Button>
                    )}
                    {(total ?? 0) > 0 && (
                        <Button
                            onClick={() =>
                                openPurgeDialog(
                                    { count: total ?? 0, size: query.data?.pages[0]?.size },
                                    selection.clear,
                                )
                            }
                            style={{ flexShrink: 0 }}
                            variant="default"
                        >
                            {t('lubox.trash.emptyTrash')}
                        </Button>
                    )}
                </div>
            }
            title={t('lubox.pages.trash.title')}
        >
            {body}
        </LuboxPage>
    );
};
