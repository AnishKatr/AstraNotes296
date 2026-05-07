# AstraNotes Definition of Done

A task, feature, or artifact is considered complete only when all of the following criteria are met.

## Criteria

| # | Area | Criteria |
|---|---|---|
| 1 | Requirement Mapping | The work maps to a specific objective or requirement in the requirements baseline. No task is Done if it cannot be traced back to an approved requirement. |
| 2 | Explainability | I can explain the logic, design decisions, and architecture behind the work. If the code was AI-generated, I can walk through it and justify why it was accepted. |
| 3 | Quality and Realism | The code compiles, runs without errors, and produces realistic output. No placeholder logic, hardcoded test values, or incomplete stubs are present in the final version. |
| 4 | Testing and Validation | Backend logic has pytest unit tests and frontend components have React Testing Library tests. All tests pass before the task is marked Done. |
| 5 | Security and Privacy | No hardcoded secrets, API keys, or credentials exist in the codebase. Encrypted notes use AES-256 through the EncryptionService. No user data is sent to external services. |
| 6 | AI Output Review | Any AI-generated code has been reviewed, tested, and logged in the decision log with the prompt used, the key output, and any revisions made. Unreviewed AI output is never merged. |
| 7 | Traceability | The pull request references the original GitHub Issue. The commit history is clean and the PR includes a self-review checklist (no duplication, consistent naming, test coverage). |
| 8 | Ready to Move Forward | The feature meets the acceptance criteria defined in the GitHub Issue, has been merged to main, and does not introduce regressions in existing tests. |

## Reflection

This Definition of Done ensures that no work moves forward unless it is traceable, tested, explainable, and secure. The most important criterion for AstraNotes is explainability: since the course requires a Technical Defense, being able to justify every architectural and implementation choice is critical, especially when AI was involved. By requiring a decision log entry for all AI-generated code and mandating that any accepted output can be walked through, this Definition of Done turns AI collaboration into a disciplined process rather than a shortcut.
