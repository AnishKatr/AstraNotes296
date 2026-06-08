# CLAUDE.md

This file provides project context and conventions for AI code generation tools (Claude Code, GitHub Copilot, etc.) working on the AstraNotes codebase.

---

## Project Overview

**AstraNotes** is a web-based, multi-user note-taking application built for the CSEN 296B-2 (AI-Driven Software Development) graduate course. It supports three note types through a plugin architecture: Text, Voice, and Secure (encrypted). The app runs locally during development with a local MongoDB instance and is designed to scale to multi-user web deployment later.

The core value proposition is a clean Markdown-first editor with optional encryption for sensitive notes and version history for safety.

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 18 + Vite | TypeScript optional, plain JS is fine for this project |
| Frontend Routing | React Router v6 | |
| Frontend Styling | Tailwind CSS + shadcn/ui | shadcn/ui components in `src/components/ui/`; `@tailwindcss/typography` for Markdown prose |
| Design System | shadcn/ui + Radix UI | CSS variable token system; `darkMode: ['class']` in Tailwind config |
| Backend | Python 3.11+ / Flask | REST API only, no server-side rendering |
| Backend ORM/ODM | PyMongo (direct driver) | No ORM layer; keep it simple |
| Database | MongoDB (local for dev) | GridFS for voice note audio files |
| Encryption | `cryptography` library (AES-256) | Keys loaded from environment variables |
| Backend Tests | pytest | |
| Frontend Tests | React Testing Library + Vitest | |
| Linting | ESLint (frontend), flake8 (backend) | |

Do not add dependencies that are not on this list without explicit approval.

---

## Repo Structure (Monorepo)

```
AstraNotes/
├── backend/
│   ├── routes/          # Controller layer: Flask blueprints, HTTP endpoints
│   ├── services/        # Business logic: NoteService, EncryptionService, VersionHistoryService, AudioService, PluginRegistry
│   ├── models/          # Data models: Note, TextNote, VoiceNote, SecureNote, NoteSnapshot
│   ├── config.py        # Environment config, MongoDB connection
│   ├── app.py           # Flask app factory
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/  # Reusable React components (including ui/ shadcn primitives)
│   │   │   └── ui/      # shadcn/ui generated components (excluded from coverage)
│   │   ├── lib/         # Utility functions (tagColor.js, exportNote.js, utils.js; excluded from coverage)
│   │   ├── pages/       # Route-level views
│   │   ├── services/    # API client functions (fetch wrappers)
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
├── planning/            # Project artifacts
│   ├── requirements.md
│   ├── user-stories.md
│   ├── backlog.md
│   ├── sprint-zero-plan.md
│   ├── design-document.md
│   ├── traceability-matrix.md
│   ├── decision-log.md
│   └── enhancements.md  # Post-baseline features (tags, trash, export, dark mode, UI redesign)
└── README.md
```

**Note on placement:** This CLAUDE.md lives at the repo root for Claude Code auto-detection. A copy may also exist in `planning/`.

---

## Architecture Rules

1. **MVC separation is strict.** Routes never contain business logic. Services never touch HTTP request/response objects. Models never call services.
2. **Plugin pattern for note types.** All three note types (Text, Voice, Secure) register through `PluginRegistry`. Adding a new note type means writing a handler and registering it, never modifying core logic.
3. **Services are stateless.** They take inputs, return outputs, and read/write through the data layer. No singletons that hold state in memory.
4. **MongoDB is the source of truth.** No in-memory caches that could go stale.
5. **Fail fast on misconfiguration.** Missing encryption keys, missing MongoDB connection strings, or missing required env vars should crash the app at startup with a clear error, never silently default.

---

## MongoDB Schema

**Collection: `notes`**
```javascript
{
  _id: ObjectId,
  title: String,
  body: String,                  // raw text/markdown OR ciphertext for secure notes
  note_type: "text" | "voice" | "secure",
  is_encrypted: Boolean,
  deleted: Boolean,              // soft delete flag (field name is "deleted", not "is_deleted")
  deleted_at: ISODate | null,    // set when soft-deleted; null on active notes
  audio_file_id: ObjectId | null, // GridFS reference for voice notes
  duration_seconds: Number | null,
  tags: [String],                // normalized (trimmed, lowercased, deduped); max 10, max 30 chars each
  snapshots: [                   // embedded subdocuments, max 50 per note
    { snapshot_id: String, body: String, timestamp: ISODate }
  ],
  created_at: ISODate,
  updated_at: ISODate
}
```

