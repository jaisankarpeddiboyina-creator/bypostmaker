-- Migration 0005: Add image_description column to campaigns
-- Stores the Stage 1 Gemini vision analysis output.
-- Used to avoid re-running the Gemini call on per-platform retries.
-- NULL = no image, image present but Stage 1 not yet run, or Stage 1 failed.
-- TEXT (nullable) — existing rows and text-only campaigns keep this NULL.
ALTER TABLE campaigns ADD COLUMN image_description TEXT;
