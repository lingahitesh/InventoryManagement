-- Migration 009: Add HAS_DIMENSIONS flag to PRODUCT_MASTER
-- 1 = product type requires dimensions (films), 0 = no dimensions (inks, solvents, adhesives)

ALTER TABLE PRODUCT_MASTER ADD (HAS_DIMENSIONS NUMBER(1) DEFAULT 1 NOT NULL);

-- Set dimensionless types
UPDATE PRODUCT_MASTER SET HAS_DIMENSIONS = 0
WHERE PRODUCT_TYPE IN ('POLYGLOSS', 'EXOPP', 'SARJOPP', 'SAJOPP', 'SARJOGLOSS', 'VINTOP', 'ADHESIVE', 'SOLVENT');

COMMIT;
