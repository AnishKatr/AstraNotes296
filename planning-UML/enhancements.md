# AstraNotes Post-Baseline Enhancements

This document describes features added after the requirements baseline was finalized. These are not part of the graded requirements (FR-01 through FR-07, NFR-01 through NFR-02, SPR-01 through SPR-03) and are not renumbered into that range. They are tracked here for completeness and to give context to anyone reading the codebase after the baseline phases were submitted.

All five enhancements are fully implemented and covered by tests. They do not conflict with any baseline requirement; they extend the app in directions that were always the natural next step.

---

## ENH-01: Design System (shadcn/ui + Radix UI)

**Implemented in Phase 7.**

Replaced the ad-hoc Tailwind utility classes with a structured design system using shadcn/ui and Radix UI. The approach uses CSS custom properties (HSL channels) as design tokens, a `darkMode: ['class']` Tailwind config, and a `ThemeProvider` that applies the correct class to `<html>` based on the user's preference.

Key choices:
- Manual shadcn init instead of the CLI, so the palette is exact and no post-init color override pass was needed.
- CSS variables hold bare HSL channels (`247 74% 63%`), not `hsl()` wrappers, matching the shadcn convention that lets Tailwind's opacity modifier syntax work without extra tooling.
- Ten shadcn/ui components installed: button, input, textarea, card, badge, separator, scroll-area, tooltip, dialog, dropdown-menu.
- `src/components/ui/` and `src/lib/` excluded from Vitest coverage thresholds since they are design system building blocks, not application logic.

This enhancement is the foundation for ENH-02 and indirectly for ENH-03 through ENH-05, which all use shadcn components.

---

## ENH-02: Dark Mode

**Implemented in Phase 7 alongside ENH-01.**

`ThemeProvider` supports three modes: light, dark, and system. System mode reads `window.matchMedia('(prefers-color-scheme: dark)').matches` at render time and applies the appropriate `light` or `dark` class to `document.documentElement`. The selected mode is persisted to `localStorage` under the key `astranotes-theme`.

`ThemeToggle` is a button that cycles through light/dark/system in order. It reads and sets the mode via the `useTheme` context hook exposed by `ThemeProvider`.

No media query listener is registered for live system preference changes. Theme re-evaluation happens only when the user explicitly changes the mode in the app, which is the right trade-off for a personal tool where users make deliberate theme choices.

---

## ENH-03: UI Shell Redesign

**Implemented in Phase 8.**

Replaced the initial single-column layout with a three-pane shell: a persistent left sidebar, a note list pane, and an editor pane. The structure mirrors the layout pattern of apps like Notion and Bear.

- `AppShell` is the root layout component. It uses React Router's `<Outlet>` to render the active route in the main area.
- `NotesLayout` renders the NoteList on the left and the active note editor (or `EmptyEditorPane`) on the right. `useMatch('/notes/:id')` detects whether a note is open and controls pane visibility on mobile.
- `Sidebar` contains the main nav (All notes, Trash, Settings), the tag list (populated from the real `/api/tags` endpoint), and a note count badge. On mobile it becomes a slide-in drawer triggered by a hamburger button.
- All components use shadcn/ui Button, Badge, and Separator primitives.
- Mobile layout uses `hidden md:flex` / `flex w-full md:w-56` breakpoint classes; no JavaScript media query detection is needed for the basic responsive behavior.

---

## ENH-04: Tags

**Implemented in Phase 9.**

Tags are an array of normalized strings stored on each note document. Normalization is: trim whitespace, lowercase, deduplicate, max 10 tags per note, max 30 characters per tag. Validation happens server-side in `validate_tags()` in `NoteService` and returns 400 with a message on violation.

Backend additions:
- `GET /api/tags` returns `{ tags: [{ tag, count }] }` sorted by count descending, excluding deleted notes. Implemented via a MongoDB aggregation pipeline (`$unwind` on tags, `$group` by tag, `$sort`, `$project`).
- `GET /api/notes?tag=<tag>` filters the note list to notes containing that tag. Combines with existing `?type=` and `?q=` parameters.
- Two new MongoDB indexes: `{ tags: 1 }` for tag filtering, `{ deleted_at: -1 }` for trash listing.

Frontend additions:
- `TagChip.jsx`: a colored pill with an optional remove button.
- `TagEditor.jsx`: an inline editor in the NoteEditor toolbar. Fetches real tags from `/api/tags` on mount for autocomplete suggestions. Enter or comma adds a tag; Backspace removes the last tag.
- `tagColor.js` in `src/lib/`: maps a tag string to a stable color from a 10-color palette using a djb2 hash, so the same tag always gets the same color without storing the assignment.
- Sidebar renders the tag list with colored dots; clicking a tag navigates to `/notes?tag=<tag>` via `useSearchParams()`, making the filter bookmarkable.
- NoteList shows up to 3 tag chips per note card, with a `+N` overflow label.

---

## ENH-05: Trash Management

**Implemented in Phase 9.**

Surfaces and manages soft-deleted notes. The baseline soft-delete (Phase 1) set `deleted: true` and hid notes from the list; this enhancement lets users see, restore, and permanently delete them.

Backend additions:
- `GET /api/trash`: returns deleted notes sorted by `deleted_at` descending (most recently deleted first). Soft-delete was updated to also write `deleted_at: datetime.utcnow()` so trash has a time-of-deletion.
- `POST /api/notes/<id>/restore`: clears `deleted` and `deleted_at`, returns the restored note. Returns 404 if the note does not exist or is not deleted.
- `DELETE /api/notes/<id>/permanent`: removes the document from MongoDB entirely. For voice notes, calls `AudioService.delete_audio()` to clean up the GridFS file. Returns 204. Returns 404 if the note is not in trash (you cannot permanently delete an active note this way).
- `DELETE /api/trash`: permanently deletes all soft-deleted notes and their GridFS audio in one operation. Returns 204.
- `AudioService.delete_audio(file_id)` added to handle GridFS cleanup.

Frontend additions:
- `TrashPage.jsx`: full trash view with a title, a per-row Restore button and "Delete permanently" button, an "Empty trash" button when notes exist, and an empty state illustration when trash is empty.
- Permanent delete and Empty trash both require confirmation via shadcn Dialog.
- Sidebar shows a trash count badge that fetches from `/api/trash?limit=1` (uses the `total` field, not the note array, so it is a cheap query).

---

## ENH-06: Export

**Implemented in Phase 9.**

Adds a download icon in the NoteEditor toolbar that opens a dropdown with two export options. Only shown for existing notes, not for the `/notes/new` form.

**Export as Markdown:** calls `exportMarkdown(title, body)` from `src/lib/exportNote.js`. Prepends the note title as an H1, creates a Blob, triggers a download via a temporary anchor element, and revokes the object URL immediately after.

**Export as PDF:** calls `exportPdf(title, bodyHtml)` from the same file. Opens a blank `_blank` window, writes a self-contained HTML document with print-optimized CSS (serif body font, max-width 680px, correct margins, code block styling, table borders), and calls `window.print()` on the new window. The body HTML is read from `previewRef.current.innerHTML` on the rendered Markdown preview div, so what prints is what the user sees, not raw Markdown.

No new library dependencies were added. The decision to use `window.open` + `print()` instead of a PDF library like jspdf or html2pdf was deliberate: both are not on the approved stack, and the browser print dialog produces correct PDF output for the kinds of notes this app stores.
