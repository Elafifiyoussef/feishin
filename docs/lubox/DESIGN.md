# Design rules for the lubox pages (so they blend into Feishin)

Derived from reading Feishin's code (`docs/agents/frontend.md`, `mantine.md`, `src/shared/components/*`,
`src/renderer/themes/mantine-theme.tsx`, `shared/styles/global.css`, the radio/settings/library pages, sidebar,
modal and button CSS). Where this says "verify", I have not yet seen it run.

## 1. Principles Feishin follows (and we follow)

1. **Wrappers, never raw Mantine.** Feature code imports from `/@/shared/components/<name>/<name>` only. No
   `@mantine/core` in the lubox folder (exception: `@mantine/modals` `openModal`/`closeAllModals`).
2. **Tokens, never literals.** Colors from `var(--theme-colors-*)`, spacing `var(--theme-spacing-*)`, radius
   `var(--theme-radius-*)`, font sizes `var(--theme-font-size-*)`. No hex, no `px` for spacing, no `--mantine-*`.
   This is what makes our pages follow all 31 themes, light/dark and user custom themes for free.
3. **Flat and quiet.** Surfaces are `surface` on `background`, separated by 1px `border` lines, small radii
   (`sm` 3px, `md` 5px). Shadows only on overlays (modals). No gradients, no heavy cards, no colored panels.
4. **One accent.** Primary color marks the active state, focus and the single main action. Status colors come only
   from `state-error|warning|success|info`.
5. **Dense, desktop-music-app density.** Default control size `sm`, text `md`(14px)/`sm`(13px)/`xs`(11px), headings
   weight 600-900 only for titles. Tabular numerals are on globally (good for counts and ETA).
6. **Quiet motion.** Pages fade in via `AnimatedPage`; hover/focus transitions about 0.2s ease. No bounces.
7. **Keyboard and focus.** Focus is shown as a 1px primary outline/border (`:focus-visible`); keep that, never
   remove outlines without a replacement.
8. **Everything translated** via `t()`; icons via `<Icon icon="...">` from the shared `AppIcon` map.

## 2. Tokens we may use

| Need | Token |
|---|---|
| Page / panel background | `--theme-colors-background`, `--theme-colors-background-alternate` |
| Raised surface (inputs, cards, rows) | `--theme-colors-surface` (+ `surface-foreground` for text on it) |
| Lines | `--theme-colors-border` |
| Text / secondary text | `--theme-colors-foreground` / `--theme-colors-foreground-muted` |
| Accent, filled accent, text on accent | `--theme-colors-primary`, `-primary-filled`, `-primary-contrast`, `-primary-transparent` |
| Status | `--theme-colors-state-error/warning/success/info` |
| Spacing | `--theme-spacing-xs 4, sm 8, md 12, lg 16, xl 24, 2xl 32` |
| Radius | `--theme-radius-sm 3, md 5, lg 12, xl 16` |
| Font size | `--theme-font-size-xs 11, sm 13, md 14, lg 16, xl 18, 2xl 20` |
| Max content width | `--theme-content-max-width` |

Hover/pressed shades are made with the PostCSS helpers `lighten()`, `darken()`, `alpha()` and the mixins
`@mixin dark { }` / `@mixin light { }` (see `button.module.css`). Stylelint enforces property order (recess-order)
and CSS-module naming: classes kebab-case, used as camelCase.

## 3. Page anatomy (copy the radio/list pages)

```
<AnimatedPage>                       fade-in wrapper (<main>)
  <PageErrorBoundary>                per-page error fallback (wrap in the route)
    <Stack gap={0}>
      <PageHeader>                   sticky top bar
        <LibraryHeaderBar ignoreMaxWidth>
          <LibraryHeaderBar.Title/>  + <LibraryHeaderBar.Badge/> for the count
        </LibraryHeaderBar>
        <Group> actions / <ListSearchInput/> </Group>
      </PageHeader>
      <FilterBar>                    1px bottom border, xs padding: sort, filters, view toggle
    </Stack>
    <ScrollArea><Stack p="md"> content </Stack></ScrollArea>
```

- Settings-style pages use `LibraryContainer` (max width, centered) and `SettingsSection` (`TextTitle order 4`,
  `Stack gap xl px xl`, option rows of title + description + control). Use this for the Downloader form column and
  track tag editing.
