/**
 * Pure logic of batch actions (ADR-0005 in mubox): the action request, the chunked run with progress
 * and stop, the undo loop and the wording helpers. No imports on purpose: it is unit tested with
 * Node's built-in runner (see batch.test.ts).
 */

export const BATCH_CHUNK = 25; // tracks per request: short requests and a real progress bar

/** The body mubox takes for POST /batch/plan, from what the person chose and typed. */
export type BatchAction =
    | { fields: Record<string, string>; type: 'set' }
    | { type: 'clear_album' }
    | { type: 'delete' }
    | { type: 'playlist'; url: string }
    | { type: 'single' };

export type BatchActionKey =
    | 'album'
    | 'artist'
    | 'clear'
    | 'date'
    | 'delete'
    | 'playlist'
    | 'single';

/** Actions that need no input run their preview straight away. */
export const isAutoAction = (key: BatchActionKey) =>
    key === 'clear' || key === 'delete' || key === 'single';

export interface Failure {
    error: string;
    video_id: string;
}

export interface RunResult {
    done: number;
    failed: Failure[];
    /** how many items were sent before the run ended (for "stopped after N of M") */
    seen: number;
    stopped: boolean;
}

export interface UndoResult {
    failed: Failure[];
    remaining: number;
    restored: number;
}

/** A short name for the batch, kept by mubox so "Undo last batch" can say what it will undo. */
export function batchLabel(
    title: string,
    key: BatchActionKey,
    value: string,
    playlistTitle?: null | string,
) {
    if (key === 'album' || key === 'artist' || key === 'date') return `${title}: ${value.trim()}`;
    if (key === 'playlist' && playlistTitle) return `${title}: ${playlistTitle}`;
    return title;
}

export function buildAction(key: BatchActionKey, value: string): BatchAction {
    switch (key) {
        case 'album':
        case 'artist':
        case 'date':
            return { fields: { [key]: value }, type: 'set' };
        case 'clear':
            return { type: 'clear_album' };
        case 'delete':
            return { type: 'delete' };
        case 'playlist':
            return { type: 'playlist', url: value };
        case 'single':
            return { type: 'single' };
    }
}

export function chunk<T>(items: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
}

/**
 * Send items in chunks. A chunk that fails as a whole (request error) is reported and ends the run;
 * tracks that fail inside a chunk are listed and the rest still go through. A stop request is only
 * honored between chunks, so a request in flight always completes.
 */
export async function runChunked<T>(options: {
    items: T[];
    onProgress: (seen: number, total: number) => void;
    runChunk: (part: T[]) => Promise<{ done: number; failed: Failure[] }>;
    shouldStop: () => boolean;
    size?: number;
}): Promise<RunResult> {
    const { items, onProgress, runChunk, shouldStop, size = BATCH_CHUNK } = options;
    let done = 0;
    let seen = 0;
    let failed: Failure[] = [];
    let stopped = false;

    onProgress(0, items.length);

    for (const part of chunk(items, size)) {
        if (shouldStop()) {
            stopped = true;
            break;
        }
        try {
            const result = await runChunk(part);
            done += result.done;
            failed = failed.concat(result.failed);
        } catch (error) {
            failed.push({
                error: error instanceof Error ? error.message : String(error),
                video_id: '',
            });
            seen += part.length;
            break;
        }
        seen += part.length;
        onProgress(seen, items.length);
    }

    return { done, failed, seen, stopped };
}

/**
 * Undo the last batch in chunks until nothing remains. Stops if a call makes no progress (so a
 * track that can not be restored never loops forever).
 */
export async function runUndoChunked(options: {
    onProgress: (restored: number, total: number) => void;
    total: number;
    undoChunk: () => Promise<UndoResult>;
}): Promise<{ failed: Failure[]; restored: number }> {
    const { onProgress, total, undoChunk } = options;
    let restored = 0;
    let failed: Failure[] = [];
    let remaining = total;

    onProgress(0, total);

    try {
        while (remaining > 0) {
            const result = await undoChunk();
            restored += result.restored;
            failed = failed.concat(result.failed);
            remaining = result.remaining;
            onProgress(Math.max(0, total - remaining), total);
            if (result.restored + result.failed.length === 0) break;
        }
    } catch (error) {
        failed.push({
            error: error instanceof Error ? error.message : String(error),
            video_id: '',
        });
    }

    return { failed, restored };
}

/** mubox reports skipped tracks with a reason each: "3 file missing, 2 already like that". */
export function summarizeSkipped(
    skipped: { reason: string }[],
): { count: number; reason: string }[] {
    const by = new Map<string, number>();
    for (const item of skipped) by.set(item.reason, (by.get(item.reason) ?? 0) + 1);
    return [...by].map(([reason, count]) => ({ count, reason: reason.toLowerCase() }));
}