**Indexes (required):**
- `{ title: "text", body: "text" }` (weighted: title=10, body=1) for full-text search
- `{ note_type: 1 }` for type filtering
- `{ updated_at: -1 }` for sorted listing
- `{ deleted: 1 }` for soft-delete filtering
- `{ tags: 1 }` for tag filtering
- `{ deleted_at: -1 }` for trash listing (sorted by most recently deleted)

**GridFS bucket: `audio_files`** for voice note recordings.

---

## API Conventions

- Base path: `/api`
- Versioning: not needed for this project
- Authentication: not implemented in early phases; add JWT or session auth when multi-user lands
- All responses are JSON
- Standard error format:
  ```json
  { "error": "human-readable message", "code": "ERROR_CODE" }
  ```
- Standard HTTP codes: 200, 201, 400 (validation), 403 (auth/encryption fail), 404 (not found), 415 (bad upload format), 500 (server)

**Endpoint pattern:**
- `GET /api/notes` (list, paginated; supports `?type=`, `?q=`, `?tag=` query params)
- `POST /api/notes` (create; accepts `tags` array in body)
- `GET /api/notes/<id>`
- `PATCH /api/notes/<id>` (update, creates snapshot; accepts `tags` array in body)
- `DELETE /api/notes/<id>` (soft delete; sets `deleted=true` and `deleted_at`)
- `GET /api/notes/<id>/versions` (list snapshots)
- `POST /api/notes/<id>/restore/<snapshot_id>` (restore version from history)
- `POST /api/notes/<id>/restore` (restore note from trash)
- `DELETE /api/notes/<id>/permanent` (permanently delete; cleans up GridFS audio for voice notes)
- `POST /api/notes/<id>/audio` (upload audio for voice note)
- `GET /api/notes/<id>/audio` (stream audio bytes)
- `GET /api/tags` (list all tags with counts; excludes deleted notes)
- `GET /api/trash` (list soft-deleted notes, sorted by `deleted_at` descending)
- `DELETE /api/trash` (empty trash: permanently delete all soft-deleted notes with GridFS cleanup)

---

## Coding Conventions

**Python (backend):**
- Snake_case for functions, variables, files
- PascalCase for classes
- Type hints on all public function signatures
- Docstrings on all public classes and functions (one-line minimum)
- Raise specific exceptions, never bare `except:`
- All env vars accessed via `config.py`, never `os.getenv()` scattered through code

**JavaScript/React (frontend):**
- camelCase for functions and variables
- PascalCase for components
- One component per file, file named after the component
- Functional components with hooks only, no class components
- API calls live in `frontend/src/services/`, never inline in components

**Both:**
- Keep functions under 40 lines when reasonable
- Early returns over nested ifs
- No magic numbers; use named constants
- No `// TODO` without an associated GitHub issue number

---

## Testing Approach

- Backend: pytest with `pytest-mongo` for integration tests against a test database
- Frontend: React Testing Library with Vitest, focus on user behavior over implementation details
- Target: 80% line coverage on backend services
- Tests live in `tests/` mirroring the source structure (`tests/backend/services/test_note_service.py`)
- Tests are written alongside features, not deferred to the end

---

## Implementation Complete

All nine phases are done. The codebase is feature-complete against the requirements baseline (FR-01 through FR-07, SPR-01 through SPR-03, NFR-01 through NFR-02) and includes three post-baseline enhancement phases (design system, UI shell redesign, and tags/trash/export). Test totals as of project completion: **133 backend tests (pytest), 143 frontend tests (Vitest)**, all passing. No requirements are unimplemented; no planned phase is deferred. The decision log (`planning/decision-log.md`) contains the full rationale for each phase's key design choices. Post-baseline enhancements are documented in `planning/enhancements.md`.

---

## Phase Plan

The project is organized into nine implementation phases. Phases 1-6 map directly to the graded requirements baseline. Phases 7-9 are post-baseline enhancements. All phases are complete.

