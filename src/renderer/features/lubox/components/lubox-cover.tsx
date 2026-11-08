import { useState } from 'react';

import styles from './lubox-cover.module.css';

import { getLuboxApiBase } from '/@/renderer/features/lubox/constants';
import { useCoverVersion } from '/@/renderer/features/lubox/lib/cover-version';
import { Icon } from '/@/shared/components/icon/icon';

interface LuboxCoverProps {
    /** lubox serves the cover of the file's embedded thumbnail (16:9 YouTube thumbnails). */
    videoId: string;
    /** Keep the 16:9 shape (cards) instead of a small square tile (rows). */
    wide?: boolean;
}

/** Square cover tile: the 16:9 thumbnail is cropped to fill, a muted note shows when there is none. */
export const LuboxCover = ({ videoId, wide }: LuboxCoverProps) => {
    const version = useCoverVersion(videoId);
    // remember which version failed, so a changed cover is tried again
    const [failedVersion, setFailedVersion] = useState<null | string>(null);
    const failed = failedVersion === version;

    return (
        <span aria-hidden="true" className={wide ? `${styles.cover} ${styles.wide}` : styles.cover}>
            {failed ? (
                <Icon color="muted" icon="emptySongImage" />
            ) : (
                <img
                    alt=""
                    decoding="async"
                    loading="lazy"
                    onError={() => setFailedVersion(version)}
                    src={`${getLuboxApiBase()}/tracks/${encodeURIComponent(videoId)}/cover${version ? `?v=${version}` : ''}`}
                />
            )}
        </span>
    );
};
