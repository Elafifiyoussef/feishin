import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './batch.module.css';

import { getMuboxErrorMessage } from '/@/renderer/features/mubox/api/client';
import {
    fetchTrackDetail,
    patchTrack,
    revertTrack,
} from '/@/renderer/features/mubox/api/mubox-api';
import { MuboxTrackDetail, TagField } from '/@/renderer/features/mubox/api/types';
import { afterMuboxChange } from '/@/renderer/features/mubox/batch/after-change';
import { Button } from '/@/shared/components/button/button';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { toast } from '/@/shared/components/toast/toast';

const FIELDS: TagField[] = ['title', 'artist', 'album', 'track', 'date'];

const asText = (value: null | number | string | undefined) =>
    value === null || value === undefined ? '' : String(value);

const TagsForm = ({
    detail,
    onClose,
    onSaved,
}: {
    detail: MuboxTrackDetail;
    onClose: () => void;
    onSaved: () => void;
}) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [values, setValues] = useState<Record<TagField, string>>(
        () =>
            Object.fromEntries(FIELDS.map((f) => [f, asText(detail.tags[f])])) as Record<
                TagField,
                string
            >,
    );
    const [saving, setSaving] = useState(false);

    const changed = FIELDS.filter((f) => values[f] !== asText(detail.tags[f]));
    // a tag can be reverted when it was edited by hand or differs from what the download came with
    const revertible = FIELDS.filter(
        (f) => f in detail.edits || asText(detail.tags[f]) !== asText(detail.raw[f]),
    );

    const run = async (task: () => Promise<unknown>) => {
        setSaving(true);
        try {
            await task();
            afterMuboxChange(queryClient);
            toast.success({ message: t('mubox.editTags.saved') });
            onSaved();
            onClose();
        } catch (error) {
            toast.error({ message: getMuboxErrorMessage(error) });
            setSaving(false);
        }
    };

    const save = () =>
        run(() =>
            patchTrack(
                detail.video_id,
                Object.fromEntries(changed.map((f) => [f, values[f].trim()])),
            ),
        );

    return (
        <div className={styles.body}>
            {FIELDS.map((field) => (
                <TextInput
                    data-autofocus={field === 'title' ? true : undefined}
                    disabled={saving}
                    key={field}
                    label={t(`mubox.editTags.fields.${field}`)}
                    onChange={(event) => {
                        const value = event.currentTarget.value;
                        setValues((current) => ({ ...current, [field]: value }));
                    }}
                    placeholder={
                        field === 'date' ? t('mubox.batch.fields.datePlaceholder') : undefined
                    }
                    value={values[field]}
                />
            ))}
            <div className={styles.fieldRow} style={{ justifyContent: 'space-between' }}>
                <Button
                    disabled={saving || revertible.length === 0}
                    onClick={() => run(() => revertTrack(detail.video_id, revertible))}
                    variant="subtle"
                >
                    {t('mubox.editTags.revert')}
                </Button>
                <div className={styles.fieldRow}>
                    <Button disabled={saving} onClick={onClose} variant="default">
                        {t('mubox.editTags.cancel')}
                    </Button>
                    <Button
                        disabled={changed.length === 0}
                        loading={saving}
                        onClick={save}
                        variant="filled"
                    >
                        {t('mubox.editTags.save')}
                    </Button>
                </div>
            </div>
        </div>
    );
};

/** Edit one track's tags by hand: title, artist, album, track number, date. Revert restores the download's tags. */
export const EditTagsDialogBody = ({
    onClose,
    videoId,
}: {
    onClose: () => void;
    videoId: string;
}) => {
    const { t } = useTranslation();
    const query = useQuery({
        queryFn: () => fetchTrackDetail(videoId),
        queryKey: ['mubox', 'track-detail', videoId],
        retry: false,
        staleTime: 0,
    });

    if (query.isLoading) return <Spinner container />;
    if (query.isError || !query.data) {
        return (
            <p>{query.error ? getMuboxErrorMessage(query.error) : t('mubox.editTags.notFound')}</p>
        );
    }

    return <TagsForm detail={query.data} onClose={onClose} onSaved={() => {}} />;
};
