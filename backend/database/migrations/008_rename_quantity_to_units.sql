-- Migration 008: Rename quantity -> units in order_items, total_quantity -> total_units in dispatches
-- For consistency: "units" = number of rolls/pieces, "sku_quantity" = weight in kg

ALTER TABLE order_items RENAME COLUMN quantity TO units;
ALTER TABLE dispatches RENAME COLUMN total_quantity TO total_units;
