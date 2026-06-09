# AstraNotes Requirements Baseline

## Project Context

AstraNotes is a web-based, multi-user note-taking application built with a React (Vite) frontend and Python/Flask REST API backend, using MongoDB for data storage. The architecture follows MVC with a plugin system for extensible note types (Text, Voice, Secure).

Total: 12 requirements. 7 functional, 2 non-functional, 3 security/privacy/reliability.

## Functional Requirements

### FR-01: CRUD Notes (with soft delete)

Users can create, view, edit, and delete text notes. Each note has a unique ID, title, body, created_at, and updated_at timestamp. Creating a note with an empty title returns a 400 error. Deleted notes are soft-deleted (flagged, not removed) to support future recovery.

### FR-02: Plugin-Based Note Types

The backend supports Text, Voice, and Secure note types via a PluginRegistry. Each type has a registered handler. Attempting to create a note with an unregistered type returns a 400 error.

### FR-03: Secure (Encrypted) Notes

A note marked Secure is encrypted (AES-256) before storage. The encrypted body is stored in MongoDB; plaintext is never persisted. Decryption requires authentication. If decryption fails (wrong key or corrupted data), the API returns a 403 with a clear error message rather than serving garbled content.

### FR-04: Voice Notes

Users record audio via the browser MediaRecorder API. Uploads are limited to 10 MB and must be in webm or wav format; other formats are rejected with a 415 error. Audio is stored in MongoDB GridFS and linked to a VoiceNote document.

### FR-05: Version History

Each save creates an immutable snapshot as a subdocument. Users can list and restore previous versions. The system retains the 50 most recent snapshots per note; older snapshots are pruned automatically.

### FR-06: Search and Filter

Users search by title or body content using a MongoDB text index. Results are paginated (default 50). An empty query returns all notes. Filters accept one type at a time (Text, Voice, or Secure); invalid type values return a 400 error.

### FR-07: Markdown Rendering

The React frontend renders Markdown to HTML in real time. Raw Markdown is stored in MongoDB; rendering is client-side only. Unsupported or malformed Markdown degrades gracefully (displays as plain text, no crash).

## Non-Functional Requirements

### NFR-01: Performance at Scale

The note list endpoint returns 50 paginated results within 2 seconds under a dataset of 1,000+ notes. MongoDB indexes are required on title, type, and updated_at fields.

### NFR-02: Cross-Platform Compatibility

The frontend renders correctly on Chrome, Firefox, Safari, and Edge (latest two versions). MediaRecorder is required for voice notes; browsers without support show a disabled record button with a tooltip.

## Security, Privacy, and Reliability Requirements

### SPR-01: Encryption at Rest

Secure note bodies are encrypted with AES-256 via EncryptionService. Keys are loaded from environment variables at startup; missing keys cause the app to fail fast with a logged error rather than running without encryption.

### SPR-02: No External Data Sharing

No note content is sent to any external service. No analytics or telemetry is included. All data stays within the app's MongoDB instance.

### SPR-03: Test Coverage

Backend services have pytest tests at 80%+ line coverage. Frontend components have React Testing Library tests. All tests must pass before a PR is merged.

## Ambiguity Review

| Original Wording | Problem | Resolution |
|---|---|---|
| "Users can delete notes" | Unclear if deletion is permanent or recoverable | Changed to soft-delete (flagged, not removed) to support future recovery (FR-01) |
| "Secure note body is encrypted" | No behavior defined for decryption failure | Added: failed decryption returns 403 with error message, never garbled content (FR-03) |
| "Voice notes are uploaded" | No file size or format constraints | Added: 10 MB limit, webm/wav only, 415 error for invalid formats (FR-04) |
| "Version history stores snapshots" | No retention limit; unbounded storage growth | Added: 50-snapshot cap per note with automatic pruning (FR-05) |

## Edge-Case Review

| Scenario | Expected Behavior |
|---|---|
| Create note with empty title | API returns 400 with validation error (FR-01) |
| Create note with unregistered plugin type | API returns 400; PluginRegistry rejects unknown types (FR-02) |
| Encryption key missing from environment | App fails fast at startup with a logged error; does not run unencrypted (SPR-01) |
| Search with invalid type filter value | API returns 400 rather than an empty result set (FR-06) |
| Browser does not support MediaRecorder | Record button is disabled with a tooltip explaining the limitation (NFR-02) |
