# Validation Checklist — Run Before Marking Any Doc Done

Run this 8-point quality check before declaring any documentation task complete:

- [ ] **1. Metadata Header Complete**: `id`, `title`, `category`, `status`, `owner`, `version`, `last_updated`, `breaking_changes`, `migration_needed` — zero blank fields.
- [ ] **2. Single Source of Truth**: Checked `doc-index.md` and existing docs to ensure no duplicated facts exist.
- [ ] **3. Valid Internal Links**: Every referenced file path uses valid `file:///` markdown links and exists on disk.
- [ ] **4. Not an Orphan**: Document is linked in `doc-index.md` and referenced by at least one other document or feature spec.
- [ ] **5. Mandatory AI Context Included**: Contains `Purpose`, `Inputs`, `Outputs`, `Dependencies`, `Constraints`, `Business Rules`, `Edge Cases`, `Failure Modes`, and `DO NOT CHANGE` guardrails.
- [ ] **6. Grounded Evidence Standard**: Contains zero speculative words (`probably`, `should`, `might`, `maybe`). Includes Evidence Matrix with file links, line numbers, and verification dates.
- [ ] **7. Honest Status**: Marked `Draft` if feature is in-progress or unverified; marked `Stable` ONLY when verified against working runtime code/tests.
- [ ] **8. ADR Checked**: If a technical or architectural decision was made, a standalone ADR was created under `docs/decisions/` using `decision-record-template.md`.

If any box is unchecked, the doc is not done — resolve all gaps before declaring completion.
