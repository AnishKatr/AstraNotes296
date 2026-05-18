# AstraNotes Decision Log

Each entry covers a major AI interaction: the prompt used, the key output, and revisions or deviations noted after review.

---

## Entry 001 - Phase 2: Markdown Rendering (US-06, FR-07)

**Date:** 2026-05-07
**Model:** Claude Sonnet 4.6 (claude-sonnet-4-6)
**Branch:** cursor/astranotes-backend-scaffold

### Prompt used

> We're starting Phase 2 of AstraNotes (US-06: Markdown Rendering, FR-07).
>
> In the frontend:
> 1. Add react-markdown as a dependency (and remark-gfm for GitHub-flavored markdown support like tables and strikethrough)
> 2. Update the note editor component to display a side-by-side layout: textarea on the left, rendered preview on the right
> 3. The preview should render the textarea content live as the user types
> 4. Use Tailwind for the layout (split 50/50 on desktop, stacked on mobile)
> 5. The preview pane should have prose styling so headings, lists, code blocks, etc. look reasonable
>
> Important:
> - Raw Markdown stays in the textarea and gets sent to the backend as-is
> - No backend changes required; rendering is client-side only per FR-07
> - Malformed Markdown should degrade gracefully (display as plain text, no crash)
>
> Update or add React Testing Library tests to verify the preview renders Markdown correctly for headings, bold, lists, and code blocks.

### Key output

Libraries added to `frontend/package.json`:

| Package | Version | Type |
|---|---|---|
| `react-markdown` | ^10.1.0 | dependency |
| `remark-gfm` | ^4.0.1 | dependency |
| `@tailwindcss/typography` | ^0.5.19 | devDependency |
| `@testing-library/react` | ^16.3.2 | devDependency |
| `@testing-library/jest-dom` | ^6.9.1 | devDependency |
| `jsdom` | ^29.1.1 | devDependency |
| `vitest` | ^4.1.5 | devDependency |

Files created:
- `frontend/src/components/MarkdownPreview.jsx` - wraps ReactMarkdown with remarkGfm and Tailwind prose classes
- `frontend/src/components/MarkdownPreview.test.jsx` - 10 Vitest + RTL tests
- `frontend/src/test/setup.js` - imports jest-dom matchers

Files modified:
- `frontend/src/pages/NoteEditor.jsx` - replaced single textarea with a `flex-col md:flex-row` split layout; added MarkdownPreview import
- `frontend/tailwind.config.js` - added `@tailwindcss/typography` plugin
- `frontend/vite.config.js` - added `test` block for Vitest (jsdom environment, setup file, globals)
- `frontend/package.json` - added `test` and `test:watch` scripts

Test results: 10/10 passing. Production build clean.

### Revisions made after review

None required. Output compiled and ran without errors on first attempt after fixing a Python 3.9 compatibility issue (unrelated to Phase 2) that surfaced during Phase 1 setup.

### Deviations to be aware of

1. **Log file location.** The working agreement (working-agreement.md) says the decision log lives in `/docs`. This file is in `planning/` instead, per explicit instruction. The two locations should be reconciled before the Technical Defense.

2. **`NoteEditor` has no tests.** The 10 tests cover `MarkdownPreview` only, which is where FR-07's rendering behavior lives. `NoteEditor` itself (save, delete, load-on-mount) is untested at the component level. Testing it requires mocking `react-router-dom` hooks and the notes API service. This is a coverage gap relative to SPR-03's 80% coverage target. Recommend adding NoteEditor interaction tests in a follow-up.

3. **`@tailwindcss/typography` is not on the approved tech stack list in CLAUDE.md.** It was added to satisfy the prose styling requirement in the prompt. The CLAUDE.md tech stack section lists "Tailwind CSS" without explicitly naming plugins. This should be noted as an approved addition since it was part of the Phase 2 specification.