### Phase 1 (COMPLETE): Foundation + CRUD Notes (US-01)
**Goal:** Repo scaffolded, MongoDB connected, basic text note CRUD working end-to-end.
- Set up monorepo structure (`backend/`, `frontend/`, `tests/`, `planning/`)
- Set up Flask app factory with config from environment
- Connect to local MongoDB
- Implement `Note` model and `NoteService` with create, get, update, soft-delete, list
- Implement `routes/notes.py` with REST endpoints
- Build minimal React UI: note list view, note editor, save button
- Soft-delete behavior: deleted notes have `is_deleted: true`, excluded from list queries by default
- Empty title returns 400 with validation error

### Phase 2: Markdown Rendering (US-06)
- Add Markdown parser to React frontend (e.g., `react-markdown`)
- Live preview pane next to the editor
- Persist raw Markdown in MongoDB; rendering is client-side only

### Phase 3: Secure Notes + Encryption (US-02, SPR-01)
- Implement `EncryptionService` using AES-256 with keys from env
- Add `SecureNote` plugin handler that encrypts before save and decrypts on read
- App fails fast at startup if encryption key env var is missing
- Frontend: "Mark as Secure" toggle in the editor
- Failed decryption returns 403 with error, never garbled content

### Phase 4: Search and Filter (US-05)
- Backend: `GET /api/notes?q=<query>&type=<type>` with cursor pagination (default 50); search uses MongoDB `$text/$search` against a weighted text index (title=10, body=1); full words only, no substring matching (see Entry 006 in decision log for the switch from `$regex`)
- Frontend: search bar with real-time filtering
- Invalid type values return 400

### Phase 5: Version History (US-04)
- Implement `VersionHistoryService` with snapshot creation on every save
- Snapshots stored as embedded subdocuments, capped at 50 per note (oldest pruned)
- Backend endpoints for listing and restoring versions
- Frontend: history panel in note view with timestamp list

### Phase 6 (COMPLETE): Voice Notes (US-03)
- Frontend: record button using browser MediaRecorder API
- Upload to backend with format validation (webm or wav only, 10MB limit)
- Store audio in GridFS, link via `audio_file_id`
- Playback in note detail view

**Audio upload flow (two steps):**

1. Create the voice note first: `POST /api/notes` with `note_type="voice"`. The response includes `audio_file_id: null` until audio is attached.
2. Upload audio: `POST /api/notes/<id>/audio` with `multipart/form-data`, field name `audio`. The file must have a `.webm` or `.wav` extension; format is validated by extension. Size is enforced by Flask's `MAX_CONTENT_LENGTH` (10 MB in production); exceeding it returns 413 with code `AUDIO_TOO_LARGE`.

**Backend components:**
- `app/services/audio_service.py`: `AudioService` handles GridFS put/get and note document updates. Takes `db` and a `gridfs.GridFS` bucket; instantiated per-request in the route layer, same pattern as `VersionHistoryService`.
- `app/routes/notes.py`: `POST /<id>/audio` validates extension and delegates to `AudioService.store()`; `GET /<id>/audio` delegates to `AudioService.fetch()` and streams bytes with the correct MIME type.
- GridFS bucket registered in `app.extensions["gridfs_bucket"]` at startup (collection name: `audio_files`).
- A custom `RequestEntityTooLarge` error handler registered on the app returns the JSON 413 response.

**Rejected formats return 415 with code `UNSUPPORTED_AUDIO_FORMAT`.** Uploading to a non-voice note returns 400 with code `WRONG_NOTE_TYPE`. Soft-deleted voice notes return 404 for both upload and audio stream.

**Audio binary data does not flow through the plugin handler system.** Plugin handlers (`transform_write` / `transform_read`) operate on text bodies only. Binary audio is stored separately in GridFS and linked to the note via `audio_file_id`.

### Phase 7 (COMPLETE): Design System Foundation (post-baseline)
- Installed and configured shadcn/ui with manual init (no CLI)
- Set up `@/` path alias in vite.config.js and jsconfig.json
- Defined light/dark CSS variable token sets in index.css (HSL without `hsl()` wrapper, Tailwind convention)
- Built `ThemeProvider` supporting light/dark/system modes with localStorage persistence
- Built `ThemeToggle` component cycling light/dark/system
- Installed 10 shadcn/ui components: button, input, textarea, card, badge, separator, scroll-area, tooltip, dialog, dropdown-menu
- `src/components/ui/` and `src/lib/` excluded from coverage thresholds

