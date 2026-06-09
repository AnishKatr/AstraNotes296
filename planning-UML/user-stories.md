# AstraNotes User Stories

Each user story includes acceptance criteria and traces back to one or more requirements in `requirements.md`.

## US-01: CRUD Notes

**Maps to:** FR-01

**As a user, I want to create, view, edit, and delete text notes so that I can manage my ideas.**

Acceptance Criteria:
1. A new note can be created with a title and body.
2. Notes appear in a list view sorted by last modified.
3. Edits persist after page refresh.
4. Deleted notes no longer appear in the list (soft-deleted).

## US-02: Secure Notes

**Maps to:** FR-03, SPR-01

**As a user, I want to mark a note as Secure so that its content is encrypted and private.**

Acceptance Criteria:
1. A toggle marks a note as Secure before saving.
2. Secure note body is stored encrypted (AES-256) in MongoDB.
3. Decrypted content displays only after authentication.
4. Unencrypted body text is never visible in the database.

## US-03: Voice Notes

**Maps to:** FR-04

**As a user, I want to record and attach a voice memo to a note so that I can capture ideas hands-free.**

Acceptance Criteria:
1. A record button starts audio capture via browser MediaRecorder.
2. The recording uploads to Flask and stores in MongoDB GridFS.
3. The voice note plays back from the note detail view.

## US-04: Version History

**Maps to:** FR-05

**As a user, I want to view the version history of a note so that I can restore a previous version.**

Acceptance Criteria:
1. Each save creates a snapshot stored as a subdocument.
2. A history panel lists all previous versions with timestamps.
3. Selecting a version restores its content to the editor.

## US-05: Search and Filter

**Maps to:** FR-06

**As a user, I want to search notes by title or content so that I can quickly find what I need.**

Acceptance Criteria:
1. A search bar filters notes in real time.
2. Results match against title and body using MongoDB text index.
3. A type filter narrows results to Text, Voice, or Secure.

## US-06: Markdown Rendering

**Maps to:** FR-07

**As a user, I want to write notes in Markdown so that I can format text without a rich editor.**

Acceptance Criteria:
1. The editor accepts Markdown syntax.
2. A preview pane renders Markdown to HTML in real time.
3. Saved Markdown renders correctly when reopened.
