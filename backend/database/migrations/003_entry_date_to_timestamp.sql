-- Migration 003: Convert entry_date from DATE to TIMESTAMP to store exact time
-- Run once against the database

ALTER TABLE inventory ADD entry_ts TIMESTAMP;
UPDATE inventory SET entry_ts = CAST(entry_date AS TIMESTAMP);
ALTER TABLE inventory DROP COLUMN entry_date;
ALTER TABLE inventory RENAME COLUMN entry_ts TO entry_date;