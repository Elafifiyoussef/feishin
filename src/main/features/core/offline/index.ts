import { app, BrowserWindow, ipcMain, net, protocol } from 'electron';
import { createWriteStream } from 'fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { pathToFileURL } from 'url';

import log from '/@/main/logger';
import {
    OFFLINE_SCHEME,
    OfflineEntry,
    OfflineJobError,
    OfflineKeepItem,
    OfflineProgress,
} from '/@/shared/types/offline-types';

/**
 * "Keep offline" (desktop only). Layout under `<userData>/offline`:
 *   index.json                         one small index: server + song id -> file, cover and the song's metadata
 *   <server id>/<song id>.<ext>        the audio file as the server stores it
 *   <server id>/covers/<cover key>.jpg cover images (one per album)
 *   <server id>/<song id>.<ext>.part   a copy in progress (resumed with a Range request)
 */

interface OfflineIndex {
    items: Record<string, OfflineEntry>;
    version: 1;
}

const root = () => join(app.getPath('userData'), 'offline');
const indexPath = () => join(root(), 'index.json');
const safe = (value: string) => value.replace(/[^A-Za-z0-9._-]/g, '_');
const keyOf = (serverId: string, songId: string) => `${serverId}/${songId}`;

let index: OfflineIndex = { items: {}, version: 1 };

const loadIndex = async () => {
    try {
        const parsed = JSON.parse(await readFile(indexPath(), 'utf8'));
        if (parsed?.items) index = { items: parsed.items, version: 1 };
    } catch {
        // no index yet
    }
};
const ready = loadIndex();

const saveIndex = async () => {
    await mkdir(root(), { recursive: true });
    const tmp = `${indexPath()}.tmp`;
    await writeFile(tmp, JSON.stringify(index));
    await rename(tmp, indexPath());
};

const broadcast = (channel: string, payload?: unknown) => {
    for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) window.webContents.send(channel, payload);
    }
};

const sizeOf = async (file: string) => {
    try {
        return (await stat(file)).size;
    } catch {
        return null;
    }
};

class JobError extends Error {
    code: OfflineJobError;
    constructor(code: OfflineJobError, message: string) {
        super(message);
        this.code = code;
    }
}

const classify = (error: any): JobError => {
    if (error instanceof JobError) return error;
    if (error?.code === 'ENOSPC') return new JobError('disk-full', 'The disk is full');
    // Chromium's network stack reports failures as "net::ERR_..." errors
    if (
        error instanceof TypeError ||
        error?.cause?.code ||
        String(error?.message).startsWith('net::')
    ) {
        return new JobError('unreachable', 'The server is not reachable');
    }
    return new JobError('unknown', String(error?.message ?? error));
};

/** Copies `url` to `dest`. Continues a `.part` file when the server accepts a Range request. */
const download = async (
    url: string,
    dest: string,
    signal: AbortSignal,
    onBytes: (received: number, total: number) => void,
) => {
    const part = `${dest}.part`;
    const have = (await sizeOf(part)) ?? 0;

    const response = await net.fetch(url, {
        headers: have > 0 ? { Range: `bytes=${have}-` } : {},
        signal,
    });
    if (!response.ok || !response.body) {
        throw new JobError('http', `The server answered ${response.status}`);
    }
    const resumed = have > 0 && response.status === 206;
    const length = Number(response.headers.get('content-length') ?? 0);
    const total = resumed ? have + length : length;
    let received = resumed ? have : 0;

    const counter = new Transform({
        transform(chunk, _encoding, callback) {
            received += chunk.length;
            onBytes(received, total);
            callback(null, chunk);
        },
    });

    await pipeline(
        Readable.fromWeb(response.body as any),
        counter,
        createWriteStream(part, { flags: resumed ? 'a' : 'w' }),
        { signal },
    );
    await rename(part, dest);
    return received;
};

const jobs = new Map<string, AbortController>();

const extensionOf = (song: Record<string, any>) =>
    safe(String(song.container || song.suffix || 'bin')).toLowerCase();

