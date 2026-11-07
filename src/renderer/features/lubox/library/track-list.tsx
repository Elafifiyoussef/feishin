import { KeyboardEvent, memo, MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import styles from './library.module.css';

import { LuboxTrack } from '/@/renderer/features/lubox/api/types';
import { LuboxCover } from '/@/renderer/features/lubox/components/lubox-cover';
import { LuboxPath } from '/@/renderer/features/lubox/constants';
import { LibraryView } from '/@/renderer/features/lubox/library/use-library-filter';
import { Badge } from '/@/shared/components/badge/badge';
import { Checkbox } from '/@/shared/components/checkbox/checkbox';

const formatDuration = (seconds: null | number) =>
    seconds
        ? `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`
        : '';

const trackHref = (track: LuboxTrack) => `${LuboxPath.TRACK}/${encodeURIComponent(track.video_id)}`;

/** Titles and artists are raw YouTube text: shown verbatim, one line, full text on hover. */
const TrackBadges = ({ track }: { track: LuboxTrack }) => {
    const { t } = useTranslation();
    return (
        <>
            {track.albums > 1 && (
                <Badge>{t('lubox.library.badge.albums', { count: track.albums })}</Badge>
            )}
            {track.edited && <Badge>{t('lubox.library.badge.edited')}</Badge>}
            {track.missing && <Badge variant="outline">{t('lubox.library.badge.missing')}</Badge>}
        </>
    );
};

interface ItemProps {
    index: number;
    isSelected: boolean;
    isSelecting: boolean;
    onToggle: (index: number, shift: boolean) => void;
    track: LuboxTrack;
}

/** In select mode a row or card is a checkbox (Tab, then Space or Enter); otherwise it opens the track. */
const useItemProps = ({ index, isSelected, isSelecting, onToggle, track }: ItemProps) => {
    if (!isSelecting) return { component: Link, to: trackHref(track) } as const;

    return {
        'aria-checked': isSelected,
        'aria-label': track.title || track.video_id,
        onClick: (event: MouseEvent) => {
            event.preventDefault();
            onToggle(index, event.shiftKey);
        },
        onKeyDown: (event: KeyboardEvent) => {
            if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault();
                onToggle(index, event.shiftKey);
            }
        },
        role: 'checkbox',
        tabIndex: 0,
    } as const;
};

const TrackRow = memo((props: ItemProps) => {
    const { t } = useTranslation();
    const { isSelected, isSelecting, track } = props;
    const itemProps = useItemProps(props);
    const Root = (isSelecting ? 'div' : Link) as 'div';

    const album = track.album ? `${track.album}${track.track ? ` · #${track.track}` : ''}` : '';
    const added = track.added_at ? new Date(track.added_at * 1000).toLocaleDateString() : '';

    return (
        <li>
            <Root
                className={styles.row}
                data-selected={isSelecting && isSelected}
                {...(itemProps as object)}
            >
                {isSelecting ? (
                    <span className={styles.check}>
                        <Checkbox checked={isSelected} onChange={() => {}} tabIndex={-1} />
                    </span>
                ) : (
                    <span />
                )}
                <LuboxCover videoId={track.video_id} />
                <div style={{ minWidth: 0 }}>
                    <div className={styles.titleLine}>
                        <span className={styles.titleText} title={track.title ?? undefined}>
                            {track.title || track.video_id}
                        </span>
                        <TrackBadges track={track} />
                    </div>
                    <div className={styles.sub} title={track.artist ?? undefined}>
                        {track.artist}
                    </div>
                </div>
                <span
                    className={`${styles.rowAlbum} ${album ? styles.sub : styles.muted}`}
                    title={album}
                >
                    {album || t('lubox.library.album.noneShort')}
                </span>
                <span className={`${styles.muted} ${styles.num}`}>
                    {formatDuration(track.duration)}
                </span>
                <span className={`${styles.rowAdded} ${styles.muted}`}>{added}</span>
            </Root>
        </li>
    );
});

const TrackCard = memo((props: ItemProps) => {
    const { isSelected, isSelecting, track } = props;
    const itemProps = useItemProps(props);
    const Root = (isSelecting ? 'div' : Link) as 'div';

    return (
        <li>
            <Root
                className={styles.card}
                data-selected={isSelecting && isSelected}
                {...(itemProps as object)}
            >
                {isSelecting && (
                    <span className={styles.cardCheck}>
                        <Checkbox checked={isSelected} onChange={() => {}} tabIndex={-1} />
                    </span>
                )}
                <LuboxCover videoId={track.video_id} wide />
                <div style={{ minWidth: 0 }}>
                    <div className={styles.titleLine}>
                        <span className={styles.titleText} title={track.title ?? undefined}>
                            {track.title || track.video_id}
                        </span>
                    </div>
                    <div className={styles.sub} title={track.artist ?? undefined}>
                        {track.artist}
                        {track.duration ? ` · ${formatDuration(track.duration)}` : ''}
                    </div>
                </div>
                <div className={styles.badges}>
                    <TrackBadges track={track} />
                </div>
            </Root>
        </li>
    );
});

interface TrackListProps {
    isSelecting: boolean;
    onToggle: (ids: string[], index: number, shift: boolean) => void;
    selected: ReadonlySet<string>;
    tracks: LuboxTrack[];
    view: LibraryView;
}

export const TrackList = ({ isSelecting, onToggle, selected, tracks, view }: TrackListProps) => {
    const ids = tracks.map((track) => track.video_id);
    const toggle = (index: number, shift: boolean) => onToggle(ids, index, shift);
    const Item = view === 'cards' ? TrackCard : TrackRow;

    return (
        <ul className={view === 'cards' ? styles.grid : styles.list}>
            {tracks.map((track, index) => (
                <Item
                    index={index}
                    isSelected={selected.has(track.video_id)}
                    isSelecting={isSelecting}
                    key={track.video_id}
                    onToggle={toggle}
                    track={track}
                />
            ))}
        </ul>
    );
};
