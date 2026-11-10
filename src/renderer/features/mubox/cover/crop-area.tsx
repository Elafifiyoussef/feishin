import { MutableRefObject, PointerEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './cover.module.css';

import {
    centeredView,
    clampView,
    cropRect,
    CropView,
    MAX_ZOOM,
    MIN_ZOOM,
    zoomAt,
} from '/@/renderer/features/mubox/lib/crop';
import { Icon } from '/@/shared/components/icon/icon';
import { Slider } from '/@/shared/components/slider/slider';

/** The crop box, in CSS pixels. The saved image is up to MAX_OUTPUT pixels square. */
const VIEW = 288;
const MAX_OUTPUT = 1200;

/** Returns the cropped square as a JPEG, or null while there is no image. */
export type CropExport = () => Promise<Blob | null>;

interface CropAreaProps {
    /** Filled with a function that renders the current crop, for the dialog's Save button. */
    exportRef: MutableRefObject<CropExport | null>;
    src: null | string;
}

/**
 * A square crop box like phone photo editors: drag the image to move it, zoom with the slider or the
 * mouse wheel. It always stays covered, so what you see in the box is exactly what is saved.
 */
export const CropArea = ({ exportRef, src }: CropAreaProps) => {
    const { t } = useTranslation();
    const box = useRef<HTMLDivElement>(null);
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [failed, setFailed] = useState(false);
    const [view, setView] = useState<CropView | null>(null);
    const drag = useRef<null | { x: number; y: number }>(null);

    // load the source; a new source starts centred and zoomed out
    useEffect(() => {
        setImage(null);
        setView(null);
        setFailed(false);
        if (!src) return undefined;
        let live = true;
        const img = new Image();
        img.onload = () => {
            if (!live) return;
            setImage(img);
            setView(centeredView(img.naturalWidth, img.naturalHeight, VIEW));
        };
        img.onerror = () => live && setFailed(true);
        img.src = src;
        return () => {
            live = false;
        };
    }, [src]);

    const w = image?.naturalWidth ?? 1;
    const h = image?.naturalHeight ?? 1;

    // the wheel needs a non-passive listener, or the page would scroll instead of zooming
    useEffect(() => {
        const el = box.current;
        if (!el || !image) return undefined;
        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            const rect = el.getBoundingClientRect();
            setView((current) =>
                current
                    ? zoomAt(
                          current,
                          current.zoom * Math.exp(-event.deltaY * 0.0015),
                          event.clientX - rect.left,
                          event.clientY - rect.top,
                          w,
                          h,
                          VIEW,
                      )
                    : current,
            );
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [image, w, h]);

    exportRef.current = async () => {
        if (!image || !view) return null;
        const { size, sx, sy } = cropRect(view, w, h, VIEW);
        const out = Math.max(1, Math.round(Math.min(size, MAX_OUTPUT)));
        const canvas = document.createElement('canvas');
        canvas.width = out;
        canvas.height = out;
        canvas.getContext('2d')?.drawImage(image, sx, sy, size, size, 0, 0, out, out);
        return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    };

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (!view) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, y: event.clientY };
    };

    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        const last = drag.current;
        if (!last) return;
        const dx = event.clientX - last.x;
        const dy = event.clientY - last.y;
        drag.current = { x: event.clientX, y: event.clientY };
        setView((current) =>
            current
                ? clampView({ ...current, x: current.x + dx, y: current.y + dy }, w, h, VIEW)
                : current,
        );
    };

    const endDrag = () => {
        drag.current = null;
    };

    const scale = view ? (VIEW / Math.min(w, h)) * view.zoom : 1;

    return (
        <div className={styles.crop}>
            <div
                aria-label={t('mubox.cover.cropHint')}
                className={styles.cropBox}
                data-ready={Boolean(view)}
                onPointerCancel={endDrag}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                ref={box}
                role="img"
                style={{ height: VIEW, width: VIEW }}
            >
                {image && view ? (
                    <img
                        alt=""
                        draggable={false}
                        src={image.src}
                        style={{
                            height: h * scale,
                            transform: `translate(${view.x}px, ${view.y}px)`,
                            width: w * scale,
                        }}
                    />
                ) : (
                    <div className={styles.cropEmpty}>
                        <Icon color="muted" icon="emptySongImage" size="2xl" />
                        {(failed || !src) && <span>{t('mubox.cover.noImage')}</span>}
                    </div>
                )}
            </div>
            <div className={styles.zoom}>
                <Icon color="muted" icon="minus" />
                <Slider
                    aria-label={t('mubox.cover.zoom')}
                    disabled={!view}
                    label={null}
                    max={MAX_ZOOM}
                    min={MIN_ZOOM}
                    onChange={(zoom) =>
                        setView((current) =>
                            current
                                ? zoomAt(current, zoom, VIEW / 2, VIEW / 2, w, h, VIEW)
                                : current,
                        )
                    }
                    step={0.01}
                    style={{ flex: 1 }}
                    value={view?.zoom ?? MIN_ZOOM}
                />
                <Icon color="muted" icon="plus" />
            </div>
        </div>
    );
};
