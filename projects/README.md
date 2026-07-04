# Runtime Projects

Project folders are configuration ownership boundaries for the Runtime Engineering Platform.

The active configuration lives in `runtime-context.json`. Future project folders should add project-specific notes only after the context contains the actual IDs, URLs, evidence paths, and acceptance profiles.

Rules:

- Do not hard-code Sheet IDs, deployment IDs, runtime URLs, or whoami URLs in workflow docs.
- Resolve project constants from `runtime-context.json`.
- Keep business logic in the project runtime.
- Keep tooling, diagnostics, deployment, acceptance, evidence, and release workflows in the shared platform.
- If a target object or environment cannot be proven from context and live identity checks, stay read-only.

Expected project folder shape:

```text
projects/
  FODE/
  KIA/
  MLC/
  Marketing/
```

Each project supplies configuration. The shared platform supplies the workflow.
