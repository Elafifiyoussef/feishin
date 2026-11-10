import { Navigate } from 'react-router';

import { MuboxPath } from '/@/renderer/features/mubox/constants';

/** Unknown /mubox/* paths go back to the first mubox page. */
export const InvalidRoute = () => <Navigate replace to={MuboxPath.DOWNLOAD} />;
