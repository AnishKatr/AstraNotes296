# Requirements-to-UML Traceability Matrix

## Matrix

| ID | Requirement | Class/Object Evidence | Use Case/Activity Evidence | Deployment Evidence | Status | Gap Note |
|---|---|---|---|---|---|---|
| FR-01 | CRUD Notes (soft delete) | Note base class with save(), delete(), to_dict(). NoteService with create/get/update/delete. Object diagram shows text_note_1. | Use case: Create, View, Edit, Delete Note. Activity diagram shows create flow. | MongoDB notes collection. Flask routes/. | Fully Traced | Soft-delete and empty-title validation are in refined requirements but not modeled in activity diagram. Acceptable since the activity diagram focuses on secure note creation. |
| FR-02 | Plugin-Based Note Types | PluginRegistry class with register, create, get_handler. Class diagram shows handler relationships. Object diagram shows registry with three handlers. | Use case: Create Note includes Register via PluginRegistry. Activity diagram: validation step. | PluginRegistry runs in Flask services/. | Fully Traced | No gap. |
| FR-03 | Secure (Encrypted) Notes | SecureNote extends Note with encrypted_body, encrypt(), decrypt(). EncryptionService with AES-256. Object diagram: secure_note_1 with ciphertext. | Use case: Mark Note as Secure includes Encrypt via EncryptionService. Activity diagram models the full secure note creation with encryption key decision branch. | Encrypted data in MongoDB. | Fully Traced | No gap. Best-traced requirement. |
| FR-04 | Voice Notes (10MB, webm/wav) | VoiceNote extends Note with audio_file_id, duration. AudioService with GridFS put/get. Object diagram: voice_note_1 with gfs_001. | Use case: Record Voice Memo. Implementation: POST /<id>/audio with extension validation (415 for unsupported format, 413 for >10MB); GET /<id>/audio streams bytes. 17 backend tests and 9 frontend tests cover upload, format rejection, size rejection, streaming, and soft-delete guard. | GridFS audio_files bucket in MongoDB; audio_file_id ObjectId on note document. Flask MAX_CONTENT_LENGTH enforces 10MB limit at framework level. | Fully Traced | No activity diagram for the upload flow, but upload behavior, format validation, and size limit all have implementation and test evidence. |
| FR-05 | Version History (50 cap) | VersionHistoryService with create/list/restore. NoteSnapshot class. 1..* snapshots relationship. Object diagram: snapshot_1. | Use case: View Version History, Restore Version. Edit Note includes Create Snapshot. Activity diagram: snapshot step. | Snapshots as subdocuments in MongoDB. | Fully Traced | No gap. Pruning is not modeled but is implementation detail. |
| FR-06 | Search and Filter | NoteService with search_notes() and list_notes(). | Use case: Search Notes, Filter by Type. | $text/$search against notes_text_search index (title: 10, body: 1); full-word/token matching; secure note bodies are ciphertext so body search only matches by title. | Partially Traced | No activity or sequence diagram for search flow. Pagination and invalid filter handling have no behavioral evidence. |
| FR-07 | Markdown Rendering | No class in diagram represents Markdown rendering (frontend concern). | Use case: Render Markdown Preview. | React SPA in Client Browser. | Weakly Traced | Only a use case. No class or activity diagram. Defensible since rendering is a frontend library call. |
| NFR-01 | Performance at Scale (p95 < 2s at 1,000+ notes) | NoteService.list_notes() with MongoDB indexes on updated_at, note_type, and notes_text_search text index. | Validated empirically: 50-run measurement on 1,500-note dataset via scripts/measure_list_perf.py. | MongoDB indexes created at app startup by _ensure_indexes(). | Fully Traced | All five scenarios (unfiltered list, type filter, text search, search+filter, cursor page 2) pass with p95 well under 100ms. See decision log Entry 006 for exact numbers. |
| SPR-01 | Encryption at Rest (fail-fast) | EncryptionService with AES-256, keys from env. SecureNote depends on EncryptionService. | Activity diagram: encryption key decision branch. "No" path logs error and ends in failure. | Keys loaded from environment on Flask server. | Fully Traced | No gap. Only explicitly modeled error path. |

## Metrics

| Metric | Value |
|---|---|
| Total requirements reviewed | 9 |
| Fully Traced | 7 (FR-01, FR-02, FR-03, FR-04, FR-05, NFR-01, SPR-01) |
| Partially Traced | 1 (FR-06) |
| Weakly Traced | 1 (FR-07) |
| Not Traced | 0 |
| Major UML elements without a clear requirement reason | 0 |

## Gap Analysis

Seven of nine requirements are fully traced with structural, behavioral, and deployment evidence. One is partially traced and one is weakly traced.

NFR-01 (performance at scale) is now fully traced with empirical evidence: 50-run latency measurements on a 1,500-note dataset show p95 under 15ms for all five scenarios (unfiltered list, type filter, text search, search + type filter, cursor pagination). The text index switch from `$regex` was the key change that ensures the 2-second guarantee holds as the collection grows, since `$regex` performs a collection scan. See decision log Entry 006.

The remaining gap is missing behavioral diagrams for search and filter (FR-06). The flow has class-level and use-case-level support but no activity or sequence diagram. Pagination and invalid filter handling are tested but not modeled. This is the only open gap.

Markdown rendering (FR-07) is a client-side concern handled by a React library with no backend class representation. This is architecturally correct; only a use case traces it. Adding a frontend component diagram would close this gap but is not required.

No UML element exists without a requirement justification. There are no overdesigned or orphan elements in the current package.
