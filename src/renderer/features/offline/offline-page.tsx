import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './offline.module.css';

import { PageHeader } from '/@/renderer/components/page-header/page-header';
import { MuboxStateMessage } from '/@/renderer/features/mubox/components/mubox-state-message';
import '/@/renderer/features/mubox/i18n/register';
import {
    cancelKeepOffline,
    entryToSong,
    removeKept,
    useOfflineStore,
} from '/@/renderer/features/offline/offline-store';
import { usePlayer } from '/@/renderer/features/player/context/player-context';
import { AnimatedPage } from '/@/renderer/features/shared/components/animated-page';
import { LibraryHeaderBar } from '/@/renderer/features/shared/components/library-header-bar';
import { PageErrorBoundary } from '/@/renderer/features/shared/components/page-error-boundary';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Button } from '/@/shared/components/button/button';
import { Icon } from '/@/shared/components/icon/icon';
import { ScrollArea } from '/@/shared/components/scroll-area/scroll-area';
import { SegmentedControl } from '/@/shared/components/segmented-control/segmented-control';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { OfflineEntry, offlineUrl } from '/@/shared/types/offline-types';
import { Play } from '/@/shared/types/types';

const formatSize = (bytes: number) =>
    bytes >= 1024 ** 3
        ? `${(bytes / 1024 ** 3).toFixed(1)} GB`
        : `${(bytes / 1024 ** 2).toFixed(1)} MB`;

