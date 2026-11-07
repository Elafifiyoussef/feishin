import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './library.module.css';

import { loadedSelectionState } from '/@/renderer/features/lubox/lib/library';
import { Button } from '/@/shared/components/button/button';
import { Checkbox } from '/@/shared/components/checkbox/checkbox';

interface SelectionBarProps {
    /** The batch actions (a later phase) go here. */
    actions?: ReactNode;
    loadedIds: string[];
    onClear: () => void;
    onSelectLoaded: () => void;
    onSelectMatching: () => void;
    reachedLimit: boolean;
    selected: ReadonlySet<string>;
    total: number;
}

/** Pinned under the list in select mode: count, select all loaded, "all N matching", clear. */
export const SelectionBar = ({
    actions,
    loadedIds,
    onClear,
    onSelectLoaded,
    onSelectMatching,
    reachedLimit,
    selected,
    total,
}: SelectionBarProps) => {
    const { t } = useTranslation();
    const count = selected.size;
    const loaded = loadedSelectionState(selected, loadedIds);
    const canSelectMatching = loaded.all && total > count;

    const label =
        count === 0
            ? t('lubox.library.select.none')
            : reachedLimit
              ? t('lubox.library.select.limit', { count })
              : count === total && total > loadedIds.length
                ? t('lubox.library.select.allSelected', { count })
                : t('lubox.library.select.count', { count });

    return (
        <div className={styles.selectionBar}>
            <Checkbox
                aria-label={t('lubox.library.select.all')}
                checked={loaded.all}
                indeterminate={loaded.partial}
                onChange={() => (loaded.all ? onClear() : onSelectLoaded())}
            />
            <span aria-live="polite">{label}</span>
            {canSelectMatching && (
                <Button onClick={onSelectMatching} size="compact-sm" variant="subtle">
                    {t('lubox.library.select.allMatching', { count: total })}
                </Button>
            )}
            {count > 0 && (
                <Button onClick={onClear} size="compact-sm" variant="subtle">
                    {t('lubox.library.select.clear')}
                </Button>
            )}
            {actions && <div className={styles.selectionActions}>{actions}</div>}
        </div>
    );
};
