import { useTranslation } from 'react-i18next';

import styles from './downloader.module.css';

import { CheckedItem, SelectableCheckEntry } from '/@/renderer/features/lubox/downloader/types';
import { Badge } from '/@/shared/components/badge/badge';
import { Button } from '/@/shared/components/button/button';
import { Checkbox } from '/@/shared/components/checkbox/checkbox';
import { AppIconSelection, Icon, IconColor } from '/@/shared/components/icon/icon';

const formatDuration = (seconds?: null | number) =>
    seconds
        ? `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`
        : '';

const STATUS_ICON: Record<string, { color: IconColor; icon: AppIconSelection }> = {
    blocked: { color: 'warn', icon: 'mediaPause' },
    error: { color: 'warn', icon: 'warn' },
    invalid: { color: 'error', icon: 'xCircle' },
    unavailable: { color: 'error', icon: 'xCircle' },
};

const Meta = ({ parts }: { parts: (false | null | string | undefined)[] }) => (
    <div className={styles.meta}>
        {parts
            .filter((part): part is string => Boolean(part))
            .map((part, index) => (
                <span key={`${part}-${index}`}>{index > 0 ? `· ${part}` : part}</span>
            ))}
    </div>
);

interface CheckResultRowProps {
    item: CheckedItem;
    onChange: (next: CheckedItem) => void;
    onWholePlaylist: (item: CheckedItem) => void;
}

const CheckResultRow = ({ item, onChange, onWholePlaylist }: CheckResultRowProps) => {
    const { t } = useTranslation();

    if (item.status !== 'ok') {
        const mark = STATUS_ICON[item.status] ?? STATUS_ICON.error;
        return (
            <li className={styles.row}>
                <span className={styles.rowLead}>
                    <Icon color={mark.color} icon={mark.icon} />
                </span>
                <div className={styles.body}>
                    <div className={styles.titleText} title={item.raw}>
                        {item.raw}
                    </div>
                    {item.error && <div className={styles.hint}>{item.error}</div>}
                </div>
            </li>
        );
    }

    const entries = item.entries ?? [];

    const setEntry = (entry: SelectableCheckEntry, selected: boolean) =>
        onChange({
            ...item,
            entries: entries.map((e) => (e === entry ? { ...e, selected } : e)),
        });

    if (item.kind === 'video') {
        return (
            <li className={styles.row}>
                <span className={styles.rowLead}>
                    <Checkbox
                        aria-label={item.title || item.raw}
                        checked={item.selected}
                        onChange={(event) =>
                            onChange({ ...item, selected: event.currentTarget.checked })
                        }
                    />
                </span>
                <div className={styles.body}>
                    <div className={styles.title}>
                        <span className={styles.titleText} title={item.title}>
                            {item.title}
                        </span>
                        {item.in_library && (
                            <Badge>{t('lubox.downloader.results.inLibrary')}</Badge>
                        )}
                    </div>
                    <Meta parts={[item.uploader, formatDuration(item.duration)]} />
                    {item.playlist_url && (
                        <Button
                            onClick={() => onWholePlaylist(item)}
                            size="compact-xs"
                            variant="subtle"
                        >
                            {t('lubox.downloader.results.wholePlaylist')}
                        </Button>
                    )}
                </div>
            </li>
        );
    }

    const count = item.count ?? 0;
    const chosen = entries.filter((e) => e.selected && !e.skip).length;

    return (
        <li className={styles.row}>
            <span className={styles.rowLead}>
                <Checkbox
                    aria-label={item.title || item.playlist_id || item.raw}
                    checked={item.selected}
                    onChange={(event) =>
                        onChange({ ...item, selected: event.currentTarget.checked })
                    }
                />
            </span>
            <div className={styles.body}>
                <div className={styles.title}>
                    <span className={styles.titleText} title={item.title}>
                        {item.title || item.playlist_id}
                    </span>
                </div>
                <Meta
                    parts={[
                        t('lubox.downloader.results.playlist'),
                        item.uploader,
                        chosen === count
                            ? t('lubox.downloader.results.videos', { count })
                            : t('lubox.downloader.results.videosOf', { chosen, count }),
                    ]}
                />
                <Button
                    aria-expanded={item.open}
                    onClick={() => onChange({ ...item, open: !item.open })}
                    size="compact-xs"
                    variant="subtle"
                >
                    {item.open
                        ? t('lubox.downloader.results.hideVideos')
                        : t('lubox.downloader.results.chooseVideos')}
                </Button>
                {item.open && (
                    <ol className={styles.entries}>
                        {entries.map((entry) => (
                            <li
                                className={styles.entry}
                                data-skipped={Boolean(entry.skip)}
                                key={`${entry.position}-${entry.id}`}
                            >
                                <Checkbox
                                    aria-label={entry.title || entry.id || ''}
                                    checked={entry.selected && !entry.skip}
                                    disabled={Boolean(entry.skip)}
                                    onChange={(event) =>
                                        setEntry(entry, event.currentTarget.checked)
                                    }
                                />
                                <span className={styles.entryPosition}>{entry.position}</span>
                                <div className={styles.body}>
                                    <div className={styles.title}>
                                        <span className={styles.titleText} title={entry.title}>
                                            {entry.title}
                                        </span>
                                        {entry.skip && <Badge>{entry.skip}</Badge>}
                                        {entry.in_library && (
                                            <Badge>{t('lubox.downloader.results.inLibrary')}</Badge>
                                        )}
                                    </div>
                                    <Meta
                                        parts={[entry.uploader, formatDuration(entry.duration)]}
                                    />
                                </div>
                            </li>
                        ))}
                    </ol>
                )}
            </div>
        </li>
    );
};

interface CheckResultsProps {
    downloadEta: string;
    downloadHint: string;
    isDownloading: boolean;
    items: CheckedItem[];
    onChange: (items: CheckedItem[]) => void;
    onDownload: () => void;
    onWholePlaylist: (item: CheckedItem) => void;
    selectedCount: number;
}

/** Per-URL check results and the Download bar (with the estimated time on the button). */
export const CheckResults = ({
    downloadEta,
    downloadHint,
    isDownloading,
    items,
    onChange,
    onDownload,
    onWholePlaylist,
    selectedCount,
}: CheckResultsProps) => {
    const { t } = useTranslation();

    if (items.length === 0) return null;

    return (
        <section>
            <ul className={styles.list}>
                {items.map((item, index) => (
                    <CheckResultRow
                        item={item}
                        key={`${item.raw}-${index}`}
                        onChange={(next) =>
                            onChange(items.map((existing) => (existing === item ? next : existing)))
                        }
                        onWholePlaylist={onWholePlaylist}
                    />
                ))}
            </ul>
            <div className={styles.actionBar}>
                <span aria-live="polite" className={styles.hint}>
                    {selectedCount
                        ? t('lubox.downloader.results.selected', { count: selectedCount })
                        : t('lubox.downloader.results.nothingSelected')}
                </span>
                <Button
                    disabled={selectedCount === 0}
                    leftSection={<Icon icon="download" />}
                    loading={isDownloading}
                    onClick={onDownload}
                    title={downloadHint || undefined}
                    variant="filled"
                >
                    {t('lubox.downloader.results.download')}
                    {selectedCount > 0 && downloadEta ? ` · ${downloadEta}` : ''}
                </Button>
            </div>
        </section>
    );
};
