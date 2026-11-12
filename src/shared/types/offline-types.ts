/** "Keep offline": copies of songs saved in the app's own folder (desktop app only). */

/** One kept song. `song` is the normalized Song as it was when kept, so it can be listed and played later. */
export interface OfflineEntry {
    /** absolute path of the cover image, if one was saved */
    cover: null | string;
    /** absolute path of the audio file */
    file: string;
    keptAt: number;
    key: string;
    serverId: string;
    size: number;
    song: Record<string, any>;
    songId: string;
}

/** Why a job stopped with an error. */
export type OfflineJobError = 'disk-full' | 'http' | 'unknown' | 'unreachable';

export type OfflineJobStatus = 'canceled' | 'done' | 'error' | 'running';

export interface OfflineKeepItem {
    /** cover image address (with credentials); several songs of an album share one cover */
    coverKey: string;
    coverUrl: null | string;
    /** the file as the server stores it (Subsonic `download`) */
    downloadUrl: string;
    serverId: string;
    song: Record<string, any>;
}

export interface OfflineProgress {
    bytes: number;
    bytesTotal: number;
    /** title of the song being copied */
    current: string;
    done: number;
    error?: OfflineJobError;
    errorDetail?: string;
    jobId: string;
    skipped: number;
    status: OfflineJobStatus;
    total: number;
}

export const OFFLINE_SCHEME = 'mubox-offline';

/** Address the player and the lists use for a kept file or cover. */
export const offlineUrl = (kind: 'cover' | 'file', serverId: string, songId: string) =>
    `${OFFLINE_SCHEME}://${kind}/${encodeURIComponent(serverId)}/${encodeURIComponent(songId)}`;
