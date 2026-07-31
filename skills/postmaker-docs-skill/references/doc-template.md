# PostMaker Master Doc Template

Every PostMaker document starts with this header metadata block. Fill in every field — no blanks or unresolved "TBD"s before marking Stable.

```markdown
---
id: DOC-YYYY-XXX
title: [Document Title]
category: [Architecture | Feature | API | Database | UI/UX | Deployment | Security | Testing | Operations | Troubleshooting | Product | Business]
status: [Draft | Review | Approved | Stable | Deprecated | Archived]
owner: [Role / Team Lead]
created_at: YYYY-MM-DD
last_updated: YYYY-MM-DD
version: X.Y.Z
breaking_changes: [Yes | No] (Details if Yes)
migration_needed: [Yes | No] (Path if Yes)
compatible_since: vX.Y.Z
deprecated_since: N/A | vX.Y.Z
---
```

---

## Documentation Relationships

- **Depends On**:
  - [DOC-2026-001: System Architecture](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/docs/architecture/system-overview.md)
- **Used By**:
  - [DOC-2026-002: API Contract Spec](file:///c:/Users/golde/OneDrive/Desktop/bypostmaker/docs/api/postmaker-api-contract.md)
- **Related APIs**: `POST /api/generate`
- **Related Database Tables**: `campaigns`, `posts`

---

## AI Context & Guardrails (Mandatory for AI Agents)

> [!IMPORTANT]
> **Strict Operational Context for AI Agents & Automated Tools**

- **Purpose**: Precise 1-2 sentence description of what this component does.
- **Inputs**: Data payload, HTTP headers, query params, or environment bindings.
- **Outputs**: Return types, JSON schemas, HTTP status codes, generated artifacts.
- **Dependencies**: NPM packages, Worker bindings (`DB`, `BUCKET`), external APIs.
- **Constraints**: Rate limits (e.g., Groq rate limiter), max payload size, execution timeouts.
- **Business Rules**: Invariant requirements (e.g., "User must have active subscription to export 4K").
- **Edge Cases**: Empty states, network loss during presigned upload, expired JWT tokens.
- **Failure Modes**: 401 Unauthorized, 429 Too Many Requests, 500 S3 Presigned URL error.
- **Performance Targets**: Response latency < 200ms, initial render < 100ms.
- **Security Guardrails**: CORS origins, JWT verification, sanitize HTML inputs.
- **Future Work**: Planned v2 enhancements.
- **DO NOT CHANGE**: Critical invariants that must never be altered or refactored without an approved ADR.

---

## Grounded Evidence & Verification

Speculative writing is strictly forbidden (`probably`, `should`, `might`). Replace with empirical proof:

| Claim / Behavior | Evidence Source | Verification Link / Code (`file:///...`) | Verified By | Last Verified |
| :--- | :--- | :--- | :--- | :--- |
| API returns 401 for expired token | Integration Test | `worker/src/routes/auth.test.ts#L45-L62` | Lead QA | 2026-07-31 |
| Primary button uses `--color-primary` | Design Tokens | `frontend/src/styles/globals.css#L12` | Frontend Lead | 2026-07-31 |

---

## Living Status & Technical Debt

### Open Questions
- [ ] Unresolved architectural design question.

### Technical Debt
- [ ] Refactoring work item.

### Known Limitations
- R2 upload payload limits in development environment.

### Future Improvements
- Next version feature enhancements.
