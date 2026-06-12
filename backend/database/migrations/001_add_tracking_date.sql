-- Migration 001: Add tracking_id and entry_date to inventory
-- Run once against the database

ALTER TABLE inventory ADD (
    tracking_id VARCHAR2(100),
    entry_date  DATE DEFAULT SYSDATE
);
