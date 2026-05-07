# AstraNotes Decision Log

Each entry covers a major AI interaction: the prompt used, the key output, and revisions or deviations noted after review.

---

## Entry 001 - Phase 2: Markdown Rendering (US-06, FR-07)

**Date:** 2026-05-07
**Model:** Claude Sonnet 4.6 (claude-sonnet-4-6)
**Branch:** cursor/astranotes-backend-scaffold

### Prompt used

> We're starting Phase 2 of AstraNotes (US-06: Markdown Rendering, FR-07).
>
> In the frontend:
> 1. Add react-markdown as a dependency (and remark-gfm for GitHub-flavored markdown support like tables and strikethrough)
> 2. Update the note editor component to display a side-by-side layout: textarea on the left, rendered preview on the right
> 3. The preview should render the textarea content live as the user types
> 4. Use Tailwind for the layout (split 50/50 on desktop, stacked on mobile)
> 5. The preview pane should have prose styling so headings, lists, code blocks, etc. look reasonable
>
> Important:
> - Raw Markdown stays in the textarea and gets sent to the backend as-is
> - No backend changes required; rendering is client-side only per FR-07
> - Malformed Markdown should degrade gracefully (display as plain text, no crash)
>
> Update or add React Testing Library tests to verify the preview renders Markdown correctly for headings, bold, lists, and code blocks.

### Key output

Libraries added to `frontend/package.json`:

| Package | Version | Type |
|---|---|---|
| `react-markdown` | ^10.1.0 | dependency |
| `remark-gfm` | ^4.0.1 | dependency |
| `@tailwindcss/typography` | ^0.5.19 | devDependency |
| `@testing-library/react` | ^16.3.2 | devDependency |
| `@testing-library/jest-dom` | ^6.9.1 | devDependency |
| `jsdom` | ^29.1.1 | devDependency |
| `vitest` | ^4.1.5 | devDependency |

Files created:
- `frontend/src/components/MarkdownPreview.jsx` - wraps ReactMarkdown with remarkGfm and Tailwind prose classes
- `frontend/src/components/MarkdownPreview.test.jsx` - 10 Vitest + RTL tests
- `frontend/src/test/setup.js` - imports jest-dom matchers

Files modified:
- `frontend/src/pages/NoteEditor.jsx` - replaced single textarea with a `flex-col md:flex-row` split layout; added MarkdownPreview import
- `frontend/tailwind.config.js` - added `@tailwindcss/typography` plugin
- `frontend/vite.config.js` - added `test` block for Vitest (jsdom environment, setup file, globals)
- `frontend/package.json` - added `test` and `test:watch` scripts

Test results: 10/10 passing. Production build clean.

### Revisions made after review

None required. Output compiled and ran without errors on first attempt after fixing a Python 3.9 compatibility issue (unrelated to Phase 2) that surfaced during Phase 1 setup.

### Deviations to be aware of

1. **Log file location.** The working agreement (working-agreement.md) says the decision log lives in `/docs`. This file is in `planning/` instead, per explicit instruction. The two locations should be reconciled before the Technical Defense.

2. **`NoteEditor` has no tests.** The 10 tests cover `MarkdownPreview` only, which is where FR-07's rendering behavior lives. `NoteEditor` itself (save, delete, load-on-mount) is untested at the component level. Testing it requires mocking `react-router-dom` hooks and the notes API service. This is a coverage gap relative to SPR-03's 80% coverage target. Recommend adding NoteEditor interaction tests in a follow-up.

3. **`@tailwindcss/typography` is not on the approved tech stack list in CLAUDE.md.** It was added to satisfy the prose styling requirement in the prompt. The CLAUDE.md tech stack section lists "Tailwind CSS" without explicitly naming plugins. This should be noted as an approved addition since it was part of the Phase 2 specification.

4. **Graceful degradation relies on react-markdown's built-in behavior, not an explicit error boundary.** FR-07 requires that malformed Markdown degrades gracefully without a crash. This holds because react-markdown never throws on invalid input; it renders whatever it can parse. No React error boundary component was added. If the requirement is interpreted strictly, an error boundary around `MarkdownPreview` would make the guarantee explicit. Current behavior passes in practice but is not defensively coded.
