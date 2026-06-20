-- Migration 011: Add delivery_charge column to orders
-- Default 0, stores delivery charge in rupees (float, 2 decimal places)

ALTER TABLE orders ADD (delivery_charge NUMBER(10,2) DEFAULT 0);
