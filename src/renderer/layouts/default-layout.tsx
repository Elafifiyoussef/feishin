import clsx from 'clsx';
import isElectron from 'is-electron';

import styles from './default-layout.module.css';

import { ContextMenuController } from '/@/renderer/features/context-menu/context-menu-controller';
import { MainContent } from '/@/renderer/layouts/default-layout/main-content';
import { PlayerBar } from '/@/renderer/layouts/default-layout/player-bar';
import { WindowBar } from '/@/renderer/layouts/window-bar';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { useSettingsStore, useWindowBarStyle } from '/@/renderer/store/settings.store';
import { Platform, PlayerType } from '/@/shared/types/types';

if (!isElectron()) {
    useSettingsStore.getState().actions.setSettings({
        playback: {
            type: PlayerType.WEB,
        },
    });
}

interface DefaultLayoutProps {
    shell?: boolean;
}

export const DefaultLayout = ({ shell }: DefaultLayoutProps) => {
    const windowBarStyle = useWindowBarStyle();
    const hasServer = Boolean(useCurrentServerWithCredential());

    return (
        <>
            <div
                className={clsx(styles.layout, {
                    [styles.macos]: windowBarStyle === Platform.MACOS,
                    [styles.noPlayer]: !hasServer,
                    [styles.windows]: windowBarStyle === Platform.WINDOWS,
                })}
                id="default-layout"
            >
                <WindowBar />
                <MainContent shell={shell} />
                <PlayerBar />
            </div>
            <ContextMenuController.Root />
        </>
    );
};
