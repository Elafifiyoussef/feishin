/**
 * Linking a Navidrome song to a lubox track. lubox names every file `<artist>/<title> [<video id>].<ext>`
 * and Navidrome does not expose the YOUTUBE_ID tag, so the id comes from the song's path. No imports on
 * purpose: unit tested with Node's built-in runner (see video-id.test.ts).
 */

// A YouTube video id is 11 characters of A-Z a-z 0-9 _ - ; lubox puts it in square brackets before the extension
const VIDEO_ID_IN_PATH = /\[([A-Za-z0-9_-]{11})\]\.[A-Za-z0-9]{1,5}$/;

export interface ResolvedSongs {
    /** unique video ids, in the order of the songs */
    ids: string[];
    /** how many songs could not be linked to a lubox track */
    unresolved: number;
}

/** The video id in a library path (either slash style), or null when it is not a lubox file name. */
export function parseVideoId(path: null | string | undefined): null | string {
    if (!path) return null;
    const name = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);
    return VIDEO_ID_IN_PATH.exec(name)?.[1] ?? null;
}

/** Video ids for a list of songs. The same video twice (a main file and a copy) counts once. */
export function resolveVideoIds(songs: { path?: null | string }[]): ResolvedSongs {
    const ids: string[] = [];
    const seen = new Set<string>();
    let unresolved = 0;

    for (const song of songs) {
        const id = parseVideoId(song.path);
        if (!id) {
            unresolved += 1;
        } else if (!seen.has(id)) {
            seen.add(id);
            ids.push(id);
        }
    }

    return { ids, unresolved };
}
