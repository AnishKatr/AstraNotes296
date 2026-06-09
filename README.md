# AstraNotes

A web-based, multi-user note-taking application with three note types through a plugin architecture: plain text, encrypted secure notes, and voice notes. Built for CSEN 296B-2 (AI-Driven Software Development) as a full software development lifecycle project, from requirements through design, implementation, testing, and validation.

## Features

- Create, edit, and soft-delete notes with a Markdown editor and live preview
- Secure notes encrypted at rest with AES-256-GCM
- Voice notes recorded in the browser and stored in GridFS
- Version history with snapshots and one-click restore
- Full-text search and filtering by type and tag
- Tags for organization, a trash view with restore and permanent delete, Markdown and PDF export, and light/dark/system theming

The first six capabilities realize the graded requirements baseline (FR-01 through SPR-03). Tags, trash management, export, dark mode, and the UI redesign are post-baseline enhancements, tracked separately in the planning folder.

## Tech Stack

- Frontend: React 18 with Vite, Tailwind CSS, shadcn/ui, React Router
- Backend: Python 3.11+ with Flask (REST API)
- Database: MongoDB, with GridFS for voice note audio
- Encryption: AES-256-GCM via the cryptography library
- Tests: pytest (backend), Vitest and React Testing Library (frontend), Playwright (cross-browser end-to-end)

## Architecture

The backend follows the Model-View-Controller pattern with strict layer separation:

- `routes/` (Controller): HTTP endpoints, request validation, response formatting
- `services/` (Business Logic): NoteService, EncryptionService, VersionHistoryService, PluginRegistry
- `models/` (Data Layer): note documents and snapshots

Note types are handled through a plugin registry, so a new type means adding a handler rather than modifying core logic. The full design, including the UML package and the requirements-to-UML traceability matrix, is in the `planning/` folder.

## Repository Structure

```
AstraNotes/
  backend/          Flask API (app factory, routes, services, models, tests)
  frontend/         React + Vite single-page app
  planning/         Requirements, user stories, UML, traceability, decision log
  scripts/          Seed and performance-measurement scripts
  CLAUDE.md         Project context for AI-assisted development
  README.md         This file
```

## Setup

### Prerequisites

- Python 3.11 or newer
- Node.js 18 or newer
- MongoDB running locally on port 27017

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # on Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in `backend/` based on `.env.example`. You must provide an encryption key. Generate one with:

```bash
python -c "import os, base64; print(base64.b64encode(os.urandom(32)).decode())"
```

Then set it in `.env`:

```
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=astranotes
ENCRYPTION_KEY=<paste the generated key here>
```

The app validates the encryption key at startup and will refuse to start if it is missing or invalid. This is intentional (requirement SPR-01).

Run the backend:

```bash
flask run
```

The API serves on http://localhost:5000.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The app serves on http://localhost:5173.

### 3. Seed demo data (optional)

```bash
python scripts/seed_notes.py --count 30
```

## Running Tests

Backend:

```bash
cd backend
pytest                       # run the suite
pytest --cov=app             # with coverage
```

Frontend:

```bash
cd frontend
npm test                     # unit and component tests
npx playwright test          # cross-browser end-to-end tests
```

## Continuous Integration

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push and pull request to any branch. It runs two parallel jobs:

**Backend (pytest)** — spins up a MongoDB 7 service container, installs Python 3.11 dependencies, and runs the full pytest suite with `--cov-fail-under=80`. The CI database is isolated (`astranotes_ci`) and a throwaway encryption key is used so the real key is never exposed.

**Frontend (vitest)** — installs Node 20 dependencies via `npm ci` and runs `npm run coverage`, which runs the full Vitest suite with coverage reporting.

Both jobs must pass before a branch is considered green. The coverage gate on the backend enforces the 80% line coverage requirement from SPR-03 at merge time, not just locally.

## Project Artifacts

The `planning/` folder contains the full SDLC trail:

- `requirements.md` — refined requirements baseline
- `user-stories.md` — user stories with acceptance criteria
- `backlog.md` and `sprint-zero-plan.md` — planning materials
- `design-document.md` — architecture and UML package summary
- `traceability-matrix.md` — requirements-to-UML mapping with metrics and gap analysis
- `working-agreement.md` and `definition-of-done.md` — process artifacts
- `decision-log.md` — log of AI interactions with what was accepted, refined, or rejected

## AI-Native Development

AI tools (Claude Code and GitHub Copilot) were used across the lifecycle for drafting requirements, generating UML, scaffolding code, and writing tests. Every AI output was reviewed and validated by hand, with decisions recorded in `planning/decision-log.md`. The `CLAUDE.md` file at the repo root gives AI tools the project context, conventions, and architectural rules.

## Known Limitations

These are documented scope decisions, not defects:

- Authentication is out of scope for this quarter. Requirement FR-03 specifies that decryption requires authentication; the encryption mechanism is fully implemented, and the authentication gate is a documented future requirement.
- Search uses a database query approach chosen for substring matching; the performance characteristics and the tradeoff against the text index are documented in `planning/design-document.md`.
- Cloud deployment, real-time collaboration, and a mobile app are out of scope.
