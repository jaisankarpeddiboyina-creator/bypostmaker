---
id: DOC-2026-007
title: Deployment Pipeline & Shipping Runbook
category: Operations
status: Stable
owner: DevOps & Release Lead
created_at: 2026-07-31
last_updated: 2026-07-31
version: 1.0.0
breaking_changes: No
migration_needed: No
compatible_since: v1.0.0
deprecated_since: N/A
---

# Deployment Pipeline & Shipping Runbook

## Documentation Relationships

- **Depends On**:
  - [DOC-2026-001: System Architecture](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/docs/architecture/system-overview.md)
  - [DOC-2026-002: API Contract Spec](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/docs/api/postmaker-api-contract.md)

---

## AI Context & Guardrails

> [!IMPORTANT]
> **Strict Operational Runbook for Engineers & AI Agents**

- **Purpose**: Governs the ONLY authorized method to test, build, and deploy code to production or staging in the PostMaker repository.
- **Mandatory Script**: [`scripts/ship.sh`](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/scripts/ship.sh).
- **Constraints**: Never run manual `git push` directly to `staging` or `main`. Always execute `bash scripts/ship.sh`.
- **DO NOT CHANGE**: `scripts/ship.sh` step order (git clean check -> branch guard -> fast-forward pull -> `npm ci` -> `npm run type-check` -> `npm run build` -> `git push`).

---

## Deployment Pipeline Architecture

```mermaid
flowchart TD
    Dev["Local Developer / AI Agent"] -->|1. Run| ShipScript["bash scripts/ship.sh"]
    
    subgraph Local Validation Suite
        ShipScript --> Step1["1. Verify Clean Git Status"]
        Step1 --> Step2["2. Branch Guard (main or staging)"]
        Step2 --> Step3["3. Fast-Forward Pull"]
        Step3 --> Step4["4. Clean npm ci (root, worker, frontend)"]
        Step4 --> Step5["5. npm run type-check"]
        Step5 --> Step6["6. npm run build"]
    end

    Step6 -->|All Pass| Push["7. Git Push Origin"]
    Push --> GitHubActions["GitHub Actions CI/CD Pipeline"]
    
    GitHubActions -->|Main Branch| ProdWorker["Deploy Production Cloudflare Worker"]
    GitHubActions -->|Staging Branch| StagingWorker["Deploy Staging Cloudflare Worker"]
```

---

## Execution Instructions

Execute the following command to deploy:

```bash
bash scripts/ship.sh
```

### Pre-requisites & Verification Sequence
1. Commit all modified files.
2. Ensure working branch is `main` or `staging`.
3. If type-check or build fails, fix all TypeScript compilation errors before re-running `ship.sh`.

---

## Evidence & Verification

| Claim / Behavior | Evidence Source | Verification Link / Code | Verified By | Last Verified |
| :--- | :--- | :--- | :--- | :--- |
| `scripts/ship.sh` runs type-check & build | Script Source | [`scripts/ship.sh#L1-L60`](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/scripts/ship.sh#L1-L60) | DevOps Lead | 2026-07-31 |