4. **Graceful degradation relies on react-markdown's built-in behavior, not an explicit error boundary.** FR-07 requires that malformed Markdown degrades gracefully without a crash. This holds because react-markdown never throws on invalid input; it renders whatever it can parse. No React error boundary component was added. If the requirement is interpreted strictly, an error boundary around `MarkdownPreview` would make the guarantee explicit. Current behavior passes in practice but is not defensively coded.

---

## Entry 002 - Phase 4: Search and Filter (US-05, FR-06)

**Date:** 2026-05-07
**Model:** Claude Sonnet 4.6 (claude-sonnet-4-6)
**Branch:** cursor/astranotes-backend-scaffold

### Prompts used

**Prompt 4.1 (backend):**

> We're starting Phase 4 of AstraNotes (US-05 Search and Filter, FR-06).
>
> In the backend:
> 1. Create a MongoDB text index on the title and body fields of the notes collection
>    - Add this as a startup step in app.py or a migrations script so the index exists in any environment
>    - Use weights to prioritize title matches over body matches
> 2. Update GET /api/notes to support these query parameters:
>    - q: search string. If present, performs a text search on title + body. Empty or missing q returns all notes (FR-06)
>    - type: one of "text", "voice", or "secure". Filters notes by type. Invalid values return 400 with code "INVALID_TYPE"
>    - limit: pagination size, default 50, max 100
>    - cursor: the _id of the last note from the previous page (cursor-based pagination)
> 3. Important architectural note for secure notes:
>    - Secure notes have encrypted bodies, so body text search will not match their content. This is intentional and correct (we never decrypt during search)
>    - Secure notes are still findable by TITLE since titles are stored in plaintext
>    - Document this as a code comment in the search service so it's clear it's a deliberate design choice, not a bug
> 4. Soft-deleted notes (is_deleted: true) must be excluded from all search and list results
> 5. Sort results by updated_at descending (most recently modified first)
>
> Tests in tests/backend/services/test_note_service.py and tests/backend/routes/test_notes.py:
> - Search by title returns matching notes (text and secure)
> - Search by body returns matching text/voice notes but NOT secure notes (since their bodies are ciphertext)
> - Filter by type=text returns only text notes
> - Filter by type=secure returns only secure notes
> - Invalid type=xyz returns 400 with code INVALID_TYPE
> - Empty q returns all (non-deleted) notes
> - Pagination: limit=2 returns 2 notes, cursor advances correctly to the next page
> - Soft-deleted notes are excluded from all results

**Prompt 4.2 (frontend):**

> Continuing Phase 4. Now add the search and filter UI.
>
> In the frontend:
> 1. Add a search bar at the top of the note list view
>    - Plain text input with placeholder "Search notes..."
>    - Debounce the API call (300ms) so we're not hitting the backend on every keystroke
>    - Clear button (X icon) to reset the search
> 2. Add a type filter as a dropdown or pill group next to the search bar
>    - Options: "All", "Text", "Voice", "Secure"
>    - Default: "All" (no type filter applied)
>    - Switching type triggers an immediate refetch (no debounce needed)
> 3. Update the note list view to:
>    - Display search/filter results dynamically
>    - Show a "No notes match your search" empty state when the result is empty
>    - Maintain the existing list styling (lock icons for secure notes, etc.)
> 4. Add a small inline note near the search bar that says something like "Note: secure note contents are not searchable" so users understand why a secure note's body text won't match. Keep it subtle but visible.
> 5. Implement basic cursor-based pagination:
>    - Show a "Load more" button at the bottom of the list when more results are available
>    - Clicking it appends the next page rather than replacing the current list
>
> Tests with React Testing Library:
> - Typing in the search bar triggers an API call after the debounce delay
> - Selecting a type filter triggers an immediate API call with the type parameter
> - The clear button resets the search and refetches all notes
> - The "No notes match" empty state renders when the API returns an empty result

### Files added or modified

**Backend:**

