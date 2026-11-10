# mubox in the Feishin fork - plan

Status: plan approved by the user, **auth Option A chosen** (section 5); mubox session informed. Nothing built,
installed, committed or pushed. `origin` is still upstream. Dependency install still needs an explicit yes.

## 1. What this is

A fork of [Feishin](https://github.com/jeffvli/feishin) (Navidrome/Jellyfin/Subsonic player) that hosts mubox's
Downloader and library management as new pages. mubox stays a separate backend (`http://localhost:8000`); Navidrome
stays the library heart. The fork only adds a UI.

**License:** GPL-3.0 (`LICENSE` is the full GPLv3 text, `package.json` has `"license": "GPL-3.0"`, author jeffvli).
The fork keeps `LICENSE`, the author field and the README attribution untouched. Our code is GPL-3.0 too, and the
fork's copy must be offered under the same terms to anyone who gets the Docker image.

## 2. App map (what I found)

| Topic | Finding |
|---|---|
| Package manager | pnpm (`packageManager` pinned in package.json, Dockerfile uses pnpm 11.5.2). Node 23 in Docker. |
| Builds | Electron: `pnpm dev`, `build:electron` (electron-vite). **Web**: `pnpm build:web` (`web.vite.config.ts`, out `out/web`), the Docker image serves it with nginx on **9180**. Remote-control SPA: `build:remote`. |
| Web dev server | None for web. `pnpm dev` is Electron. A browser-based dev loop needs `vite --config web.vite.config.ts` (works, no script exists). |
| Routing | `src/renderer/router/app-router.tsx`, **HashRouter**, lazy routes, paths in `router/routes.ts` (`AppRoute` enum). Protected area = `AuthenticationOutlet` > `TitlebarOutlet` > `AppOutlet` > `ResponsiveLayout`. |
| Sidebar | `features/sidebar/components/sidebar.tsx` (desktop accordion), `collapsed-sidebar.tsx`, `mobile-sidebar.tsx`. Library items come from a **persisted** Zustand setting (`store/settings.store.ts` `sidebarItems`, with version migrations), so adding there means a store migration. We avoid that (see 3). |
| Settings | `features/settings/*`, persisted `store_settings`; web env defaults via `settings.js.template`. |
| Theming/UI | Mantine 8 wrapped under `/@/shared/components/*` (feature code must not import `@mantine/core`), CSS Modules, `var(--theme-*)` tokens, 29 built-in themes, light/dark. Icons via `<Icon icon=...>`, toasts via `toast.*`, modals via `@mantine/modals`. |
| i18n | `src/i18n/locales/*.json`, keys via `t()`. |
| Data layer | `api.controller` facade per backend; React Query; keys in `api/query-keys.ts`. mubox is not a Feishin backend, so it gets its own client (not `api.controller`). |
| Auth to Navidrome | `NavidromeController.authenticate`: native `/auth/login` returns `token` (JWT), `subsonicSalt/Token`, **`isAdmin`**. Stored on `useAuthStore().currentServer` as `ndCredential` (JWT), `credential` (Subsonic `u=&s=&t=`), `isAdmin`, `userId`, `username`, `url`. Songs/albums come from the native API (`/api/song`, `/api/album`) with the JWT in `x-nd-authorization`, plus Subsonic for streaming/covers. |
| Repo conventions | `AGENTS.md`: no em dashes, Conventional Commits with allowed scopes (`docs/agents/commits.md`), `pnpm lint:staged` on commit, CSS Modules co-located, deep imports only. We follow them. |

## 3. Isolation strategy

All new code lives in **one folder**: `src/renderer/features/mubox/` (the repo's `features/<name>` convention), with
its own subfolders `api/` (client + React Query hooks), `components/`, `pages/`, `store/`, `i18n/`, `lib/`.
Nothing outside it imports from it except the touch points below. Nothing inside it edits upstream files.

Design choices that keep upstream edits to near zero:

- **One splat route.** A single `/mubox/*` route renders `<MuboxRoutes />`, which owns its own nested `<Routes>`
  (downloader, library, track, trash, ...). Adding pages never touches upstream again.
- **Own sidebar section**, not a `sidebarItems` entry: a self-contained `<MuboxSidebarSection />` (renders nothing
  unless the user may see something). This avoids the persisted-settings migration that `sidebarItems` needs.
- **Own i18n bundle**, registered with `i18n.addResourceBundle('en', 'translation', ...)` from the feature's lazy
  entry, so `en.json` stays untouched. (English only at first; to be verified that the bundle merges cleanly.)
- **Own deploy files** instead of editing upstream's: `Dockerfile.mubox`, `docker/mubox/ng.conf.template` (copy of
  upstream's plus the `/mubox/` proxy), `web.mubox.vite.config.ts` (imports upstream's web config and adds
  `server.proxy`). Upstream's `Dockerfile`, `ng.conf.template`, `web.vite.config.ts` stay byte-identical.
- **Own tests** under the feature folder; CSS Modules co-located; a `README.md` in the folder.

### Upstream files I expect to touch (all one-liners, to be listed here as they happen)

| File | Change | Lines |
|---|---|---|
| `src/renderer/router/app-router.tsx` | lazy import + `<Route element={<MuboxRoute />} path="/mubox/*" />` inside the `ResponsiveLayout` group | ~3 |
| `src/renderer/features/sidebar/components/sidebar.tsx` | render `<MuboxSidebarSection />` after the Library accordion item | ~2 |
| `src/renderer/features/sidebar/components/collapsed-sidebar.tsx` | same, compact form | ~2 |
| `src/renderer/features/sidebar/components/mobile-sidebar.tsx` | same, mobile form | ~2 |

That is 4 files, about 10 lines. **Later additions: `song-context-menu.tsx` and `album-context-menu.tsx` each mount `<MuboxMenuGroup />` (2 lines each), so 6 upstream files in total.** **Actual after Phase 1: 4 upstream files, +11/-2 lines** (the section is an `Accordion.Item` mounted inside the sidebar's accordion, so `'mubox'` is added to its `defaultValue`; mounted after the accordion it rendered off-screen) (verify with
`git diff --stat`). New non-upstream files outside the feature folder: `Dockerfile.mubox`,
`docker/mubox/ng.conf.template`, `web.mubox.vite.config.ts` (dev server with the `/mubox` proxy and an
`optimizeDeps` fix for the atlaskit dev-server issue), `.claude/launch.json`. Dev run:
`pnpm exec vite --config web.mubox.vite.config.ts` (no package.json change). Possible later additions, only if needed and only after asking: a link to mubox
settings in the settings page (1 file), and `package.json` scripts (`dev:mubox`). `routes.ts` is deliberately **not**
touched (our paths are constants inside the feature). If a merge conflict appears, it will be in those few lines.

Upstream sync: add remote `upstream`, branch work on `mubox/*`, `git merge upstream/main` periodically. A CI-free
guard: a small script `scripts/mubox/check-touchpoints.sh` that fails if `git diff upstream/main --stat` lists any
file outside `src/renderer/features/mubox/`, `docs/mubox/`, the listed deploy files and the four touch points above.

## 4. How the app reaches mubox (CORS)

mubox has no CORS and Feishin's web build is served from nginx (9180) on another origin than mubox (8000), so
direct browser calls would fail. Decision: **same-origin proxy under `/mubox/`**.

- Production (Docker): nginx in the fork's image gets `location /mubox/ { proxy_pass ${MUBOX_URL}/; }` (env
  `MUBOX_URL`, default `http://mubox:8000` (the backend is named mubox again), a compose service name on the same network). The browser calls
  `/mubox/check`, `/mubox/jobs`, ... with a relative URL. Needs `proxy_read_timeout` raised for `/check` (probes can
  be slow) and `client_max_body_size` for pasted link lists. No CORS needed anywhere.
