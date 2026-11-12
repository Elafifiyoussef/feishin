import { ipcRenderer } from 'electron';

/** `null`: the server could not be reached. Otherwise what `<address>/mubox/info` answered. */
const fetchInfo = (address: string): Promise<null | { body: any; status: number }> =>
    ipcRenderer.invoke('mubox-info-fetch', address);

export const mubox = {
    fetchInfo,
};

export type Mubox = typeof mubox;