const formatTime = (ms: number) => {
    const total = Math.round((ms || 0) / 1000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

interface AlbumGroup {
    albumId: string;
    artist: string;
    cover: null | string;
    entries: OfflineEntry[];
    name: string;
    size: number;
}

const Cover = ({ entry }: { entry: OfflineEntry | undefined }) =>
    entry?.cover ? (
        <img
            alt=""
            className={styles.cover}
            loading="lazy"
            src={offlineUrl('cover', entry.serverId, entry.songId)}
        />
    ) : (
        <span className={styles.cover}>
            <Icon color="muted" icon="emptySongImage" />
        </span>
    );

const DownloadProgress = () => {
    const { t } = useTranslation();
    const job = useOfflineStore((state) => state.job);
    if (!job) return null;

    const fraction =
        job.total > 0
            ? (job.done + (job.bytesTotal > 0 ? job.bytes / job.bytesTotal : 0)) / job.total
            : 0;

    return (
        <div className={styles.progressCard}>
            <div className={styles.progressHead}>
                <span>{t('mubox.offline.progress', { done: job.done, total: job.total })}</span>
                <Button onClick={cancelKeepOffline} size="compact-sm" variant="default">
                    {t('common.cancel')}
                </Button>
            </div>
            <div className={styles.bar}>
                <div
                    className={styles.barFill}
                    style={{ width: `${Math.min(100, fraction * 100)}%` }}
                />
            </div>
            <span className={styles.muted}>{job.current}</span>
        </div>
    );
};

const OfflineContent = () => {
    const { t } = useTranslation();
    const player = usePlayer();
    const entries = useOfflineStore((state) => state.entries);
    const [query, setQuery] = useState('');
    const [view, setView] = useState('albums');

    const all = useMemo(
        () =>
            Object.values(entries).sort(
                (a, b) =>
                    String(a.song.album).localeCompare(String(b.song.album)) ||
                    (a.song.discNumber ?? 0) - (b.song.discNumber ?? 0) ||
                    (a.song.trackNumber ?? 0) - (b.song.trackNumber ?? 0),
            ),
        [entries],
    );
    const totalSize = useMemo(() => all.reduce((sum, entry) => sum + entry.size, 0), [all]);

    const matching = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return all;
        return all.filter((entry) =>
            [entry.song.name, entry.song.artistName, entry.song.album, entry.song.albumArtistName]
                .join(' ')
                .toLowerCase()
                .includes(needle),
        );
    }, [all, query]);

    const albums = useMemo(() => {
        const groups = new Map<string, AlbumGroup>();
        for (const entry of matching) {
            const id = `${entry.serverId}/${entry.song.albumId}`;
            const group: AlbumGroup = groups.get(id) ?? {
                albumId: id,
                artist: entry.song.albumArtistName || entry.song.artistName,
                cover: null,
                entries: [],
                name: entry.song.album || t('mubox.offline.unknownAlbum'),
                size: 0,
            };
            group.entries.push(entry);
            group.size += entry.size;
            groups.set(id, group);
        }
        return [...groups.values()];
    }, [matching, t]);

    const play = (list: OfflineEntry[]) => player.addToQueueByData(list.map(entryToSong), Play.NOW);

    if (all.length === 0) {
        return (
            <>
                <DownloadProgress />
                <MuboxStateMessage
                    description={t('mubox.offline.emptyDescription')}
                    icon="server"
                    title={t('mubox.offline.empty')}
                />
            </>
        );
    }

    return (
        <div className={styles.page}>
            <DownloadProgress />
            <div className={styles.toolbar}>
                <TextInput
                    aria-label={t('mubox.offline.search')}
                    className={styles.search}
                    leftSection={<Icon icon="search" />}
                    onChange={(event) => setQuery(event.currentTarget.value)}
                    placeholder={t('mubox.offline.search')}
                    value={query}
                />
                <SegmentedControl
                    data={[
                        { label: t('mubox.offline.albums'), value: 'albums' },
                        { label: t('mubox.offline.songs'), value: 'songs' },
                    ]}
                    onChange={setView}
                    value={view}
                />
                <span className={styles.spacer} />
                <span className={styles.muted}>
                    {t('mubox.offline.space', { count: all.length, size: formatSize(totalSize) })}
                </span>
                <Button
                    color="red"
                    leftSection={<Icon icon="delete" />}
                    onClick={() => removeKept({ all: true })}
                    variant="default"
                >
                    {t('mubox.offline.removeAll')}
                </Button>
            </div>

            {matching.length === 0 && (
                <MuboxStateMessage icon="search" title={t('mubox.offline.noMatch')} />
            )}

            {view === 'albums' && albums.length > 0 && (
                <ul className={styles.list}>
                    {albums.map((album) => (
                        <li className={styles.row} key={album.albumId}>
                            <Cover entry={album.entries.find((entry) => entry.cover)} />
                            <div className={styles.titles}>
                                <span className={styles.title}>{album.name}</span>
                                <span className={styles.muted}>{album.artist}</span>
                            </div>
                            <span className={styles.muted}>
                                {t('mubox.offline.songCount', { count: album.entries.length })}
                            </span>
                            <span className={styles.muted}>{formatSize(album.size)}</span>
                            <span className={styles.actions}>
                                <ActionIcon
                                    aria-label={t('player.play')}
                                    icon="mediaPlay"
                                    onClick={() => play(album.entries)}
                                    variant="subtle"
                                />
                                <ActionIcon
                                    aria-label={t('mubox.offline.removeCopy')}
                                    icon="delete"
                                    onClick={() =>
                                        removeKept({
                                            keys: album.entries.map((entry) => entry.key),
                                        })
                                    }
                                    variant="subtle"
                                />
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            {view === 'songs' && matching.length > 0 && (
                <ul className={styles.list}>
                    {matching.map((entry) => (
                        <li className={styles.row} key={entry.key}>
                            <Cover entry={entry} />
                            <div className={styles.titles}>
                                <span className={styles.title}>{String(entry.song.name)}</span>
                                <span className={styles.muted}>
                                    {[entry.song.artistName, entry.song.album]
                                        .filter(Boolean)
                                        .join(' - ')}
                                </span>
                            </div>
                            <span className={styles.muted}>{formatTime(entry.song.duration)}</span>
                            <span className={styles.muted}>{formatSize(entry.size)}</span>
                            <span className={styles.actions}>
                                <ActionIcon
                                    aria-label={t('player.play')}
                                    icon="mediaPlay"
                                    onClick={() => play([entry])}
                                    variant="subtle"
                                />
                                <ActionIcon
                                    aria-label={t('mubox.offline.removeCopy')}
                                    icon="delete"
                                    onClick={() => removeKept({ keys: [entry.key] })}
                                    variant="subtle"
                                />
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

/** Songs kept on this device: listed from the local index, playable with no server. Desktop app only. */
export const OfflinePage = () => {
    const { t } = useTranslation();
    const count = useOfflineStore((state) => Object.keys(state.entries).length);

    return (
        <AnimatedPage>
            <PageErrorBoundary>
                <PageHeader>
                    <LibraryHeaderBar ignoreMaxWidth>
                        <LibraryHeaderBar.Title>{t('mubox.offline.title')}</LibraryHeaderBar.Title>
                        <LibraryHeaderBar.Badge>{count}</LibraryHeaderBar.Badge>
                    </LibraryHeaderBar>
                </PageHeader>
                <ScrollArea>
                    <OfflineContent />
                </ScrollArea>
            </PageErrorBoundary>
        </AnimatedPage>
    );
};
