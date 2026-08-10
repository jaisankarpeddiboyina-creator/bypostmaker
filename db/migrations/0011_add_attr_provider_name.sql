-- ============================================================
-- PostMaker D1 Migration 0011 — Add attr_provider_name Column
-- Adds: attr_provider_name to assets table
-- ============================================================
-- ROLLBACK: No native ALTER TABLE DROP COLUMN in sqlite < 3.35.0, but we can do it if needed.

ALTER TABLE assets ADD COLUMN attr_provider_name TEXT;
