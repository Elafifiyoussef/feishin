import i18n from 'i18next';

import { getKeptSongs, getOfflineCoverUrl } from '/@/renderer/features/offline/offline-store';
import {
    Album,
    AlbumArtist,
    AlbumArtistListSort,
    AlbumListSort,
    Genre,
    InternalControllerEndpoint,
    LibraryItem,
    RelatedArtist,
    Song,
    SongListSort,
    SortOrder,
} from '/@/shared/types/domain-types';
import { offlineUrl } from '/@/shared/types/offline-types';

/**
 * The offline library: a backend behind the same controller interface as Navidrome, Jellyfin and
 * Subsonic, fed by the songs kept on this device (features/offline). While it is on (see
 * `isOfflineMode`), the facade in api/controller.ts sends every call here, so the normal pages show
 * what is kept and play it from the local files. Albums, artists and genres are derived from the
 * kept songs; anything that needs the server (favourites, playlists, scrobbles) is not offered.
 */

type Args = { apiClientProps: { server?: any; serverId: string }; query?: any };

const page = <T>(items: T[], query: { limit?: number; startIndex?: number }) => {
    const start = query.startIndex ?? 0;
    const end = query.limit && query.limit > 0 ? start + query.limit : undefined;
    return { items: items.slice(start, end), startIndex: start, totalRecordCount: items.length };
};

const compare = (a: unknown, b: unknown) =>
    typeof a === 'number' && typeof b === 'number'
        ? a - b
        : String(a ?? '').localeCompare(String(b ?? ''), undefined, {
              numeric: true,
              sensitivity: 'base',
          });

const sorted = <T>(items: T[], key: (item: T) => unknown, order?: SortOrder, random?: boolean) => {
    if (random) return [...items].sort(() => Math.random() - 0.5);
    const result = [...items].sort((a, b) => compare(key(a), key(b)));
    return order === SortOrder.DESC ? result.reverse() : result;
};

const matches = (term: string | undefined, ...fields: (null | string | undefined)[]) => {
    const needle = term?.trim().toLowerCase();
    return !needle || fields.some((field) => field?.toLowerCase().includes(needle));
};

const unique = <T>(items: T[], key: (item: T) => string) => [
    ...new Map(items.map((item) => [key(item), item])).values(),
];

const byAlbumOrder = (a: Song, b: Song) =>
    compare(a.album, b.album) || a.discNumber - b.discNumber || a.trackNumber - b.trackNumber;

// --- songs ---

const songKey = (sortBy: SongListSort): ((song: Song) => unknown) => {
    switch (sortBy) {
        case SongListSort.ALBUM:
            return (song) => song.album;
        case SongListSort.ALBUM_ARTIST:
            return (song) => song.albumArtistName;
        case SongListSort.ARTIST:
            return (song) => song.artistName;
        case SongListSort.DURATION:
            return (song) => song.duration;
        case SongListSort.GENRE:
            return (song) => song.genres?.[0]?.name;
        case SongListSort.ID:
            return (song) => song.id;
        case SongListSort.RECENTLY_ADDED:
            return (song) => song.createdAt;
        case SongListSort.RELEASE_YEAR:
        case SongListSort.YEAR:
            return (song) => song.releaseYear ?? song.year;
        default:
            return (song) => song.sortName || song.name;
    }
};

const filterSongs = (songs: Song[], query: any): Song[] =>
    songs.filter(
        (song) =>
            !query.favorite &&
            (!query.albumIds?.length || query.albumIds.includes(song.albumId)) &&
            (!query.albumArtistIds?.length ||
                song.albumArtists?.some((artist) => query.albumArtistIds.includes(artist.id))) &&
            (!query.artistIds?.length ||
                [...(song.artists ?? []), ...(song.albumArtists ?? [])].some((artist) =>
                    query.artistIds.includes(artist.id),
                )) &&
            (!query.genreIds?.length ||
                song.genres?.some((genre) => query.genreIds.includes(genre.id))) &&
            (query.minYear === undefined || (song.year ?? 0) >= query.minYear) &&
            (query.maxYear === undefined || (song.year ?? 9999) <= query.maxYear) &&
            matches(query.searchTerm, song.name, song.artistName, song.album, song.albumArtistName),
    );

