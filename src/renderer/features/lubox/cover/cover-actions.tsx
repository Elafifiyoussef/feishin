import { closeModal, openModal, updateModal } from '@mantine/modals';
import { useQueryClient } from '@tanstack/react-query';
import i18n from 'i18next';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './cover.module.css';

import { getLuboxErrorMessage, isLuboxError } from '/@/renderer/features/lubox/api/client';
import {
    resetAlbumCover,
    resetTrackCover,
    uploadAlbumCover,
    uploadTrackCover,
} from '/@/renderer/features/lubox/api/lubox-api';
import { afterLuboxChange } from '/@/renderer/features/lubox/batch/after-change';
import { getLuboxApiBase } from '/@/renderer/features/lubox/constants';
import { CropArea, CropExport } from '/@/renderer/features/lubox/cover/crop-area';
import '/@/renderer/features/lubox/i18n/register';
import { bumpCoverVersion, useCoverVersion } from '/@/renderer/features/lubox/lib/cover-version';
import { Button } from '/@/shared/components/button/button';
import { Icon } from '/@/shared/components/icon/icon';
import { toast } from '/@/shared/components/toast/toast';

/**
 * One song (its main file and copies) or every file of one album. `videoId` is the song whose cover
 * the editor starts from (for an album, its first lubox song; none when it has no lubox songs).
 */
export type CoverTarget =
    | { album: string; kind: 'album'; videoId?: string }
    | { kind: 'track'; videoId: string };

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp';

const errorMessage = (error: unknown) => {
    // lubox explains a bad image in fields.image (not an image, empty, too big)
    const field = isLuboxError(error) ? error.fields?.image : undefined;
    return typeof field === 'string' ? field : getLuboxErrorMessage(error);
};

const CoverEditor = ({
    onBusyChange,
    onClose,
    target,
}: {
    onBusyChange: (busy: boolean) => void;
    onClose: () => void;
    target: CoverTarget;
}) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const input = useRef<HTMLInputElement>(null);
    const exportCrop = useRef<CropExport | null>(null);
    const version = useCoverVersion(target.videoId ?? '');
    const [file, setFile] = useState<File | null>(null);
    const [fileUrl, setFileUrl] = useState<null | string>(null);
    const [problem, setProblem] = useState('');
    const [busy, setBusy] = useState<'' | 'reset' | 'save'>('');

    useEffect(() => onBusyChange(busy !== ''), [busy, onBusyChange]);

    // a chosen file is shown from a local object URL, released when it changes or the editor closes
    useEffect(() => {
        if (!file) return undefined;
        const url = URL.createObjectURL(file);
        setFileUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    // the editor starts from the current cover; a chosen image replaces it
    const currentCover = target.videoId
        ? `${getLuboxApiBase()}/tracks/${encodeURIComponent(target.videoId)}/cover${version ? `?v=${version}` : ''}`
        : null;
    const src = fileUrl ?? currentCover;

    const pick = (event: ChangeEvent<HTMLInputElement>) => {
        const chosen = event.currentTarget.files?.[0] ?? null;
        event.currentTarget.value = '';
        if (!chosen) return;
        if (!ACCEPT.split(',').includes(chosen.type)) return setProblem(t('lubox.cover.wrongType'));
        if (chosen.size > MAX_BYTES) return setProblem(t('lubox.cover.tooBig'));
        setProblem('');
        setFile(chosen);
    };

    /** Both actions end the same way: new images in lubox's lists now, Navidrome's after its rescan. */
    const finish = (title: string, files?: number) => {
        bumpCoverVersion(target.kind === 'track' ? target.videoId : undefined);
        afterLuboxChange(queryClient);
        toast.success({
            message:
                target.kind === 'album'
                    ? t('lubox.cover.savedAlbum', { count: files ?? 0 })
                    : t('lubox.cover.saved'),
            title,
        });
        onClose();
    };

    const run = async (
        kind: 'reset' | 'save',
        task: () => Promise<{ files: number } | { ok: boolean }>,
        title: string,
    ) => {
        setBusy(kind);
        setProblem('');
        try {
            const result = await task();
            finish(title, 'files' in result ? result.files : undefined);
        } catch (error) {
            setProblem(errorMessage(error));
            setBusy('');
        }
    };

    const save = () =>
        run(
            'save',
            async () => {
                const image = await exportCrop.current?.();
                if (!image) throw new Error(t('lubox.cover.noImage'));
                return target.kind === 'track'
                    ? uploadTrackCover(target.videoId, image)
                    : uploadAlbumCover(target.album, image);
            },
            t('lubox.cover.changed'),
        );

    const reset = () =>
        run(
            'reset',
            () =>
                target.kind === 'track'
                    ? resetTrackCover(target.videoId)
                    : resetAlbumCover(target.album),
            t('lubox.cover.wasReset'),
        );

    return (
        <div className={styles.body}>
            <p className={styles.note}>
                {target.kind === 'album'
                    ? t('lubox.cover.albumNote', { album: target.album })
                    : t('lubox.cover.trackNote')}
            </p>
            <CropArea exportRef={exportCrop} src={src} />
            <input accept={ACCEPT} hidden onChange={pick} ref={input} type="file" />
            {problem && <p className={styles.problem}>{problem}</p>}
            <div className={styles.actions}>
                <div className={styles.actionsGroup}>
                    <Button
                        disabled={busy !== ''}
                        leftSection={<Icon icon="upload" />}
                        onClick={() => input.current?.click()}
                        variant="default"
                    >
                        {t('lubox.cover.choose')}
                    </Button>
                    <Button
                        disabled={busy === 'save'}
                        leftSection={<Icon icon="undo" />}
                        loading={busy === 'reset'}
                        onClick={reset}
                        title={t('lubox.cover.resetHint')}
                        variant="subtle"
                    >
                        {t('lubox.cover.reset')}
                    </Button>
                </div>
                <div className={styles.actionsGroup}>
                    <Button disabled={busy !== ''} onClick={onClose} variant="default">
                        {t('lubox.cover.cancel')}
                    </Button>
                    <Button
                        disabled={!src || busy === 'reset'}
                        loading={busy === 'save'}
                        onClick={save}
                        variant="filled"
                    >
                        {t('lubox.cover.save')}
                    </Button>
                </div>
            </div>
        </div>
    );
};

let counter = 0;

/**
 * The cover editor: crop the current cover (or a chosen image) to a square, or go back to the
 * original. Nothing is written until Save or Reset.
 */
export function openCoverEditor(target: CoverTarget) {
    const modalId = `lubox-cover-${(counter += 1)}`;
    openModal({
        children: (
            <CoverEditor
                // while saving the dialog can not be closed
                onBusyChange={(busy) =>
                    updateModal({ closeOnEscape: !busy, modalId, withCloseButton: !busy })
                }
                onClose={() => closeModal(modalId)}
                target={target}
            />
        ),
        closeOnClickOutside: false,
        modalId,
        title: i18n.t(target.kind === 'album' ? 'lubox.cover.titleAlbum' : 'lubox.cover.title'),
    });
}
