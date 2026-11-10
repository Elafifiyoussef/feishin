import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router';

import { MuboxPage } from '/@/renderer/features/mubox/components/mubox-page';
import { MuboxPath } from '/@/renderer/features/mubox/constants';
import { DownloaderPage } from '/@/renderer/features/mubox/downloader/downloader-page';
import '/@/renderer/features/mubox/i18n/register';
import { InvalidRoute } from '/@/renderer/features/mubox/routes/invalid-route';
import { TrashPage } from '/@/renderer/features/mubox/trash/trash-page';

const DownloadPage = () => {
    const { t } = useTranslation();
    return (
        <MuboxPage title={t('mubox.pages.download.title')}>
            <DownloaderPage />
        </MuboxPage>
    );
};

/**
 * The only mubox entry point for the app router: a single `/mubox/*` splat route. All mubox
 * pages are registered here, so adding pages never touches upstream files again.
 */
const MuboxRoute = () => (
    <Routes>
        <Route element={<Navigate replace to={MuboxPath.DOWNLOAD} />} index />
        <Route element={<DownloadPage />} path="download" />
        <Route element={<TrashPage />} path="trash" />
        <Route element={<InvalidRoute />} path="*" />
    </Routes>
);

export default MuboxRoute;
