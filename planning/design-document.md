# AstraNotes Design Document

## Architecture Overview

AstraNotes is a web-based note-taking application with a React (Vite) frontend and a Python/Flask REST API backend, using MongoDB for data storage. The architecture follows the Model-View-Controller pattern with a plugin system for extensible note types.

## Technology Stack Decision

**Chosen path:** React (Vite) for the frontend, Python/Flask for the backend REST API, MongoDB for storage with GridFS for voice note audio files.

**Rationale:**
- The MVC pattern enforces separation between routes (Controller), services (business logic), and models (data layer), making each layer independently testable with pytest.
- MongoDB's document model fits the variable structure of plugin-based note types (Text, Voice, Secure) without requiring schema migrations.
- The plugin pattern allows new note types to be added without modifying core logic.
- Smart pointer ownership (in C++) is not needed in Python, but the equivalent principle of clear object lifecycle is enforced by keeping services stateless and treating MongoDB as the single source of truth.
- Every architectural choice traces back to a specific project requirement defined in `requirements.md`.

## Backend Layer Structure

The Flask backend organizes into three layers:

- `routes/` (Controller): HTTP endpoints, request validation, response formatting
- `services/` (Business Logic): NoteService, EncryptionService, VersionHistoryService, PluginRegistry
- `models/` (Data Layer): Note, TextNote, VoiceNote, SecureNote, NoteSnapshot

Strict rules:
- Routes never contain business logic.
- Services never touch HTTP request or response objects.
- Models never call services.

## Class Structure

The class diagram defines:

- A `Note` base class with `TextNote`, `SecureNote`, and `VoiceNote` as derived types
- `NoteService` managing note CRUD operations through a `PluginRegistry`
- `EncryptionService` as a standalone service for AES-256 encryption with keys from environment variables
- `VersionHistoryService` managing note snapshots with a 50-snapshot cap per note
- `NoteSnapshot` as a subdocument linked to its parent Note

Key relationships:
- NoteService depends on PluginRegistry, VersionHistoryService, and EncryptionService
- SecureNote depends on EncryptionService for encrypt/decrypt operations
- Note has a 1-to-many relationship with NoteSnapshot
- PluginRegistry creates and handles all three note subtypes

## UML Views

The complete UML package consists of five views, each describing AstraNotes from a different perspective. All views share the same class names, relationships, and scope.

### Class Diagram
Defines the structural foundation. Shows the Note inheritance hierarchy, the three service classes, and the PluginRegistry. Every other diagram builds on this structure.

### Object Diagram
Proves the class diagram works at runtime. Shows concrete instances (a text note, a secure note with an encrypted body, a voice note with a GridFS reference, and a snapshot linked to a specific note) that match the attributes and relationships defined in the class diagram.

### Use Case Diagram
Maps user-facing functionality to the services in the class diagram. "Create Note" relies on the PluginRegistry, "Mark Note as Secure" relies on the EncryptionService, and "Edit Note" triggers snapshot creation through the VersionHistoryService.

### Activity Diagram
Zooms into the "Create a Secure Note" flow and traces the full request lifecycle from the React frontend through Flask routing, plugin validation, encryption, MongoDB storage, and snapshot creation. The decision branch for a missing encryption key reflects the fail-fast behavior defined in SPR-01.

### Deployment Diagram
Shows the three nodes:
- Client Browser: React (Vite) SPA, communicates via HTTPS REST
- Flask Application Server: contains routes/, services/, models/. Runs on a single server or container.
- MongoDB Server: notes collection, snapshots as subdocuments, GridFS for audio files

Communication: HTTPS between browser and Flask, PyMongo driver between Flask and MongoDB.

## How the Views Fit Together

The five views give a complete picture: what the system is made of (class), what it looks like running (object), what users can do (use case), how a key workflow executes (activity), and where it all lives (deployment). The class diagram is the structural foundation; every other view ties back to the same class names and relationships.

## Memory and Data Management

- All persistent data is stored in MongoDB
- No in-memory caches that could go stale
- Encryption keys are loaded from environment variables at app startup
- Missing required configuration (encryption keys, database connection) causes the app to fail fast with a clear error rather than silently default
- Services are stateless: they take inputs, return outputs, and read or write through the data layer

## Error Handling Conventions

| Code | Meaning | Example |
|---|---|---|
| 400 | Validation error | Empty title, unknown plugin type, invalid filter value |
| 403 | Auth or encryption failure | Decryption fails on a secure note |
| 404 | Not found | Note ID does not exist |
| 415 | Unsupported upload format | Voice note format other than webm or wav |
| 500 | Server error | Unexpected internal failure |

All errors return JSON in the format:
```json
{ "error": "human-readable message", "code": "ERROR_CODE" }
```

## What Was Considered and Rejected

- **SQLite**: Initially considered but rejected in favor of MongoDB because the document model fits plugin-based note types better and supports GridFS for audio storage natively.
- **Cloud-first deployment**: Out of scope for the current quarter. The architecture supports it (containerized Flask, MongoDB Atlas), but local-first development is the priority.
- **Multi-user authentication**: Deferred until later phases. The architecture leaves room for JWT or session auth in the routes layer without restructuring services or models.
- **Real-time collaboration**: Out of scope. Would require WebSockets or CRDTs and is not in the requirements baseline.