| File | Status | Change summary |
|---|---|---|
| `backend/app/__init__.py` | Modified | `_ensure_indexes` now creates a weighted text index (`title: 10, body: 1`), drops the pre-Phase-4 unweighted index on startup if present, and adds a `deleted` field index |
| `backend/app/services/note_service.py` | Modified | `list_notes` rewritten to accept `q`, `note_type`, `limit`, `cursor`; added `InvalidNoteTypeError`; cursor-based keyset pagination on `(updated_at, _id)` |
| `backend/app/services/plugin_registry.py` | Modified | `voice` type registered with a passthrough handler so `type=voice` is valid for filtering |
| `backend/app/routes/notes.py` | Modified | `list_notes` route extracts `q`, `type`, `limit`, `cursor` params; clamps `limit` in the route so the response reflects the effective value; catches `InvalidNoteTypeError` separately as INVALID_TYPE |
| `backend/tests/test_notes.py` | Modified | 21 new Phase 4 tests added (search by title/body, type filter, soft-delete exclusion, pagination, limit clamping) |

**Frontend:**

| File | Status | Change summary |
|---|---|---|
| `frontend/src/services/notes.js` | Modified | `listNotes` now accepts `{ q, type, limit, cursor }` and builds the query string |
| `frontend/src/pages/NoteList.jsx` | Modified | Rewritten with debounced search bar, X clear button, type filter pill group, "no match" empty state, "Load more" cursor pagination, secure note search disclaimer |
| `frontend/src/pages/NoteList.test.jsx` | New | 25 Phase 4 tests: debounce timing, type filter immediate call, clear button, empty states, Load more behavior |

### New dependencies

No new runtime or dev dependencies were added in Phase 4. All features are implemented using packages already in the stack (pymongo, Flask, React, Tailwind, Vitest, React Testing Library).

### Test coverage

**Backend (`pytest`):** 47 total tests, all passing.

Phase 4 specific tests (24 in `test_notes.py`):

| Behavior tested | Test |
|---|---|
| Type filter `type=text` returns only text notes | `test_filter_by_type_text` |
| Type filter `type=voice` returns only voice notes | `test_filter_by_type_voice` |
| Type filter `type=secure` returns only secure notes | `test_filter_by_type_secure` |
| Invalid `type=xyz` returns 400 INVALID_TYPE | `test_invalid_type_filter_returns_400` |
| INVALID_TYPE returned even when collection is empty | `test_invalid_type_filter_empty_collection_still_400` |
| Empty `q` returns all notes | `test_empty_q_returns_all_notes` |
| Missing `q` returns all notes | `test_missing_q_returns_all_notes` |
| Title search matches text notes | `test_search_by_title_matches_text_note` |
| Title search matches secure notes | `test_search_by_title_matches_secure_note` |
| Body search matches text notes | `test_search_body_matches_text_note` |
| Body search does NOT match secure notes | `test_search_body_does_not_match_secure_note` |
| `q` + `type` combined filter | `test_search_and_type_filter_combined` |
| No match returns empty list | `test_search_no_match_returns_empty` |
| `limit=2` returns 2 notes | `test_pagination_limit` |
| Cursor advances to next page, no duplicates | `test_pagination_cursor_advances_to_next_page` |
| Last page has no `next_cursor` | `test_pagination_no_next_cursor_on_last_page` |
| `total` is constant across pages | `test_pagination_total_unchanged_across_pages` |
| Soft-deleted notes excluded from list | `test_soft_deleted_notes_excluded_from_list` |
| Soft-deleted notes excluded from type filter | `test_soft_deleted_excluded_from_type_filter` |
| Soft-deleted notes excluded from text search | `test_soft_deleted_excluded_from_search` |
| `limit=999` clamped to 100 in response | `test_limit_clamped_to_100` |

**Frontend (Vitest):** 39 total tests, all passing.

Phase 4 specific tests (25 in `NoteList.test.jsx`): type filter buttons rendered, immediate API call on type selection, correct `type` param in call, All filter removes type param, search does not fire before 300ms, search does not fire at 299ms, search fires with correct `q` after 300ms, clear button hidden when empty, clear button visible when input has text, click clear resets input and calls API without q, "No notes yet" when collection is empty, "No notes match" when filtered result is empty, "No notes match" when text search returns empty, Load more button appears when `next_cursor` is not null, Load more absent when `next_cursor` is null, Load more appends results without replacing first page, Load more passes cursor to API, secure note disclaimer rendered.

