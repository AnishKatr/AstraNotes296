# AstraNotes — Prioritized backlog (charter ↔ requirements)

This backlog ties the **Project Charter (Phase 1)** to the refined requirement IDs **FR-01–FR-07** and non-functional / security items. Implementation order is **easiest → hardest**, staying inside **React + Flask + MongoDB** with **no third-party note/analytics APIs** (SPR-02).

## Charter themes → requirement IDs

| Charter driver | Refined requirement | One-line scope |
|----------------|---------------------|----------------|
| Multiple note types (“seamlessly”) | **FR-02** Plugin note types | `PluginRegistry` registers Text, Voice, Secure; unknown type → 400. |
| Private notes (“actually private”) | **FR-03**, **SPR-01** | AES-256 at rest; keys from env; decrypt failures → 403. |
| Fast with thousands of notes | **FR-06**, **NFR-01** | Text search + type filter; pagination (default 50); indexes on title, type, `updated_at`. |
| Change history (“don’t lose work”) | **FR-05** | Immutable snapshots on save; list + restore; max **50** per note. |
| Markdown + engineer-focused UX | **FR-07** | Store raw Markdown; render client-side; graceful degradation. |
| Foundation for everything | **FR-01** | CRUD; soft delete; empty title → 400; timestamps. |
| Hands-free capture | **FR-04** | MediaRecorder → upload; GridFS; 10 MB; webm/wav; 415 otherwise. |
| Cross-browser | **NFR-02** | Chrome / Firefox / Safari / Edge; MediaRecorder fallback UI. |
| Quality / auditability (charter) | **SPR-03** | pytest ≥80% line coverage target; RTL on frontend. |

## Ordered delivery (sample → full baseline)

1. **Tier 0 — Repo & MVC skeleton:** Flask `routes/` + `services/` + models/helpers; MongoDB connection; `GET /api/health`; CI smoke tests; **charter: MVC, auditability**.
2. **Tier 1a — FR-01:** Text note CRUD + list (soft delete, validation).
3. **Tier 1b — FR-02:** `PluginRegistry` with at least `text`; reject unknown `note_type`.
4. **Tier 1c — FR-07:** Markdown editor + live preview (client-only rendering).
5. **Tier 2a — FR-06:** Full-text search + type filter + pagination.
6. **Tier 2b — FR-05:** Version snapshots, restore, 50-snapshot pruning.
7. **Tier 3a — FR-03:** Secure notes + `EncryptionService` (fail-fast without keys).
8. **Tier 3b — FR-04:** Voice record/upload, GridFS, playback, format/size limits.

## Traceability matrix (summary)

| ID | Charter tie-in | Status |
|----|----------------|--------|
| FR-01 | Note variety foundation | In progress (initial sample) |
| FR-02 | Modular note types | Stub registry |
| FR-03 | Privacy / encryption | Planned |
| FR-04 | Note variety (voice) | Planned |
| FR-05 | Version history | Planned |
| FR-06 | Performance / findability | Planned |
| FR-07 | Markdown (charter) | Planned |
| NFR-01 | Thousands of notes | Partial (pagination TBD with FR-06) |
| NFR-02 | Cross-platform | Manual test after voice |
| SPR-01–03 | Security / privacy / tests | Partial |

## Source documents

- Project Charter (Phase 1): requirements & scope, MVC non-negotiable, plugins, security, scale.
- Refined Requirements Baseline: FR-01–FR-07, edge cases, SPR/NFR as listed above.
