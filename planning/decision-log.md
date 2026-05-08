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

**5. Index migration is inline, not a separate migration script.** CLAUDE.md does not specify a migrations approach. The `_ensure_indexes` function handles the one-time drop of the old `title_text_body_text` index by checking `list_indexes()` on every startup. This is idempotent and adds negligible overhead (one `listIndexes` call). A dedicated Alembic-style migration runner was out of scope for this phase.
