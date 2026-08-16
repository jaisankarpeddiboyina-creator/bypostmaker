-- Migration: 0014_omnipost_rate_limit_index.sql
-- Description: Add composite index on omnipost_deliveries(connection_id, created_at) for connection-scoped sliding-window rate limiting.

CREATE INDEX IF NOT EXISTS idx_omnipost_deliveries_conn_created 
ON omnipost_deliveries(connection_id, created_at);