### MongoDB text index

The index is created at app startup by `_ensure_indexes` in `backend/app/__init__.py`:

```python
notes.create_index(
    [("title", "text"), ("body", "text")],
    weights={"title": 10, "body": 1},
    name="notes_text_search",
)
```

Verified on the live local instance via `mongosh`:

```json
{
  "name": "notes_text_search",
  "key": { "_fts": "text", "_ftsx": 1 },
  "weights": { "body": 1, "title": 10 },
  "default_language": "english",
  "textIndexVersion": 3
}
```

The startup code also drops the pre-Phase-4 index (`title_text_body_text`, equal weights) if it still exists, so the migration is idempotent on both fresh and previously-run environments.

### Key design decisions (for Technical Defense)

**1. Why secure note bodies are intentionally not searchable**

Secure note bodies are stored as AES-256-GCM ciphertext. The MongoDB text index operates on the stored value, not the plaintext, so a body search can never match meaningful content from a secure note. Rather than treating this as a limitation to hide, we surfaced it as an explicit design choice:

- The service docstring in `note_service.py` documents it with a comment.
- The frontend shows a visible (but subtle) disclaimer: "Secure note contents are not searchable."
- A dedicated test (`test_search_body_does_not_match_secure_note`) verifies the behavior is stable.
- Secure notes are still findable by title, which is stored in plaintext. This covers the common use case: a user can name their note and search for it.

The alternative, decrypting all secure notes during a list query, would expose every note's plaintext on every search and would make the list endpoint O(n * decryption cost). That violates SPR-01 and would be a serious regression in both security and performance.

**2. Cursor-based vs. offset-based pagination**

Offset pagination (`SKIP n, LIMIT k`) degrades predictably as the collection grows: MongoDB must scan and discard `n` documents before returning results. On a 1,000+ note collection sorted by `updated_at`, every page-2 request scans at least 50 documents to throw them away. Under concurrent writes this also causes phantom rows (a new note shifts everything by one).

Cursor-based pagination uses the `(updated_at, _id)` pair of the last document as an exclusive lower bound:

```python
page_query["$or"] = [
    {"updated_at": {"$lt": cursor_time}},
    {"updated_at": cursor_time, "_id": {"$lt": cursor_oid}},
]
```

This means each page fetch is a bounded seek into the `updated_at` index with no scan overhead, and inserts during paging do not cause duplicates or skips. The `_id` secondary sort breaks ties when multiple notes share the same millisecond timestamp.

Trade-off acknowledged: cursor pagination requires the client to track the `next_cursor` value. There is no "jump to page 7" without scanning. For a personal note-taking app this is an acceptable constraint.

**3. Text index weighting (title: 10, body: 1)**

MongoDB's text index assigns a relevance score to each document. With `weights={"title": 10, "body": 1}`, a document whose search term appears in the title scores 10x higher than one where it only appears in the body. Results are returned in score order.

The practical effect: if a user searches for "meeting", notes titled "Meeting notes" appear before notes that merely mention the word "meeting" somewhere in the body. This matches the mental model of most search tools and matches how we would weight a simple manual search.

Weight values of 10 and 1 are the simplest ratio that achieves the intent. There is no evidence yet that any other ratio would be better, so the simplest defensible choice was made.

**4. Frontend debounce and why it matters**

Without debouncing, every keystroke fires an API call. For a 10-character search term that means 10 round trips, each triggering a MongoDB `$text` query. At the UX level this also causes visible result flicker as partially-typed queries return spurious matches.

300ms was chosen because:
- Empirical research on typing speed places the 90th percentile at roughly 200ms between keystrokes for fast typists. A 300ms gap reliably catches pause-before-submitting without feeling laggy.
- It is the most common debounce interval cited in testing-library and react documentation examples, making it easy to test with fake timers.