- Dev: `web.mubox.vite.config.ts` proxies `/mubox` to `http://localhost:8000` (path-rewritten).
- Base path is a constant (`/mubox`), overridable by `window.MUBOX_BASE` (settings.js) for non-root deployments.
- **Electron desktop build is out of scope for v1**: the file:// origin has no proxy, and a direct call would need
  mubox CORS. The mubox sidebar section hides itself when `isElectron()`. Revisit only if the user wants desktop.
- Cover images: `<img src="/mubox/tracks/{id}/cover">` works through the proxy today. If mubox later requires auth
  headers, `<img>` cannot send them, so covers then need a short-lived token query param or a cookie. Flagged for
  the mubox session.

## 5. Role model and the REQUIRED DECISION

- Admin gating in the UI: `currentServer.isAdmin` (from Navidrome `/auth/login`) when the server is Navidrome. For
  Jellyfin/Subsonic servers (or no Navidrome), mubox pages are hidden entirely.
- **This is cosmetic only.** mubox has no auth, so anyone who can reach port 8000 (or `/mubox/` on 9180, which now
  exposes it to every browser that can see the player) can download, edit tags, and trash files. Putting the
  proxy on 9180 makes the gap wider than today if 9180 is reachable by non-admins.
- **Decision needed from the user + mubox session (I do not build around it silently):**
  - **Option A (recommended):** mubox verifies the caller against Navidrome. The app sends the Navidrome JWT in
    `X-ND-Authorization: Bearer <token>` (or `Authorization`) on every `/mubox/*` call. mubox calls Navidrome
    (`GET /api/user/<id>` or a cheap authed `/api/...` call) to validate it, caches the result briefly, requires
    `isAdmin` on every write endpoint (`/download`, `/jobs/*` writes, `PATCH`, `/batch/*`, copies, revert), and
    allows any valid user on the read-only endpoints chosen for "any user" pages. Cover URLs need the token trick
    above.
  - **Option B:** nginx `auth_request` against Navidrome in front of `/mubox/`, no mubox code change. Coarser (no
    per-endpoint admin vs user split without extra rules) but fully outside both repos' app code.
  - **Option C:** accept the gap, keep mubox unreachable from outside the docker network except through the proxy,
    and rely on 9180 being private. Not recommended.
