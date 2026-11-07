# Plan: lubox actions inside Feishin's own UI

Status: proposal, nothing built. Written after reading the context-menu, tag-editor and item-table code.

## 1. The idea

Today the lubox pages are a separate island (Downloader, Library tools) that happens to sit in Feishin's sidebar.
The better split:

- **Feishin owns browsing, selecting and playing.** Its Tracks, Albums, Artists and Playlists pages already list
  everything, with multi-select, sorting, filters and a right-click menu.
- **lubox adds actions to that UI**: edit album, artist, date; clear; move to trash; track details. Same safe flow
  as now (preview, apply in chunks, undo).
- **The Library tools page keeps only what Feishin can not do** (undo, trash, copies, problems), and is restyled to
  look and behave like the Tracks page.

This matches what you asked for: use the right-click menu where the songs already are, and make the lib tool follow
the same UI as Tracks, with the same dropdown.

## 2. What we found

| Finding | Consequence |
|---|---|
| Every context menu (`song`, `album`, `album-artist`, `artist`, `playlist-song`, `queue`) is a list of small `*Action` components in `features/context-menu/menus/`. | One lubox entry per menu is one line in each upstream menu file. |
| Feishin already has **Edit metadata** in the song and album menus, but it returns nothing on the web build (`if (!utils) return null`): it needs the desktop app's file access. | On the web build that slot is empty. lubox fills it. |
| The shared `ContextMenu` supports submenus (`Submenu`, `SubmenuContent`). | One "lubox" submenu keeps the menu short. |
| Feishin tables select rows (click, ctrl, shift) and right-click opens the menu with the **selected songs** as `items`. | The batch flow works natively: select 200 songs in Tracks, right-click, "Set album…". No custom select mode needed there. |
| A Feishin song has `path`. All 665 files in your library are named `<artist>/<title> [<video id>].<ext>`. | The video id can be read from the path today. `POST /tracks/resolve` (planned in lubox) makes it exact, including copies. |
| `ItemTableList` takes `data: unknown[]`, `columns`, `itemType`, `getRowId`, `overrideControls`, and even a custom `CellComponent`. | The lib tool can use Feishin's own table with lubox rows instead of my custom list. |
| After ADR-0007, 5 of 665 tracks have no album. | "No album" is no longer the main reason to have a separate list. |

## 3. Part A: lubox actions in Feishin's menus (native)

Only for admins, web build, Navidrome server (same gate as today, still cosmetic until lubox auth is on).

**Song menu (and playlist-song):** a "lubox" submenu

- Edit album… / Edit artist… / Edit date…
- Album = track title (single)
- Clear album and track
- Album from a playlist link…
- Edit tags… (one song: title, artist, album, track, date, with Revert, like the track page, as a modal)
- Move to trash…
- Open in library tools (details, source, copies)

**Album menu:** Rename album… (sets the album on all its songs), Set artist for all songs…, Set date for all songs…,
Move album to trash…. The album's song ids come from `getAlbumDetail`, as Feishin's own Edit metadata does.

**Artist / album-artist menu:** Rename artist… (sets artist on all songs of that artist).

All of these open the **same BatchDialog** that exists now (preview of before and after, chunked apply with Stop,
undo checks `/batch/last`). The dialog moves from `library/` to a shared place inside `features/lubox/`.

**Song to video id:** a small `resolveVideoIds(songs)` helper: parse `[id]` from `path`, drop songs without one,
and later switch to `/tracks/resolve`. Songs that can not be resolved are listed in the preview as "left out: not
a lubox track".

**After a change:** lubox writes the files at once, but Navidrome only shows the new tags after its rescan (about a
minute). So: toast "Done. Navidrome updates in about a minute", and refetch Feishin's song and album queries once
after that delay. Optional later: patch the cached song titles so the change appears instantly.

### Upstream files touched by Part A (one or two lines each)

`song-context-menu.tsx`, `playlist-song-context-menu.tsx`, `album-context-menu.tsx`, `album-artist-context-menu.tsx`,
`artist-context-menu.tsx`. That brings the total from 4 to about 9 upstream files, each a one-line mount of
`<LuboxMenuGroup />`, so `git merge upstream/main` stays cheap.

## 4. Part B: what stays in the Library tools page

Only things Feishin can not show:

- **Undo last batch** (global, one level) and the history it implies.
- **Trash**: list what was moved, restore, and later empty (needs a lubox endpoint to list the trash).
- **Copies**: the "In N albums" detail, add or remove a copy.
- **Needs attention**: files missing, hand-edited tracks, tracks Navidrome has not scanned yet.
- **Track details**: YouTube source, raw tags vs edits with revert, file info, description.
- The Downloader and its activity (unchanged).

## 5. Part C: restyle the Library tools list like Feishin's Tracks

Replace my custom rows and cards with Feishin's own `ItemTableList` (and grid for cards), fed with lubox rows:

- Same columns, row height, hover, header, column resize, sticky header, and **native selection** (click, ctrl,
  shift, select-all dialog), instead of my custom select mode.
- Same right-click menu and the same "more" button, with the lubox submenu.
- Extra columns that only lubox knows: Added, Edited, In N albums, File missing.
- Same filter bar pattern (sort dropdown, direction, search). The album filter stays a searchable select (about 500
  albums).
- Data stays from lubox `/tracks` (so it also shows tracks Navidrome has not scanned yet). An adapter maps a lubox
  track to the song shape the table expects.

Risk: the table's default cells assume Feishin's `Song` type, so the adapter must fill the fields they read. If that
turns out brittle, the fallback is a small custom `CellComponent`.

## 6. Phases

1. **A1: the shared pieces.** Move BatchDialog and UndoDialog to shared; add `resolveVideoIds`; add the
   `LuboxMenuGroup` with the song actions; mount in the song menu. Verify with real right-clicks (mocked writes).
2. **A2: albums and artists.** Album and artist menus, plus the delayed Feishin refetch.
3. **A3: Edit tags modal** for a single song (the web replacement for desktop-only Edit metadata).
4. **C: restyle the library list** with `ItemTableList` and native selection; remove my custom select mode.
5. **B: trash, copies, needs attention, track details.** Needs lubox to add a trash listing and `/tracks/resolve`.

## 7. Decisions needed from you

1. **Submenu or flat?** One "lubox" submenu (shorter menu, my recommendation) or the actions listed directly.
2. **Show on Playlist and Queue menus too?** Playlist-song yes (recommended); Queue probably not.
3. **Keep the custom list as a fallback** until Part C is verified, or replace it right away?
4. **lubox work I will ask for:** `POST /tracks/resolve`, a trash listing, and a way to know which tracks Navidrome
   has scanned. OK to message the lubox session for these when we reach them?

## 8. Risks and honest limits

- Navidrome lags behind lubox by about a minute after every edit. The UI says so and refetches.
- Album ids in Navidrome can change when an album is renamed, so an open album page may need to be reopened.
- Real enforcement is still lubox-side auth. Hiding menu entries for non-admins is cosmetic.
- Editing artist or album for a whole Navidrome album relies on the album's songs all being lubox tracks. Anything
  else is reported as left out in the preview.
