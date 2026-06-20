-- Migration 013: Restructure dispatch tables
-- - Remove tracking_id from dispatches (dispatched_through serves the purpose)
-- - Move per-order metadata to dispatch_items (each order in a dispatch has its own metadata)
-- - dispatched_through: "Self Pick Up" or vehicle number plate

-- Drop the old tracking_id column from dispatches
ALTER TABLE dispatches DROP COLUMN tracking_id;
ALTER TABLE dispatches DROP COLUMN dispatch_doc_no;
ALTER TABLE dispatches DROP COLUMN delivery_note_date;
ALTER TABLE dispatches DROP COLUMN buyer_order_no;
ALTER TABLE dispatches DROP COLUMN buyer_order_date;
ALTER TABLE dispatches DROP COLUMN other_references;
ALTER TABLE dispatches DROP COLUMN payment_mode;
ALTER TABLE dispatches DROP COLUMN delivery_date;

-- Add per-order metadata columns to dispatch_items
ALTER TABLE dispatch_items ADD (
    payment_mode       VARCHAR2(200),
    dispatch_doc_no    VARCHAR2(100),
    delivery_note_date DATE,
    delivery_date      DATE,
    buyer_order_no     VARCHAR2(100),
    buyer_order_date   DATE,
    other_references   VARCHAR2(500)
);