- My client always attaches the header, so Option A/B work with no UI rework.

### Agreed contract (spec from the mubox session; not built until the user allows Python changes)

- Header: `X-ND-Authorization: Bearer <Navidrome JWT>` (`Authorization: Bearer` also accepted, we send the first).
- mubox verifies by calling Navidrome `GET /api/user/<uid>` with the same header and reading `isAdmin`; cached 60 s.
- Switch: env `MUBOX_AUTH=off|navidrome`, default `off`. With `navidrome`, mubox's own HTML pages stop working
  (they send no token), so we turn it on only when our pages replace them.
- Writes (every non-GET, including `/check`, `/batch/plan`, `POST /tracks/resolve`) need admin. GETs (`/jobs`,
  `/tracks`, `/track-ids`, `/albums`, `/tracks/{id}`, `/tracks/{id}/info`, `/batch/last`) need any valid token for
  now; revisit when the user names the any-user pages.
- Errors, JSON `{"detail": ...}`: **401** not signed in (send user to Feishin login), **403** "Admin only" (no
  retry), **503** Navidrome unreachable (show offline state); existing 400 `fields` / 404 / 409 / 410 unchanged.
  The client maps these centrally in `features/mubox/api/client.ts`.
- Covers: app calls `POST /auth/session` (Bearer) on load and every few hours; mubox sets HttpOnly SameSite=Lax
  cookie `mubox_cover` (8 h), accepted **only** by `GET /tracks/{id}/cover`. The nginx proxy must pass
  `Set-Cookie`/`Cookie` through. Cookie is also sent to Navidrome on :4533 (harmless).
- `POST /tracks/resolve` (admin): `{"paths": [...]}` (max 500) returns
  `{"results": {path: {video_id, kind: main|copy, copy_id}}}`; unknown paths omitted.

## 6. Pages and phases

Phase 0 (this): plan, approval. No installs/builds until the user agrees (dependency download).

Phase 1 - Foundation (admin gate)
- Install deps (`pnpm install`, asks first), run the web build to confirm a clean baseline.
- Feature skeleton, splat route, sidebar section (desktop/collapsed/mobile), `mubox` API client with typed
  endpoints, React Query keys, error/offline state (mubox unreachable, 401/403 later), i18n bundle.
