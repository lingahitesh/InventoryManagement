-- Migration 004: Add shipping_address and total_units to orders table
-- Run once against the database

ALTER TABLE orders ADD (
    shipping_address VARCHAR2(500),
    total_units      NUMBER(10),
    total_qty        NUMBER(12,3)
);
