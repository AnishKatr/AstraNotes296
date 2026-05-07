# Requirements-to-UML Traceability Matrix

## Matrix

| ID | Requirement | Class/Object Evidence | Use Case/Activity Evidence | Deployment Evidence | Status | Gap Note |
|---|---|---|---|---|---|---|
| FR-01 | CRUD Notes (soft delete) | Note base class with save(), delete(), to_dict(). NoteService with create/get/update/delete. Object diagram shows text_note_1. | Use case: Create, View, Edit, Delete Note. Activity diagram shows create flow. | MongoDB notes collection. Flask routes/. | Fully Traced | Soft-delete and empty-title validation are in refined requirements but not modeled in activity diagram. Acceptable since the activity diagram focuses on secure note creation. |
| FR-02 | Plugin-Based Note Types | PluginRegistry class with register, create, get_handler. Class diagram shows handler relationships. Object diagram shows registry with three handlers. | Use case: Create Note includes Register via PluginRegistry. Activity diagram: validation step. | PluginRegistry runs in Flask services/. | Fully Traced | No gap. |
| FR-03 | Secure (Encrypted) Notes | SecureNote extends Note with encrypted_body, encrypt(), decrypt(). EncryptionService with AES-256. Object diagram: secure_note_1 with ciphertext. | Use case: Mark Note as Secure includes Encrypt via EncryptionService. Activity diagram models the full secure note creation with encryption key decision branch. | Encrypted data in MongoDB. | Fully Traced | No gap. Best-traced requirement. |
| FR-04 | Voice Notes (10MB, webm/wav) | VoiceNote extends Note with audio_file_id, duration. Object diagram: voice_note_1 with gfs_001. | Use case: Record Voice Memo. | GridFS for audio files in MongoDB. | Partially Traced | No activity diagram models voice upload flow. 10MB limit and format validation have no behavioral evidence. |
| FR-05 | Version History (50 cap) | VersionHistoryService with create/list/restore. NoteSnapshot class. 1..* snapshots relationship. Object diagram: snapshot_1. | Use case: View Version History, Restore Version. Edit Note includes Create Snapshot. Activity diagram: snapshot step. | Snapshots as subdocuments in MongoDB. | Fully Traced | No gap. Pruning is not modeled but is implementation detail. |
| FR-06 | Search and Filter | NoteService with search_notes() and list_notes(). | Use case: Search Notes, Filter by Type. | MongoDB text index implied. | Partially Traced | No activity or sequence diagram for search flow. Pagination and invalid filter handling have no behavioral evidence. |
| FR-07 | Markdown Rendering | No class in diagram represents Markdown rendering (frontend concern). | Use case: Render Markdown Preview. | React SPA in Client Browser. | Weakly Traced | Only a use case. No class or activity diagram. Defensible since rendering is a frontend library call. |
| SPR-01 | Encryption at Rest (fail-fast) | EncryptionService with AES-256, keys from env. SecureNote depends on EncryptionService. | Activity diagram: encryption key decision branch. "No" path logs error and ends in failure. | Keys loaded from environment on Flask server. | Fully Traced | No gap. Only explicitly modeled error path. |

## Metrics

| Metric | Value |
|---|---|
| Total requirements reviewed | 8 |
| Fully Traced | 5 (FR-01, FR-02, FR-03, FR-05, SPR-01) |
| Partially Traced | 2 (FR-04, FR-06) |
| Weakly Traced | 1 (FR-07) |
| Not Traced | 0 |
| Major UML elements without a clear requirement reason | 0 |

## Gap Analysis

Five of eight requirements are fully traced with structural, behavioral, and deployment evidence. Two are partially traced and one is weakly traced. The gaps fall into two categories.

First, missing behavioral diagrams. The voice note upload flow (FR-04) and the search/filter flow (FR-06) have class-level and use-case-level support, but no activity or sequence diagram models their end-to-end behavior. Before implementation, an activity diagram for the voice upload flow should be added to capture format validation (415 error) and the 10MB size check.

Second, frontend-only features. Markdown rendering (FR-07) is a client-side concern handled by a React library, so it has no backend class representation. This is architecturally correct (it does not belong in the Flask service layer), but it means FR-07 has only a use case to show for it. Adding a frontend component diagram or noting the rendering library in the deployment diagram would close this gap.

No UML element exists without a requirement justification. There are no overdesigned or orphan elements in the current package.