- `useMuboxAccess()` hook (`isAdmin`, navidrome-only, not electron) and `<AdminOnly>` wrapper with a proper
  "no access" page.

Phase 2 - Downloader (admin) `/mubox/download`
- Link box, Check (Ctrl+Enter), per-URL result rows, playlists with selectable entries, Download button with
  estimated time.
- Queue in four groups: Downloading, Failed (Retry), Already in library, Downloaded; scrolling boxes, "Show more"
  on the last two; pause banner with "Try now" (`/jobs/resume`); queue header ETA; polling `GET /jobs`.
- Reference: `mubox/app/static/index.html`, `app.js`, `style.css`.

Phase 3 - Library management (admin) `/mubox/library`, `/mubox/track/:id`, `/mubox/trash`
- Cards/list toggle, search, sort (added/title/artist/album/date) + direction, album filter ("No album").
- Select mode, shift-range, select all then "all N matching" (`/track-ids`).
- Batch actions (set album, album from playlist link, album = title, clear, set artist, set date, trash) with a
  preview dialog (`/batch/plan`), chunked apply with progress, Undo last batch (check `GET /batch/last` `last.id`
  equals our batch uuid first).
- Track page: tag editing with revert, "Albums" block with copies, source/file/raw data.
- Messy-text and empty states (raw titles, channel-name artists, 16:9 covers, no album) designed explicitly.
- Reference: `library.html|js`, `track.html|js`, `batch.js`, `common.js`.

Phase 4 - Pages for any user (NOT started until the user says which)
- Candidates: read-only download queue status, album/copy information. Will ask first.

Phase 5 - Navidrome bridge (depends on mubox)
- "Manage in mubox" link from a Feishin song/album context (needs `POST /tracks/resolve`: Navidrome path -> video
  id, kind main|copy, copy_id). One more touch point (context menu), added only then.

Writes show mubox's own response immediately; the 60 s debounced Navidrome rescan is never awaited. Optionally a
quiet "library updates in about a minute" hint, and invalidate Feishin's own library queries after the delay.

## 7. Look and feel

Native to Feishin: shared wrappers (`Button`, `TextInput`, `Table`-like lists, `Modal`, `Badge`, `Tabs`, `Spinner`,
`toast`), `var(--theme-*)` tokens only, the existing page chrome (`LibraryHeader`, `FilterBar`, list/grid
patterns from `features/shared/components`), no mubox-admin styling. Design skills used per phase:
`ux-research` and `design-systems` (component mapping) in phase 1, `interaction-design` and `ux-writing` for the
queue/batch flows, `design-critique`, `accessibility-audit` before each phase sign-off, `design-elevation` last.

## 8. Test and visual verification

- Unit: Vitest if the repo has it (to check; otherwise add as a dev dep only with approval) for the pure logic:
  URL/ETA/selection/batch-chunking helpers, API client against a mock.
- Integration against the real mubox (`localhost:8000`) and Navidrome (`4533`) with a scratch/test library, and a
  mock mubox server (small script in `scripts/mubox/`) for failure states: paused queue, 500s, timeouts.
- Typecheck + lint (`pnpm typecheck`, `pnpm lint`) every phase.
- Visual: run the web dev config and check each page in the built-in browser at desktop and phone width (375),
  light and dark themes (plus one custom theme to prove token use), keyboard-only pass, and screenshots saved
  under `docs/mubox/screens/` for review.
- Upstream guard script (section 3) in the checklist before any merge.

## 9. Open questions for the user

1. Approve the isolation strategy and the 4-file touch list?
2. Auth decision (section 5): A, B or C? Needs the mubox session.
3. OK to run `pnpm install` and a baseline `build:web` (downloads packages)?
4. Desktop (Electron) support: skip in v1 (my proposal)?
5. Which pages should every user see (phase 4)?
6. Mubox UI session: is it retired now? (I am not coordinating with it unless told.)
7. GitHub fork/remotes: keep `origin` = upstream until you say, then create the fork and switch.
