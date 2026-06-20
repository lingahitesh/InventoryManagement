-- Migration 012: Add missing ORDER_ITEM_ID column to DISPATCH_ITEMS

ALTER TABLE dispatch_items ADD (order_item_id NUMBER);
