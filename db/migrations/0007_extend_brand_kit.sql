-- Migration 0007: Extend brand_kits table with platform links, products/services, target audience, competitors, and brand guidelines
ALTER TABLE brand_kits ADD COLUMN platform_links TEXT NOT NULL DEFAULT '[]';
ALTER TABLE brand_kits ADD COLUMN products_services TEXT NOT NULL DEFAULT '';
ALTER TABLE brand_kits ADD COLUMN target_audience TEXT NOT NULL DEFAULT '';
ALTER TABLE brand_kits ADD COLUMN competitors TEXT NOT NULL DEFAULT '';
ALTER TABLE brand_kits ADD COLUMN brand_guidelines TEXT NOT NULL DEFAULT '';
