-- Migration 014: Add dispatch_status column to orders
-- Values: 'pending', 'partial', 'completed'
-- Computed on read based on dispatched units vs ordered units

ALTER TABLE orders ADD (dispatch_status VARCHAR2(20) DEFAULT 'pending');
