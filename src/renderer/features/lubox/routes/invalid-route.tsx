import { Navigate } from 'react-router';

import { LuboxPath } from '/@/renderer/features/lubox/constants';

/** Unknown /lubox/* paths go back to the first lubox page. */
export const InvalidRoute = () => <Navigate replace to={LuboxPath.DOWNLOAD} />;