const listSongs = (serverId: string, query: any) => {
    const songs = filterSongs(getKeptSongs(serverId), query);
    const key = songKey(query.sortBy);
    const ordered = sorted(songs, key, query.sortOrder, query.sortBy === SongListSort.RANDOM);
    // within an album sort, keep disc and track order
    return query.sortBy === SongListSort.ALBUM && query.sortOrder !== SortOrder.DESC
        ? [...ordered].sort(byAlbumOrder)
        : ordered;
};

// --- albums ---

const buildAlbum = (serverId: string, songs: Song[], withSongs = false): Album => {
    const first = songs[0];
    const ordered = [...songs].sort(byAlbumOrder);
    const artists = unique(
        songs.flatMap((song) => song.artists ?? []),
        (artist) => artist.id,
    );
    const genres = unique(
        songs.flatMap((song) => song.genres ?? []),
        (genre) => genre.id,
    );
    const album: Album = {
        _itemType: LibraryItem.ALBUM,
        _serverId: serverId,
        _serverType: first._serverType,
        albumArtistName: first.albumArtistName,
        albumArtists: first.albumArtists ?? [],
        artists,
        blurHash: null,
        comment: null,
        createdAt: songs.map((song) => song.createdAt).sort()[0] ?? '',
        discs: null,
        dominantColor: null,
        duration: songs.reduce((sum, song) => sum + (song.duration ?? 0), 0),
        explicitStatus: null,
        gain: null,
        genres,
        id: first.albumId,
        imageId: first.imageId ?? first.albumId,
        imageUrl: first.imageUrl,
        isCompilation: first.compilation,
        lastPlayedAt: null,
        mbzId: first.mbzAlbumId,
        mbzReleaseGroupId: first.mbzReleaseGroupId,
        missing: false,
        name: first.album ?? '',
        originalDate: first.originalDate,
        originalYear: first.originalYear,
        participants: null,
        peak: null,
        playCount: 0,
        ratedAt: null,
        recordLabels: [],
        releaseDate: first.releaseDate,
        releaseType: first.mbzAlbumType,
        releaseTypes: [],
        releaseYear: first.releaseYear ?? first.year,
        size: songs.reduce((sum, song) => sum + (song.size ?? 0), 0),
        songCount: songs.length,
        sortName: first.album ?? '',
        starredAt: null,
        tags: null,
        thumbHash: null,
        trackYearRange: null,
        updatedAt:
            songs
                .map((song) => song.updatedAt)
                .sort()
                .reverse()[0] ?? '',
        userFavorite: false,
        userRating: null,
        version: null,
    };
    if (withSongs) album.songs = ordered;
    return album;
};

const allAlbums = (serverId: string) => {
    const groups = new Map<string, Song[]>();
    for (const song of getKeptSongs(serverId)) {
        groups.set(song.albumId, [...(groups.get(song.albumId) ?? []), song]);
    }
    return [...groups.values()].map((songs) => buildAlbum(serverId, songs));
};

const albumKey = (sortBy: AlbumListSort): ((album: Album) => unknown) => {
    switch (sortBy) {
        case AlbumListSort.ALBUM_ARTIST:
        case AlbumListSort.ARTIST:
            return (album) => album.albumArtistName;
        case AlbumListSort.DURATION:
            return (album) => album.duration;
        case AlbumListSort.ID:
            return (album) => album.id;
        case AlbumListSort.RECENTLY_ADDED:
            return (album) => album.createdAt;
        case AlbumListSort.RELEASE_DATE:
        case AlbumListSort.YEAR:
            return (album) => album.releaseYear;
        case AlbumListSort.SONG_COUNT:
            return (album) => album.songCount;
        default:
            return (album) => album.sortName || album.name;
    }
};

const listAlbums = (serverId: string, query: any) => {
    const albums = allAlbums(serverId).filter(
        (album) =>
            !query.favorite &&
            !query.hasRating &&
            (!query.artistIds?.length ||
                [...album.albumArtists, ...album.artists].some((artist) =>
                    query.artistIds.includes(artist.id),
                )) &&
            (!query.genreIds?.length ||
                album.genres.some((genre) => query.genreIds.includes(genre.id))) &&
            (query.compilation === undefined ||
                Boolean(album.isCompilation) === query.compilation) &&
            (query.minYear === undefined || (album.releaseYear ?? 0) >= query.minYear) &&
            (query.maxYear === undefined || (album.releaseYear ?? 9999) <= query.maxYear) &&
            matches(query.searchTerm, album.name, album.albumArtistName),
    );
    return sorted(
        albums,
        albumKey(query.sortBy),
        query.sortOrder,
        query.sortBy === AlbumListSort.RANDOM,
    );
};