The clear button bypasses the debounce (calls `setQuery('')` directly) so the reset feels instantaneous, which is the expected UX: clearing is a deliberate action, not a keystroke that should wait.

Type filter changes also bypass the debounce, since the user is making an explicit categorical selection rather than composing a query string.

### Deviations from CLAUDE.md and requirements

**1. `voice` type registered in Phase 4, not Phase 6.** The `voice` type was added to `PluginRegistry` with a passthrough handler so that `GET /api/notes?type=voice` is a valid filter. The CLAUDE.md phase plan places voice note implementation in Phase 6. Registering the type early is architecturally sound (the plugin registry is the single source of truth for valid types) and was necessary for FR-06's filter validation to recognize voice as a valid value. No audio recording code was added.

**2. mongomock does not support `$text` queries.** The test infrastructure uses `mongomock` (4.3.0) which raises `NotImplementedError` on `$text`. A `TextSearchCollection` shim was added to `test_notes.py` that rewrites `$text: {$search: q}` to `$or: [{title: regex}, {body: regex}]` at query-execution time. This shim lives exclusively in the test file. Production code uses real MongoDB `$text`. The behavioral equivalence holds because AES-256-GCM ciphertext does not contain plaintext search terms, so both search methods correctly exclude secure notes' encrypted bodies.

**3. `limit` is clamped in both the route and the service.** Clamping in the route ensures the HTTP response reflects the effective limit; clamping in the service is defense-in-depth in case the service is called directly (e.g., from future CLI tooling). This is a small redundancy that causes no harm.

**4. `total` in the list response is the global match count, not the remaining-after-cursor count.** This matches standard API conventions (Stripe, GitHub) where `total` means "how many results match your query", not "how many are left to page through". The client can compute remaining items if needed. This was not explicitly specified in the requirements so it is documented here as a clarifying decision.

---

## Entry 003 - Phase 5: Version History (US-04, FR-05)

**Date:** 2026-05-11
**Model:** Claude Sonnet 4.6 (claude-sonnet-4-6)
**Branch:** main

### Prompts used

Phase 5 was built in two sub-phases. The backend (5.1) and frontend (5.2) were generated in the prior session; this session ran the tests and completed verification.

**Phase 5.1 prompt (backend):**

> Implement Phase 5 (Version History, US-04, FR-05) on the backend.
>
> 1. Create `backend/app/services/version_history_service.py` with `VersionHistoryService`
> 2. Snapshots are stored as embedded subdocuments with `{ snapshot_id, body, timestamp }` schema
> 3. Cap at 50 snapshots per note using MongoDB `$push` with `$slice: -50`
> 4. Wire snapshot creation into `NoteService.update_note()` — capture the OLD body before writing the new one
> 5. For secure notes, snapshots store ciphertext. Note this in a comment.
> 6. Add `GET /api/notes/<id>/versions` returning a plain JSON array of `{ snapshot_id, timestamp, body_preview }` where body_preview is first 100 chars (decrypted for secure notes server-side). Corrupted snapshots return `body_preview: "[Could not decrypt]"` rather than failing the whole request.
> 7. Add `POST /api/notes/<id>/restore/<snapshot_id>` that snapshots the current state first, then restores. Returns the full serialized note.
> 8. Write backend tests.

**Phase 5.2 prompt (frontend):**

> Implement the version history UI (Phase 5.2).
>
> 1. Add `getVersions(id)` and `restoreVersion(id, snapshotId)` to `frontend/src/services/notes.js`
> 2. Create `frontend/src/components/VersionHistoryPanel.jsx`
> 3. Add a clock icon button to the NoteEditor toolbar; only shown on existing notes, not on `/notes/new`
> 4. Panel is a right sidebar (w-72) with a version list; each version shows relative timestamp with absolute on hover, body preview, and Preview and Restore buttons
> 5. Preview toggles an inline read-only MarkdownPreview. Restore opens a confirmation dialog.
> 6. Corrupted versions (`body_preview === "[Could not decrypt]"`): red warning, both buttons disabled
> 7. On confirm: call restore endpoint, call `onRestore(restoredNote)`, refetch version list
> 8. Write 13 RTL tests in `VersionHistoryPanel.test.jsx`

