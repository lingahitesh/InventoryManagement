-- Migration 005: Add sku_quantity column to order_items to track kg per batch
-- quantity = number of units ordered from this batch
-- sku_quantity = total kg of that batch (same as inventory.sku_quantity at time of order)
-- Run once against the database

ALTER TABLE order_items ADD (
    sku_quantity NUMBER(12,3) DEFAULT 0
);
