-- Migration 010: Fix sku_dim = 'none' to '-' for dimensionless products
-- These were entered before the hasDimensions fix was in place

UPDATE inventory SET sku_dim = '-' WHERE sku_dim = 'none';
COMMIT;
