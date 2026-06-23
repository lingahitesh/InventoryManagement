-- Migration 019: Add ready flag to order_items for "ready for dispatch" marking

ALTER TABLE order_items ADD (is_ready NUMBER(1) DEFAULT 0);
