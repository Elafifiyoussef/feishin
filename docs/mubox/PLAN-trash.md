# Plan: Trash page, then retire the Library page

Status: done. The Trash page (list, restore, permanent delete, empty trash, undo last change) and the "Edit tags" dialog are built,
and the Library page has been removed. mubox's `/trash`, `/trash/restore` and `/trash/purge` endpoints are live. The text below is the
original plan, kept for the reasoning.

## 1. Goal

Feishin's own Tracks, Albums and Artists pages browse and select. The right-click menu ("Edit in mubox") edits and trashes.
What is left that only mubox knows is the trash, so it gets its own page, and the Library page goes away once nothing unique is left on it.

## 2. What the Library page still does alone

| Feature | Where it goes |
|---|---|
| Edit album, artist, date; clear; trash | Done: song and album right-click menus |
| Undo last batch | Trash page header ("Undo last change") |
| Edit one song's tags | A3: "Edit tags" modal in the song menu |
| Track details, copies, source | A3 modal ("Details" tab), or a small side panel |
| Tracks Navidrome has not scanned yet | Dropped, or a note on the Trash page header |

## 3. Trash page (`/mubox/trash`)

- Same page wrapper, header and table look as the Downloader (shared `MuboxPage`, `--theme-*` tokens).
- Columns: cover, title, artist, album, trashed (relative time), size. Newest first, paged like the library list.
- Selection with click, ctrl, shift (the existing `use-library-selection` hook is reused).
- Actions on the selection bar:
  - **Restore**: puts files back, then the same fast refresh as after a trash (`afterMuboxChange` with `fast: true`).
  - **Delete permanently**: always a confirm dialog that names the count and says it cannot be undone.
  - **Empty trash**: confirm with the total count.
- Empty state: "Nothing in the trash".
- Admin only (same gate as every mubox page).

## 4. mubox endpoints needed

1. `GET /trash?limit&offset` returning `{items: [{video_id, title, artist, album, trashed_at, size, batch_id}], total}`.
2. `POST /trash/restore {video_ids}` for per-track restore (undo only reaches the last batch).
3. `POST /trash/purge {video_ids | all}` for permanent delete.

Restore and purge should report per-track failures like `/batch/apply` does, so the page can show what failed.

## 5. Phases

1. **T1:** API types and hooks for the three endpoints, route and sidebar entry, list, selection, Restore. Verify in the browser with mocked writes.
2. **T2:** permanent delete and empty trash, with confirm dialogs and the Undo link.
3. **A3:** "Edit tags" modal and track details for one song.
4. **Retire Library:** remove the Library route, its sidebar entry and the unused components (`library-page`, `track-list`, `library-toolbar`, `selection-bar` where not reused). Update the upstream touch list in `PLAN.md`.

T1 and T2 can start as soon as the mubox session confirms the endpoint shapes. A3 does not depend on mubox.

## 6. Risks

- Restore returns files to their old paths, and Navidrome needs its rescan before they reappear. The page uses the same scan polling as a trash.
- Permanent delete also drops Navidrome's play counts and stars for that track once its missing entry is purged. The confirm text says so.
- Until mubox auth is on, the admin gate is cosmetic.
