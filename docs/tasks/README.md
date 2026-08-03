---
id: DOC-2026-008
title: Task Repository & Execution Roadmap
category: Product
status: Stable
owner: Tech Lead & Product Lead
created_at: 2026-08-03
last_updated: 2026-08-03
version: 1.0.0
breaking_changes: No
migration_needed: No
compatible_since: v1.0.0
deprecated_since: N/A
---

# PostMaker — Task Repository

Root index for all execution tasks, derived from `PostMaker_Product_Vision_Roadmap_v1.docx` and `PostMaker_PRD_Professional_v1.docx`.

**Total tasks:** 43  (36 core, 7 optional/not-yet-committed)

## Structure

```
docs/tasks/
├── README.md                      <- you are here (root index)
├── NOTES.md                       <- decisions log
├── docs/
│   ├── vision-and-theory.md       <- product vision, mission, principles
│   └── execution-strategy.md      <- strategy, success metrics, risks
└── phases/
    ├── phase-1-launch/
    │   ├── README.md              <- phase overview + task table
    │   └── core/P1-xx-*.md        <- individual task files
    ├── phase-2-creator-experience/
    │   ├── README.md
    │   ├── core/P2-xx-*.md
    │   └── optional-tools-pool/P2-xx-*.md   <- not committed, pick later
    ├── phase-3-automation/
    ├── phase-4-business/
    └── phase-5-scale/
```

## Phase Index

| Phase | Focus | Core Tasks | Optional | File |
|---|---|---|---|---|
| Phase 1 — Launch | see phase README | 10 | 0 | [phases/phase-1-launch/README.md](phases/phase-1-launch/README.md) |
| Phase 2 — Creator Experience | see phase README | 10 | 7 | [phases/phase-2-creator-experience/README.md](phases/phase-2-creator-experience/README.md) |
| Phase 3 — Automation | see phase README | 4 | 0 | [phases/phase-3-automation/README.md](phases/phase-3-automation/README.md) |
| Phase 4 — Business | see phase README | 7 | 0 | [phases/phase-4-business/README.md](phases/phase-4-business/README.md) |
| Phase 5 — Scale | see phase README | 5 | 0 | [phases/phase-5-scale/README.md](phases/phase-5-scale/README.md) |

## Each task file contains

- **Frontmatter fields:** Phase, Type, Priority, Owner role, Depends on, Status
- **Description** — what the task covers
- **Definition of Done** — how you know it's actually finished
- **Notes** — free space for implementation notes/blockers as work happens

## How to use this repo

1. Start at a phase README (`phases/phase-1-launch/README.md`) — Phase 1 is the launch gate, do it first.
2. Open individual task `.md` files to assign and work them.
3. Update the `Status` line inside each task file as work progresses (Not Started → In Progress → Blocked → Done).
4. Tools in `optional-tools-pool/` stay `Not Selected` until the team resolves task `P2-06` — move a tool to `core/` once chosen, or just flip its Status.
5. Log any decision that isn't obvious from the task files themselves in `NOTES.md`.
