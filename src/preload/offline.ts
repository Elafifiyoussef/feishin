import { ipcRenderer } from 'electron';

import { OfflineEntry, OfflineKeepItem, OfflineProgress } from '/@/shared/types/offline-types';

const list = (): Promise<OfflineEntry[]> => ipcRenderer.invoke('offline-list');

const keep = (jobId: string, items: OfflineKeepItem[]): Promise<boolean> =>
    ipcRenderer.invoke('offline-keep', { items, jobId });

const cancel = (jobId: string) => {
    ipcRenderer.send('offline-cancel', jobId);
};

const remove = (target: { all?: boolean; keys?: string[] }): Promise<number> =>
    ipcRenderer.invoke('offline-remove', target);

const onChange = (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on('offline-changed', listener);
    return () => ipcRenderer.removeListener('offline-changed', listener);
};

const onProgress = (cb: (progress: OfflineProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: OfflineProgress) => cb(progress);
    ipcRenderer.on('offline-progress', listener);
    return () => ipcRenderer.removeListener('offline-progress', listener);
};

export const offline = {
    cancel,
    keep,
    list,
    onChange,
    onProgress,
    remove,
};

export type Offline = typeof offline;
