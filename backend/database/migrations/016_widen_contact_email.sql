-- Migration 016: Widen contact and email columns to support multiple comma-separated values

ALTER TABLE customers MODIFY (contact VARCHAR2(500));
ALTER TABLE customers MODIFY (email VARCHAR2(500));