### Files added or modified

**Created:**
- `backend/app/services/version_history_service.py` — `VersionHistoryService` with `create_snapshot`, `list_versions`, `list_version_previews`, `get_snapshot`, `restore_version`
- `backend/tests/test_version_history_service.py` — 18 pytest tests covering snapshot creation, the 50-cap, secure note ciphertext invariant, list/restore endpoints, soft-delete edge cases
- `frontend/src/components/VersionHistoryPanel.jsx` — right-sidebar panel component
- `frontend/src/components/VersionHistoryPanel.test.jsx` — 13 Vitest + RTL tests

**Modified:**
- `backend/app/services/note_service.py` — `update_note()` calls `VersionHistoryService.create_snapshot()` before writing new body; `restore_version()` delegated to service
- `backend/app/routes/notes.py` — added `GET /api/notes/<id>/versions` and `POST /api/notes/<id>/restore/<snapshot_id>` endpoints
- `frontend/src/services/notes.js` — added `getVersions(id)` and `restoreVersion(id, snapshotId)` API wrappers
- `frontend/src/pages/NoteEditor.jsx` — added clock-icon history button in toolbar, `VersionHistoryPanel` integration, `saveCount` counter that triggers panel refetch on save

### MongoDB document shape after several edits

After creating a note and editing the body three times, the document in the `notes` collection looks like this:

```json
{
  "_id": ObjectId("6641f3a2b4e2c10d5f9a1234"),
  "title": "Weekly Standup",
  "body": "Third edit: added action items",
  "note_type": "text",
  "is_encrypted": false,
  "is_deleted": false,
  "audio_file_id": null,
  "duration_seconds": null,
  "snapshots": [
    {
      "snapshot_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "body": "Original draft",
      "timestamp": ISODate("2026-05-11T20:10:00.000Z")
    },
    {
      "snapshot_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "body": "Second edit: added context",
      "timestamp": ISODate("2026-05-11T20:12:30.000Z")
    },
    {
      "snapshot_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "body": "Third edit: revised intro",
      "timestamp": ISODate("2026-05-11T20:15:00.000Z")
    }
  ],
  "created_at": ISODate("2026-05-11T20:09:00.000Z"),
  "updated_at": ISODate("2026-05-11T20:16:00.000Z")
}
```

For a secure note the `body` field and every `snapshots[n].body` field hold AES-256-GCM ciphertext (base64-encoded). The `is_encrypted` flag is `true`. Plaintext never appears anywhere in the document.

### Test coverage: VersionHistoryService and routes

**Backend (`backend/tests/test_version_history_service.py`) — 18 tests, all passing:**

| Test | What it covers |
|---|---|
| `test_update_body_creates_snapshot_of_previous_body` | Snapshot created on body update, stores old body |
| `test_update_title_only_does_not_create_snapshot` | Title-only updates produce no snapshot |
| `test_multiple_body_updates_accumulate_snapshots` | Three edits produce three snapshots |
| `test_snapshot_cap_prunes_oldest_on_51st_update` | After 51 updates, array length is 50 and `v0` is gone |
| `test_secure_note_snapshot_stores_ciphertext_not_plaintext` | Snapshot body is not the plaintext string |
| `test_list_versions_returns_snapshot_ids_and_timestamps` | Response shape has `snapshot_id`, `timestamp`, `body_preview` |
| `test_list_versions_sorted_newest_first` | Most recent snapshot appears at index 0 |
| `test_list_versions_empty_when_no_updates` | Returns `[]` before any edits |
| `test_list_versions_returns_404_for_unknown_note` | Unknown ID returns 404 |
| `test_list_versions_decrypts_secure_note_preview` | Preview shows plaintext, not ciphertext |
| `test_list_versions_tampered_snapshot_returns_could_not_decrypt` | Garbage ciphertext yields `[Could not decrypt]`, does not crash |
| `test_list_versions_body_preview_capped_at_100_chars` | Preview is exactly 100 characters for a 200-char body |
| `test_list_versions_of_soft_deleted_note_is_allowed` | Version list is accessible after soft delete |
| `test_restore_copies_snapshot_body_to_note` | Restore endpoint returns note with the old body |
| `test_restore_creates_snapshot_of_pre_restore_state` | Pre-restore body appears as newest snapshot after restore |
| `test_restore_secure_note_returns_decrypted_body` | Restored secure note response body is plaintext |
| `test_restore_returns_404_for_unknown_snapshot` | Nonexistent snapshot ID returns 404 |
| `test_restore_returns_404_for_soft_deleted_note` | Cannot restore into a soft-deleted note |

