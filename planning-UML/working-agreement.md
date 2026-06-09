# AstraNotes Working Agreement

## Planning and Tracking Work

All tasks are tracked in a GitHub Projects board with columns: Backlog, In Progress, In Review, and Done. Each task is created as a GitHub Issue with a clear title, acceptance criteria, and a label (frontend, backend, testing). Work is planned in weekly sprints, with a prioritized backlog reviewed at the start of each week.

## Using AI in the Workflow

AI (GitHub Copilot in VS Code and Claude) is used for code generation, debugging, architecture brainstorming, and documentation drafting. AI is treated as a first-draft tool, not a final answer. Every AI-generated output is reviewed against the project's requirements and architecture before being committed.

## Documenting Prompts, Decisions, and Revisions

Each major AI interaction is logged in a decision log stored in the repo's `/docs` folder. Each entry includes three fields: the prompt used, the key output, and any changes made after review. Architecture decisions are recorded as lightweight ADRs (Architecture Decision Records) with the context, decision, and rationale.

## Deciding Whether AI Output Is Acceptable

AI output is acceptable only if it:
1. Compiles and runs without errors
2. Aligns with the MVC architecture and plugin pattern defined in the requirements baseline
3. Does not introduce unapproved dependencies
4. Passes existing tests

If any of these fail, the output is revised manually or re-prompted with tighter constraints.

## Preventing Drift, Duplication, and Low-Quality Output

All code is committed through pull requests with a self-review checklist before merging. The checklist includes: no duplicate logic across services, consistent naming conventions, no hardcoded secrets, and test coverage for new logic. The requirements baseline and architecture decision log serve as the source of truth to catch scope drift early.

## Reflection

These decisions directly shape how AstraNotes is built over the quarter. The GitHub Projects board keeps work visible and prevents tasks from falling through the cracks. Logging AI prompts and outputs forces me to treat AI as a collaborator I need to verify, not a black box I blindly trust. Without these guardrails, it would be easy to accumulate technical debt, lose track of what the AI actually generated versus what I wrote, and end up unable to defend my architectural choices during the Technical Defense.
