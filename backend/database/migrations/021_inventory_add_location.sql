-- Migration 021: Add location column to inventory
-- Values: M-Gram, Print, Film, Cutting, Gdwn A, Gdwn B, Gdwn C, Gdwn D
-- Default: M-Gram

ALTER TABLE inventory ADD (
    location VARCHAR2(20) DEFAULT 'M-Gram'
);

-- Set all existing records to default
UPDATE inventory SET location = 'M-Gram' WHERE location IS NULL;

COMMIT;