// --- artists ---

const buildArtist = (
    serverId: string,
    artist: RelatedArtist,
    songs: Song[],
    type: LibraryItem.ALBUM_ARTIST | LibraryItem.ARTIST,
): AlbumArtist => ({
    _itemType: type as LibraryItem.ALBUM_ARTIST,
    _serverId: serverId,
    _serverType: songs[0]._serverType,
    albumCount: new Set(songs.map((song) => song.albumId)).size,
    biography: null,
    blurHash: null,
    dominantColor: null,
    duration: songs.reduce((sum, song) => sum + (song.duration ?? 0), 0),
    genres: unique(
        songs.flatMap((song) => song.genres ?? []),
        (genre) => genre.id,
    ),
    id: artist.id,
    imageId: artist.id,
    imageUrl: null,
    lastPlayedAt: null,
    mbz: null,
    missing: false,
    name: artist.name,
    playCount: 0,
    ratedAt: null,
    similarArtists: null,
    songCount: songs.length,
    starredAt: null,
    thumbHash: null,
    userFavorite: false,
    userRating: null,
});

const allArtists = (serverId: string, kind: 'albumArtists' | 'artists') => {
    const groups = new Map<string, { artist: RelatedArtist; songs: Song[] }>();
    for (const song of getKeptSongs(serverId)) {
        for (const artist of song[kind] ?? []) {
            const group = groups.get(artist.id) ?? { artist, songs: [] };
            group.songs.push(song);
            groups.set(artist.id, group);
        }
    }
    const type = kind === 'artists' ? LibraryItem.ARTIST : LibraryItem.ALBUM_ARTIST;
    return [...groups.values()].map((group) =>
        buildArtist(serverId, group.artist, group.songs, type),
    );
};

const listArtists = (serverId: string, kind: 'albumArtists' | 'artists', query: any) => {
    const artists = allArtists(serverId, kind).filter(
        (artist) => !query.favorite && matches(query.searchTerm, artist.name),
    );
    const key = (artist: AlbumArtist): unknown => {
        switch (query.sortBy) {
            case AlbumArtistListSort.ALBUM_COUNT:
                return artist.albumCount;
            case AlbumArtistListSort.DURATION:
                return artist.duration;
            case AlbumArtistListSort.SONG_COUNT:
                return artist.songCount;
            default:
                return artist.name;
        }
    };
    return sorted(artists, key, query.sortOrder, query.sortBy === AlbumArtistListSort.RANDOM);
};

// --- genres ---

const allGenres = (serverId: string): Genre[] => {
    const groups = new Map<string, { albums: Set<string>; genre: Genre; songs: number }>();
    for (const song of getKeptSongs(serverId)) {
        for (const genre of song.genres ?? []) {
            const group = groups.get(genre.id) ?? { albums: new Set(), genre, songs: 0 };
            group.albums.add(song.albumId);
            group.songs += 1;
            groups.set(genre.id, group);
        }
    }
    return [...groups.values()].map(({ albums, genre, songs }) => ({
        ...genre,
        albumCount: albums.size,
        songCount: songs,
    }));
};

// --- what the pages are told ---

const notAvailable = () => {
    throw new Error(i18n.t('mubox.offline.notAvailable') as string);
};

const empty = <T>() => ({ items: [] as T[], startIndex: 0, totalRecordCount: 0 });

const serverIdOf = (args: Args) => args.apiClientProps.serverId;

/**
 * Endpoints the offline library answers. Everything not listed here is reported as "not available
 * offline" by the facade, so a write (favourite, playlist edit, rating) fails with a clear message.
 */