### Phase 8 (COMPLETE): Shell Redesign (post-baseline)
- Replaced ad-hoc layout with three-pane `AppShell` (Outlet) + `NotesLayout` (NoteList + Outlet) + editor
- Built `Sidebar` with All notes, Trash, Settings nav, note count badge, mobile hamburger drawer
- Built `EmptyEditorPane`, `SettingsPage` placeholder, `TrashPage` placeholder
- Migrated all UI to shadcn/ui components (Button, Input, Textarea, Badge, Card, Dialog, DropdownMenu)
- Mobile responsive: single-pane switching via `hidden md:flex` / `flex w-full md:w-56` CSS
- `useMatch('/notes/:id')` in NotesLayout to detect active note and control pane visibility

### Phase 9 (COMPLETE): Tags, Trash, Export (post-baseline)
**Tags (full-stack):**
- Backend: `validate_tags()` in NoteService (trim/lowercase/dedup, max 10 tags, max 30 chars each); `list_tags()` via MongoDB aggregation; `?tag=` filter on list endpoint; `tags` index
- New blueprint: `GET /api/tags`
- Frontend: `TagChip.jsx`, `TagEditor.jsx` (autocomplete from real tags list), `tagColor.js` (djb2 hash, 10-color stable palette); Sidebar fetches real tags list; NoteList reads `?tag=` from `useSearchParams()`

**Trash management (full-stack):**
- Backend: `list_trash()`, `restore_note()`, `permanent_delete()` (returns doc for GridFS cleanup), `empty_trash()`; `deleted_at` timestamp added to soft-delete; new trash blueprint
- `AudioService.delete_audio()` added for GridFS cleanup on permanent delete
- Frontend: full `TrashPage` with per-row Restore and Delete permanently buttons, shadcn Dialog confirmations, Empty trash action, trash count badge in Sidebar

**Export (frontend only):**
- `exportMarkdown(title, body)` in `src/lib/exportNote.js`: Blob download via temporary anchor, title as H1 prefix
- `exportPdf(title, bodyHtml)`: `window.open` + `document.write` + `print()`, no new dependencies
- Export dropdown in NoteEditor toolbar (only for existing notes): uses `previewRef` on the preview div to capture rendered HTML for PDF

---

## Working with AI Tools

This project requires AI usage to be reviewed and logged per the Working Agreement. When generating code:
- AI output is acceptable only if it compiles, runs, aligns with the architecture above, and adds no unapproved dependencies
- Any AI-generated code is logged in the decision log (`planning/decision-log.md`) with the prompt, key output, and revisions made
- Do not accept the first AI suggestion blindly; ask for refactoring or simplification if the output is overengineered
- The Definition of Done requires the developer to be able to explain any code that is committed, AI-generated or not

---

## Style Preferences for Generated Content

When AI generates documentation, comments, or written explanations for this project:
- No em dashes. Use commas, periods, or parentheses instead.
- No filler bold or unnecessary headers in prose
- Natural first-person student-register writing, not corporate or executive tone
- Concise over verbose; if a doc can be one page, make it one page

---

## Reference Documents

### Always-loaded context (imported)
@planning/requirements.md
@planning/user-stories.md
@planning/design-document.md

### On-demand documents (read when relevant)
- `planning/backlog.md` - read when prioritizing work or deciding what to build next
- `planning/sprint-zero-plan.md` - read only when setting up the repo from scratch
- `planning/traceability-matrix.md` - read when adding a new requirement or auditing if a feature has design coverage
- `planning/working-agreement.md` - read when establishing AI workflow or process questions arise
- `planning/definition-of-done.md` - read before merging a PR or marking a task complete

---

## Out of Scope (Do Not Generate)

- Cloud deployment configurations (AWS, GCP, Heroku, Vercel) until later phases
- User authentication (JWT, OAuth, sessions) until the multi-user transition
- Real-time collaboration features (WebSockets, CRDTs)
- Mobile app code (React Native, Flutter)
- Telemetry or analytics
- Any third-party data sharing

If a request seems to require any of the above, flag it instead of generating it.
