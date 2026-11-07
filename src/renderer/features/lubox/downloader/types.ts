import { CheckEntry, CheckItem } from '/@/renderer/features/lubox/api/types';

/** A /check result plus the local selection state. */
export type CheckedItem = Omit<CheckItem, 'entries'> & {
    entries?: SelectableCheckEntry[];
    /** playlist: the video list is expanded */
    open: boolean;
    selected: boolean;
};

export type SelectableCheckEntry = CheckEntry & { selected: boolean };

export const toCheckedItem = (item: CheckItem): CheckedItem => ({
    ...item,
    entries: item.entries?.map((entry) => ({ ...entry, selected: !entry.skip })),
    open: false,
    selected: item.status === 'ok',
});