export const OfflineController: Partial<InternalControllerEndpoint> = {
    getAlbumArtistDetail: async (args: any) => {
        const artist = allArtists(serverIdOf(args), 'albumArtists').find(
            (item) => item.id === args.query.id,
        );
        if (!artist) return notAvailable();
        return artist;
    },
    getAlbumArtistInfo: async () => ({ biography: null, imageUrl: null, similarArtists: null }),
    getAlbumArtistList: async (args: any) =>
        page(listArtists(serverIdOf(args), 'albumArtists', args.query), args.query),
    getAlbumArtistListCount: async (args: any) =>
        listArtists(serverIdOf(args), 'albumArtists', args.query).length,
    getAlbumDetail: async (args: any) => {
        const songs = getKeptSongs(serverIdOf(args)).filter(
            (song) => song.albumId === args.query.id,
        );
        if (songs.length === 0) return notAvailable();
        return buildAlbum(serverIdOf(args), songs, true);
    },
    getAlbumInfo: async () => ({ imageUrl: null, notes: null }),
    getAlbumList: async (args: any) => page(listAlbums(serverIdOf(args), args.query), args.query),
    getAlbumListCount: async (args: any) => listAlbums(serverIdOf(args), args.query).length,
    getAlbumRadio: async () => [],
    getArtistList: async (args: any) =>
        page(listArtists(serverIdOf(args), 'artists', args.query), args.query),
    getArtistListCount: async (args: any) =>
        listArtists(serverIdOf(args), 'artists', args.query).length,
    getArtistRadio: async () => [],
    getDownloadUrl: () => '',
    getFavoriteSongs: async () => empty<Song>(),
    getGenreList: async (args: any) => {
        const genres = allGenres(serverIdOf(args)).filter((genre) =>
            matches(args.query.searchTerm, genre.name),
        );
        const key = (genre: Genre): unknown =>
            args.query.sortBy === 'albumCount'
                ? genre.albumCount
                : args.query.sortBy === 'songCount'
                  ? genre.songCount
                  : genre.name;
        return page(sorted(genres, key, args.query.sortOrder), args.query);
    },
    getImageRequest: (args: any) => {
        const url = getOfflineCoverUrl(serverIdOf(args), args.query.id);
        return url ? { cacheKey: url, url } : null;
    },
    getImageUrl: (args: any) => getOfflineCoverUrl(serverIdOf(args), args.query.id) ?? null,
    getInternetRadioStations: async () => empty<never>().items,
    getMusicFolderList: async () => empty<never>(),
    getPlaylistList: async () => empty<never>(),
    getPlaylistListCount: async () => 0,
    getPlaylistSongList: async () => empty<Song>(),
    getPlayQueue: async () => ({
        changed: '',
        changedBy: '',
        currentIndex: 0,
        entry: [],
        positionMs: 0,
        username: '',
    }),
    getRandomSongList: async (args: any) => {
        const songs = getKeptSongs(serverIdOf(args)).filter(
            (song) =>
                !args.query.genre || song.genres?.some((genre) => genre.id === args.query.genre),
        );
        return page(
            sorted(songs, () => 0, undefined, true),
            args.query,
        );
    },
    getRoles: async () => [],
    getScanStatus: async () => ({ count: 0, scanning: false }) as any,
    getServerInfo: async (args: any) => ({
        features: {} as any,
        id: serverIdOf(args),
        version: 'offline',
    }),
    getSimilarSongs: async () => [],
    getSongDetail: async (args: any) => {
        const song = getKeptSongs(serverIdOf(args)).find((item) => item.id === args.query.id);
        if (!song) return notAvailable();
        return song;
    },
    getSongList: async (args: any) => page(listSongs(serverIdOf(args), args.query), args.query),
    getSongListCount: async (args: any) => listSongs(serverIdOf(args), args.query).length,
    getStreamUrl: async (args: any) => offlineUrl('file', serverIdOf(args), args.query.id),
    getStructuredLyrics: async () => [],
    getTopSongs: async (args: any) => {
        const songs = getKeptSongs(serverIdOf(args)).filter((song) =>
            [...(song.artists ?? []), ...(song.albumArtists ?? [])].some(
                (artist) => artist.id === args.query.artistId,
            ),
        );
        return page(
            sorted(songs, (song) => song.name),
            { limit: args.query.limit },
        );
    },
    getUserInfo: async (args: any) => ({
        id: args.apiClientProps.server?.userId ?? '',
        isAdmin: false,
        name: args.apiClientProps.server?.username ?? '',
    }),
    savePlayQueue: async () => {},
    scrobble: async () => null as any,
    search: async (args: any) => {
        const term = args.query.query;
        const serverId = serverIdOf(args);
        return {
            albumArtists: listArtists(serverId, 'albumArtists', { searchTerm: term }).slice(
                0,
                args.query.albumArtistLimit ?? 10,
            ),
            albums: listAlbums(serverId, { searchTerm: term }).slice(
                0,
                args.query.albumLimit ?? 10,
            ),
            songs: filterSongs(getKeptSongs(serverId), { searchTerm: term }).slice(
                0,
                args.query.songLimit ?? 25,
            ),
        };
    },
};
