# AstraNotes Prioritized Backlog

| Priority | Story | Rationale |
|---|---|---|
| 1 | US-01: CRUD Notes | Foundation for all other features. Nothing works without basic note management. |
| 2 | US-06: Markdown Rendering | Core text experience. Low complexity, high value for daily use. |
| 3 | US-02: Secure (Encrypted) Notes | Addresses the encryption requirement early, which impacts data model design. |
| 4 | US-05: Search and Filter | Usability at scale. Needed once note count grows past a handful. |
| 5 | US-04: Version History | Safety net for edits. Requires snapshot subdocument design to be in place. |
| 6 | US-03: Voice Notes | Most complex (browser audio + GridFS). Deferred until core is stable. |

## Mapping to Implementation Phases

The backlog directly maps to the six implementation phases:

- **Phase 1**: US-01 (foundation, repo setup, CRUD)
- **Phase 2**: US-06 (Markdown rendering)
- **Phase 3**: US-02 + SPR-01 (encryption)
- **Phase 4**: US-05 (search and filter)
- **Phase 5**: US-04 (version history)
- **Phase 6**: US-03 (voice notes)