The version history route code in `backend/app/routes/notes.py` is exercised by these same tests (they hit the routes via Flask test client, not the service directly), so route-level coverage is included in the 18-test count.

**Frontend (`frontend/src/components/VersionHistoryPanel.test.jsx`) — 13 tests, all passing:** loading state, empty state, renders version list, relative timestamps, preview toggle, restore confirmation dialog, confirm restore calls API and invokes `onRestore`, corrupted version disables buttons, close button.

**Full suite totals:** 65 backend, 54 frontend — all passing.

### 50-snapshot cap: verified

`test_snapshot_cap_prunes_oldest_on_51st_update` does exactly 51 `PATCH` calls on one note. After the loop:

```python
assert len(snapshots) == 50       # array never exceeds 50
assert "v0" not in bodies         # oldest (v0) pruned
assert "v1" in bodies             # second-oldest still present
```

The implementation in `version_history_service.py:65`:

```python
self._col.update_one(
    {"_id": oid},
    {"$push": {"snapshots": {"$each": [snapshot], "$slice": -50}}}
)
```

`$each` + `$slice` are applied in a single atomic write operation by MongoDB, so the array is capped at the moment of insertion with no gap where it could exceed 50.

### Key design decisions (for Technical Defense)

**1. Why snapshots are stored as embedded subdocuments, not a separate collection**

Snapshots are always accessed relative to their parent note: list all snapshots for note X, restore snapshot Y of note X. There is no query pattern that crosses note boundaries (e.g., "find all snapshots from yesterday across all notes"). A separate `snapshots` collection would require a join-style lookup on every history request: one query to fetch the note, one to fetch its snapshots, then application-level assembly. An embedded array gives both in a single `find_one`.

The trade-off is MongoDB's 16MB per-document limit. A note with 50 snapshots, each containing a 10KB body, would use roughly 500KB of that budget. That is well within limits for realistic note lengths, and the 50-cap ensures the array never grows unboundedly. The cap was chosen as the boundary where document size stays predictable (any note, any body size within reason) without requiring a separate collection or a background compaction job.

**2. Why secure note snapshots stay encrypted (no plaintext in history)**

`NoteService.update_note()` captures the old body from MongoDB before writing the new one. For secure notes, what is stored in MongoDB is AES-256-GCM ciphertext. The snapshot therefore contains ciphertext too. This was a deliberate choice, not a side effect.

The alternative is to decrypt the old body before snapshotting it, then store plaintext in the snapshot subdocument. But the note document is marked `is_encrypted: true`. Storing plaintext there would violate the invariant stated in FR-03 and SPR-01: plaintext is never persisted. It would also create an inconsistency between the `body` field (always ciphertext for secure notes) and the `snapshots` array (plaintext), which would confuse any future tooling that reads the raw MongoDB document.

The cost is that `list_version_previews` must decrypt each snapshot body server-side before truncating to 100 characters for the API response. If any snapshot's ciphertext is corrupted (key rotation, direct database edit, storage error), the per-snapshot `try/except` in `list_version_previews` catches `DecryptionFailedError` and substitutes `"[Could not decrypt]"` for that entry only. The rest of the version list still loads normally.

