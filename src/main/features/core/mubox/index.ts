import { ipcMain, net } from 'electron';

/**
 * Asks `<address>/mubox/info` from the main process, so the desktop app can find out whether a server
 * is a mubox server without the renderer's CORS rules getting in the way (the dev server renders
 * from http://localhost, where a cross-origin fetch is refused). `null` means the server could not be
 * reached.
 */
ipcMain.handle('mubox-info-fetch', async (_event, address: string) => {
    try {
        const url = `${String(address).replace(/\/+$/, '')}/mubox/info`;
        if (!/^https?:\/\//i.test(url)) return null;
        const response = await net.fetch(url, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(4000),
        });
        const body = await response.json().catch(() => null);
        return { body, status: response.status };
    } catch {
        return null;
    }
});
