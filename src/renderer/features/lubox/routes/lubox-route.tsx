import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router';

import { LuboxPage } from '/@/renderer/features/lubox/components/lubox-page';
import { LuboxStatusProbe } from '/@/renderer/features/lubox/components/lubox-status-probe';
import { LuboxPath } from '/@/renderer/features/lubox/constants';
import { DownloaderPage } from '/@/renderer/features/lubox/downloader/downloader-page';
import '/@/renderer/features/lubox/i18n/register';
import { LibraryPage } from '/@/renderer/features/lubox/library/library-page';
import { InvalidRoute } from '/@/renderer/features/lubox/routes/invalid-route';
import { TrashPage } from '/@/renderer/features/lubox/trash/trash-page';

const DownloadPage = () => {
    const { t } = useTranslation();
    return (
        <LuboxPage title={t('lubox.pages.download.title')}>
            <DownloaderPage />
        </LuboxPage>
    );
};

const TrackPage = () => {
    const { t } = useTranslation();
    return (
        <LuboxPage title={t('lubox.pages.track.title')}>
            <LuboxStatusProbe />
        </LuboxPage>
    );
};

/**
 * The only lubox entry point for the app router: a single `/lubox/*` splat route. All lubox
 * pages are registered here, so adding pages never touches upstream files again.
 */
const LuboxRoute = () => (
    <Routes>
        <Route element={<Navigate replace to={LuboxPath.DOWNLOAD} />} index />
        <Route element={<DownloadPage />} path="download" />
        <Route element={<LibraryPage />} path="library" />
        <Route element={<TrashPage />} path="trash" />
        <Route element={<TrackPage />} path="track/:videoId" />
        <Route element={<InvalidRoute />} path="*" />
    </Routes>
);

export default LuboxRoute;
