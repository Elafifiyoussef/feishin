import i18n from 'i18next';

import { luboxEn } from '/@/renderer/features/lubox/i18n/en';

let registered = false;

/** Adds the lubox strings under the `lubox.*` keys without touching upstream locale files. */
export const registerLuboxI18n = () => {
    if (registered) return;
    i18n.addResourceBundle('en', 'translation', { lubox: luboxEn }, true, false);
    registered = true;
};

registerLuboxI18n();
