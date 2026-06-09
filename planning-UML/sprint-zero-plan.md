# Sprint Zero Plan

Sprint Zero focuses on setup, tooling, and risk reduction before feature development begins.

## Tasks

### 1. Repo and Tooling Setup

Initialize GitHub repo with React (Vite) frontend and Flask backend. Configure linting (ESLint, flake8), `.gitignore`, and GitHub Projects board with Backlog, In Progress, In Review, and Done columns.

### 2. MongoDB Configuration

Set up MongoDB locally for development. Create initial collections (notes, snapshots). Verify connection from Flask using PyMongo.

### 3. MVC Scaffold

Create folder structure: `routes/`, `services/`, `models/` on backend. Stub out NoteService, EncryptionService, VersionHistoryService, and PluginRegistry. Confirm a basic health-check endpoint returns 200.

### 4. CI and Testing Baseline

Add pytest config for backend and React Testing Library + Vitest for frontend. Write one passing smoke test per side. Set up GitHub Actions to run tests on push.

### 5. Planning Artifacts

Commit `requirements.md`, `user-stories.md`, `backlog.md`, `sprint-zero-plan.md`, `design-document.md`, `traceability-matrix.md`, `working-agreement.md`, and `definition-of-done.md` to the `planning/` folder. Link each story to its requirement ID for traceability.

### 6. Risk Reduction Spike

Prototype AES-256 encryption/decryption roundtrip in Flask to validate the EncryptionService approach before Sprint 1.

## Exit Criteria

Sprint Zero is complete when:
- The repo is initialized with the agreed monorepo structure
- A health-check endpoint returns 200 from Flask
- MongoDB connection is verified from Flask
- One smoke test passes on each side
- Planning artifacts are committed
- The encryption roundtrip prototype works end-to-end
