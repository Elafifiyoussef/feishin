import clsx from 'clsx';

import styles from './player-bar.module.css';

import { Playerbar } from '/@/renderer/features/player/components/playerbar';
import { useCurrentServerWithCredential, usePlayerbarOpenDrawer } from '/@/renderer/store';

export const PlayerBar = () => {
    const playerbarOpenDrawer = usePlayerbarOpenDrawer();
    const hasServer = Boolean(useCurrentServerWithCredential());

    // signed out: nothing to play, so no player bar
    if (!hasServer) return null;

    return (
        <div
            className={clsx({
                [styles.container]: true,
                [styles.openDrawer]: playerbarOpenDrawer,
            })}
            id="player-bar"
        >
            <Playerbar />
        </div>
    );
};
