import i18n from 'i18next';

import { muboxEn } from '/@/renderer/features/mubox/i18n/en';

let registered = false;

/** Adds the mubox strings under the `mubox.*` keys without touching upstream locale files. */
export const registerMuboxI18n = () => {
    if (registered) return;
    i18n.addResourceBundle('en', 'translation', { mubox: muboxEn }, true, false);
    registered = true;
};

registerMuboxI18n();
