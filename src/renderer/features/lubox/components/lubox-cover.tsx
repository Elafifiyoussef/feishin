import { useState } from 'react';

import styles from './lubox-cover.module.css';

import { getLuboxApiBase } from '/@/renderer/features/lubox/constants';
import { Icon } from '/@/shared/components/icon/icon';

interface LuboxCoverProps {
    /** lubox serves the cover of the file's embedded thumbnail (16:9 YouTube thumbnails). */
    videoId: string;
}

/** Square cover tile: the 16:9 thumbnail is cropped to fill, a muted note shows when there is none. */
export const LuboxCover = ({ videoId }: LuboxCoverProps) => {
    const [failed, setFailed] = useState(false);

    return (
        <span aria-hidden="true" className={styles.cover}>
            {failed ? (
                <Icon color="muted" icon="emptySongImage" />
            ) : (
                <img
                    alt=""
                    decoding="async"
                    loading="lazy"
                    onError={() => setFailed(true)}
                    src={`${getLuboxApiBase()}/tracks/${encodeURIComponent(videoId)}/cover`}
                />
            )}
        </span>
    );
};