const runJob = async (jobId: string, items: OfflineKeepItem[]) => {
    await ready;
    const controller = new AbortController();
    jobs.set(jobId, controller);

    const progress: OfflineProgress = {
        bytes: 0,
        bytesTotal: 0,
        current: '',
        done: 0,
        jobId,
        skipped: 0,
        status: 'running',
        total: items.length,
    };
    let lastSent = 0;
    const send = (force = false) => {
        const now = Date.now();
        if (!force && now - lastSent < 250) return;
        lastSent = now;
        broadcast('offline-progress', { ...progress });
    };

    try {
        send(true);
        for (const item of items) {
            if (controller.signal.aborted) throw new DOMException('canceled', 'AbortError');
            const songId = String(item.song.id);
            const key = keyOf(item.serverId, songId);
            progress.current = String(item.song.name ?? songId);
            progress.bytes = 0;
            progress.bytesTotal = 0;

            const existing = index.items[key];
            if (existing && (await sizeOf(existing.file)) !== null) {
                progress.skipped += 1;
                progress.done += 1;
                send();
                continue;
            }

            const dir = join(root(), safe(item.serverId));
            await mkdir(join(dir, 'covers'), { recursive: true });
            const file = join(dir, `${safe(songId)}.${extensionOf(item.song)}`);
            const size = await download(item.downloadUrl, file, controller.signal, (got, total) => {
                progress.bytes = got;
                progress.bytesTotal = total;
                send();
            });

            // the cover is nice to have: a failure here does not fail the song
            let cover: null | string = null;
            if (item.coverUrl) {
                const coverFile = join(dir, 'covers', `${safe(item.coverKey)}.jpg`);
                try {
                    if ((await sizeOf(coverFile)) === null) {
                        await download(item.coverUrl, coverFile, controller.signal, () => {});
                    }
                    cover = coverFile;
                } catch (error) {
                    if ((error as Error)?.name === 'AbortError') throw error;
                    log.warn('Offline: cover not saved', error);
                }
            }

            index.items[key] = {
                cover,
                file,
                keptAt: Date.now(),
                key,
                serverId: item.serverId,
                size,
                song: item.song,
                songId,
            };
            await saveIndex();
            broadcast('offline-changed');
            progress.done += 1;
            send(true);
        }
        progress.status = 'done';
    } catch (error: any) {
        if (error?.name === 'AbortError') {
            progress.status = 'canceled';
        } else {
            const classified = classify(error);
            log.error('Offline: keeping songs failed', error);
            progress.status = 'error';
            progress.error = classified.code;
            progress.errorDetail = classified.message;
        }
    } finally {
        jobs.delete(jobId);
        send(true);
    }
};

const removeFiles = async (entries: OfflineEntry[]) => {
    for (const entry of entries) {
        await rm(entry.file, { force: true });
        await rm(`${entry.file}.part`, { force: true });
        delete index.items[entry.key];
    }
    // covers nothing points at any more
    const used = new Set(
        Object.values(index.items)
            .map((entry) => entry.cover)
            .filter(Boolean),
    );
    for (const entry of entries) {
        if (entry.cover && !used.has(entry.cover)) await rm(entry.cover, { force: true });
    }
    await saveIndex();
    broadcast('offline-changed');
};

ipcMain.handle('offline-list', async () => {
    await ready;
    return Object.values(index.items);
});

ipcMain.handle('offline-keep', (_event, request: { items: OfflineKeepItem[]; jobId: string }) => {
    runJob(request.jobId, request.items).catch((error) => log.error('Offline job crashed', error));
    return true;
});

ipcMain.on('offline-cancel', (_event, jobId: string) => {
    jobs.get(jobId)?.abort();
});

ipcMain.handle('offline-remove', async (_event, request: { all?: boolean; keys?: string[] }) => {
    await ready;
    const entries = request.all
        ? Object.values(index.items)
        : (request.keys ?? []).map((key) => index.items[key]).filter(Boolean);
    await removeFiles(entries);
    return entries.length;
});

app.whenReady().then(() => {
    // mubox-offline://file/<server>/<song> and mubox-offline://cover/<server>/<song>: only files in the index
    protocol.handle(OFFLINE_SCHEME, async (request) => {
        await ready;
        const url = new URL(request.url);
        const [serverId, songId] = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
        const entry = index.items[keyOf(serverId, songId)];
        const file = url.hostname === 'cover' ? entry?.cover : entry?.file;
        if (!file) return new Response('Not found', { status: 404 });
        return net.fetch(pathToFileURL(file).toString(), { headers: request.headers });
    });
});