- Loading: `<Spinner container />`; lists use skeleton rows rather than layout jumps.
- Counts shown in the header Badge, not in prose.
- Sidebar entries: `SidebarItem` (subtle `Button` as router `Link`, active = primary color, icon + label, `Group
  gap="md"`) inside an Accordion section titled with `Text fw=500 variant=secondary`. The lubox section mirrors the
  "My library" accordion item exactly.

## 4. Component mapping (lubox UI -> Feishin building blocks)

| lubox element | Feishin building block |
|---|---|
| Link textarea + Check / Download | `Textarea` + `Button` (`filled` for the one primary action, `default` for the rest), hint with `Text isMuted` |
| Per-URL result rows | rows with `Icon` (success/error/info/warn colors) + `Text`; playlist entries use `Checkbox` list in a bordered `ScrollArea` |
| Queue groups (Downloading/Failed/Already/Downloaded) | `Accordion` (as in sidebar) or `Paper`/bordered `ScrollArea` blocks with `TextTitle order 4` and a `Badge` count; row actions are `ActionIcon` (retry = `refresh`) |
| Pause banner + "Try now" | inline banner built from `Paper` with `state-warning` left border + `Button size xs`; not a toast (it is persistent) |
| ETA | `Text size sm isMuted`, tabular numerals; also inside the button label |
| Library cards/list toggle | the existing `DisplayTypeToggleButton`/`ListDisplayTypeToggleButton` pattern; cards use `item-card` styling (surface, radius md, selected = 2px primary outline), list uses `Table`/item-table |
| Search, sort, direction, album filter | `ListSearchInput`, `ListSortByDropdown`, `ListSortOrderToggleButton`, `Select` inside `FilterBar` |
| Select mode, "all N matching" | selection pattern of `multi-select-rows` / `selection-dialog`; floating action bar built with `Paper` + `Group`, not a custom toolbar |
| Batch preview, confirm | `openModal` + shared `Modal`/`ConfirmModal`; progress with shared `Progress` |
| Undo last batch | `Button variant="default"` with `Icon undo`; success toast with the action |
| Tag editing | form in a `SettingsSection`-like stack: `TextInput`, `NumberInput`, `DatePicker`, `Select`; helpers (playlist link, "As single") as small `Button`s; Save is the single `filled` button |
| Copies / "Albums" block | `Table` or simple rows with `Badge` ("Main", "Copy") |
| Empty / messy states | centered `Stack` with the large muted `Icon` (e.g. `emptySongImage`) + `Text` + one action; long raw titles use `overflow hidden` + ellipsis + tooltip, never wrap the layout |
| Errors | `toast.error({ title, message })`; page-level `PageErrorBoundary`; offline/401/403 as full-page `Center` messages |

## 5. Rules specific to lubox data

- Raw titles ("Artist - Song (Official Video)") and channel-name artists: render **verbatim**, single line with
  ellipsis and full text in a `Tooltip`; never "clean" the text in the UI.
- Covers are 16:9 thumbnails: crop with `object-fit: cover` into the square card slot using the app's
  `--theme-image-fit` convention (verify it applies to a plain `<img>`), keep a 16:9 variant in the detail view.
  No cover = the muted `emptySongImage` placeholder on `surface`.
- No album is the common case, not an error: show a muted "No album" label and expose it as a filter.
- Status uses icon + text, never color alone (accessibility), and respects contrast on every theme.
- Writes show lubox's response immediately; "library will update shortly" is a muted note, not a spinner.

## 6. Phone width and light/dark

- Use `ResponsiveLayout`/mobile patterns Feishin already ships (`mobile-layout`, `mobile-sidebar`): lists collapse
  to one column, filter bar scrolls horizontally or moves into a menu, modals become full height; touch targets
  at least 40px.
- Never hard-code colors, so light/dark is automatic. Verification list: default dark, default light, one
  high-contrast theme, one colorful theme (e.g. dracula), at 375px and desktop width.

## 7. Process (how we keep the blend)

1. Before building a component, look for the closest existing one (search `features/shared/components` and
   `/@/shared/components`) and reuse or wrap it; only create feature-local pieces when none fits.
2. Compose in the order of `frontend.md`: shared wrapper > feature-shared > feature-local (our folder).
3. Each page ships with: a screenshot set (desktop/phone, light/dark) in `docs/lubox/screens/`, a lint pass
   (`pnpm lint`), and a short design critique (heuristics + accessibility) before sign-off.
4. A "blend check": open the lubox page next to an upstream page (Playlists, Settings) in the same theme and
   compare header, spacing, control sizes and fonts. Any visible difference is a bug.
