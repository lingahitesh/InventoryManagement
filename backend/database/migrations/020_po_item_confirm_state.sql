-- Migration 020: Add confirm/not_arrived/arrived state to PO items
-- Replaces binary arrived flag with a status column and adds arrived_at timestamp

-- Add status column (confirm, not_arrived, arrived)
ALTER TABLE purchase_order_items ADD (
    item_status VARCHAR2(20) DEFAULT 'confirm',
    arrived_at  TIMESTAMP
);

-- Migrate existing data: arrived=1 -> 'arrived', arrived=0 -> 'not_arrived'
UPDATE purchase_order_items SET item_status = 'arrived', arrived_at = SYSTIMESTAMP WHERE arrived = 1;
UPDATE purchase_order_items SET item_status = 'not_arrived' WHERE arrived = 0;

COMMIT;