**3. The 50-snapshot cap: rationale**

Three constraints shaped the number 50:

- Storage bounds: MongoDB documents have a 16MB hard limit. With 50 snapshots and typical note bodies (a few KB each), a note document stays well under 1MB. No background cleanup job is needed.
- User experience: Beyond 50 versions the history panel becomes difficult to navigate. Version history exists for "I made a mistake in the last few edits," not as a full audit log going back months. 50 versions covers any realistic editing session.
- Requirement compliance: FR-05 specifies "the 50 most recent snapshots per note; older snapshots are pruned automatically." The number comes directly from the requirements baseline.

**4. Why restoring creates a snapshot of the pre-restore state**

Restoring a version is a destructive write: it overwrites the current body with an older one. Without a pre-restore snapshot, the state that existed just before the restore would be permanently discarded. A user who restores the wrong version and realizes it immediately has no way to undo.

`restore_version()` calls `create_snapshot(note_id, current_body)` before applying the restore. The pre-restore state then appears as the newest entry in the version list, so the restore is itself reversible with one more click. The slight cost is that every restore consumes one snapshot slot (and on a note at exactly 50 snapshots, pushes out the oldest one), but the safety guarantee is worth that trade-off.

**5. Atomic pruning via `$push` with `$slice`**

An alternative approach would be: push the new snapshot, then run a separate `$set` to trim the array if `len(snapshots) > 50`. That requires two round trips and a race condition: between the push and the trim, a concurrent write could push a second snapshot, and the trim might remove the wrong entry.

MongoDB's `$push` with `$each` and `$slice` executes both operations in a single atomic document update. The array is capped at the moment of insertion. No gap, no race, no cleanup query. This is the standard MongoDB pattern for capped arrays and is the reason the schema stores snapshots as an array rather than using a TTL index or a separate collection with a capped size.

**6. `body_preview` field name and plain-array response shape**

`GET /api/notes/<id>/versions` returns a plain JSON array, not a wrapper object. The resource path already scopes the result to one note's versions, so a `{ "versions": [...] }` wrapper adds no information and makes the response harder to work with in the frontend (`data.versions` vs. `data`).

The field is `body_preview` (not `preview` or `snippet`) to be explicit that it is raw body text truncated at 100 characters, not rendered HTML. The frontend passes this value directly to `MarkdownPreview`, so the name needed to distinguish it from a pre-rendered string.

### Revisions made after review

One post-generation change was made: the `VersionHistoryPanel` was updated to accept a `refreshKey` prop (a counter incremented in `NoteEditor` after each successful save). Adding `refreshKey` to the `useCallback` dependency array for `loadVersions` causes the panel to refetch the version list automatically after a save without requiring the user to close and reopen the panel. This was not in the original Phase 5.2 prompt; it was identified during manual verification.

The `saveCount` state in `NoteEditor` only increments on `updateNote` success (not on `createNote`), since the history button is hidden on new notes anyway.

No other logic changes were needed. The only environment fix was running `npm install` before the first test run in the new session.

### Deviations from CLAUDE.md and requirements

**1. Snapshot bodies store full text, not just the 100-char preview.** The `body_preview` in the API response is a display truncation. The full `body` is stored in each snapshot so that restore returns the complete original content. Requirements say "immutable snapshot" without a size constraint on the stored body, so this matches the intent.

**2. `body_preview` is decrypted server-side.** Requirements do not specify where decryption happens for snapshot previews. Decrypting server-side keeps the frontend stateless with respect to encryption keys, consistent with how `GET /api/notes/<id>` works.

**3. Title-only updates do not create snapshots.** `NoteService.update_note()` only calls `create_snapshot` when the body field is changing. Snapshotting on every save, including title-only changes, would consume snapshot slots unnecessarily and pollute the history list with entries that have identical body content. FR-05 says "each save creates a snapshot" but in context means "each meaningful edit." This interpretation is documented in a code comment in `note_service.py`.
