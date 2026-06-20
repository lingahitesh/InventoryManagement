-- 000_tester_INVENTORY.sql
-- Sample inventory data for testing.
-- sku_subtype stores raw PRODUCT_SUBTYPE value (from PRODUCT_MASTER.PRODUCT_SUBTYPE column).
-- UI shows "CODE - SUBTYPE" but DB stores just the subtype.

-- ═══════════════════════════════════════════════════════════════
-- PET Films
-- ═══════════════════════════════════════════════════════════════
INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'PET', 'PET 12 MIC UNTREATED', '305', 200.500, 145.00, 'Clear 12mic untreated roll', 5, 'TRK-PET-001', TIMESTAMP '2026-06-01 09:30:00');

INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'PET', 'PET 12 MIC UNTREATED', '305', 180.000, 142.00, 'Clear 12mic untreated roll B', 3, 'TRK-PET-002', TIMESTAMP '2026-06-03 11:00:00');

INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'PET', 'PET 12 MIC CHEMICAL COATED', '254', 150.750, 165.00, 'Chem coated 12mic', 4, 'TRK-PET-003', TIMESTAMP '2026-06-05 14:15:00');

INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'PET', 'PET 08 MIC CORONA TREATED', '210', 120.000, 155.00, '8mic corona treated', 6, 'TRK-PET-004', TIMESTAMP '2026-06-07 08:45:00');

INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'PET', 'PET TWIST GRADE CLEAR 19 MIC UNTREATED', '305', 300.000, 180.00, 'Twist grade 19mic clear', 2, 'TRK-PET-005', TIMESTAMP '2026-06-10 10:20:00');

-- ═══════════════════════════════════════════════════════════════
-- MET PET Films
-- ═══════════════════════════════════════════════════════════════
INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'MET PET', 'MET PET CORONA TREATED 12 MIC', '305', 210.000, 175.00, 'Metallized PET 12mic', 4, 'TRK-MPET-001', TIMESTAMP '2026-06-02 13:30:00');

INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'MET PET', 'MET PET TWIST CORONA TREATED 19 MIC', '254', 250.500, 195.00, 'Met PET twist 19mic', 3, 'TRK-MPET-002', TIMESTAMP '2026-06-08 16:00:00');

-- ═══════════════════════════════════════════════════════════════
-- BOPP Films  (raw PRODUCT_SUBTYPE, no code)
-- ═══════════════════════════════════════════════════════════════
INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'BOPP', 'Transparent One Side Treated (Non Heat Sealable) - 12 MIC', '305', 190.000, 130.00, 'BOPP 12mic transparent', 5, 'TRK-BOPP-001', TIMESTAMP '2026-06-01 10:00:00');

INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'BOPP', 'Transparent Heat Sealable - 18-20 MIC', '250', 175.250, 140.00, 'BOPP HS 18-20mic', 4, 'TRK-BOPP-002', TIMESTAMP '2026-06-04 09:15:00');

INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'BOPP', 'White Opaque - 18-30 MIC', '210', 160.000, 150.00, 'BOPP white opaque', 3, 'TRK-BOPP-003', TIMESTAMP '2026-06-06 12:45:00');

INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'BOPP', 'Metallized Heat Sealable - 18-20 MIC', '305', 220.000, 170.00, 'BOPP met HS 18-20mic', 6, 'TRK-BOPP-004', TIMESTAMP '2026-06-09 15:30:00');

INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'BOPP', 'Tape/Textile Grade - 25-30 MIC', '100', 280.000, 125.00, 'BOPP tape grade', 8, 'TRK-BOPP-005', TIMESTAMP '2026-06-11 07:00:00');

-- ═══════════════════════════════════════════════════════════════
-- CPP Films
-- ═══════════════════════════════════════════════════════════════
INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'CPP', 'NATURAL CPP 20 MIC', '305', 170.000, 135.00, 'Natural CPP 20mic', 5, 'TRK-CPP-001', TIMESTAMP '2026-06-03 10:30:00');

INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'CPP', 'MET CPP 20 MIC', '254', 145.500, 160.00, 'Metallized CPP 20mic', 3, 'TRK-CPP-002', TIMESTAMP '2026-06-06 14:00:00');

-- ═══════════════════════════════════════════════════════════════
-- LD Films
-- ═══════════════════════════════════════════════════════════════
INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'LD', 'NATURAL LD 100 GAUGE', '300', 200.000, 110.00, 'Natural LD 100 gauge', 7, 'TRK-LD-001', TIMESTAMP '2026-06-02 08:00:00');

INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'LD', 'NATURAL LD 150 GAUGE', '250', 180.000, 115.00, 'Natural LD 150 gauge', 5, 'TRK-LD-002', TIMESTAMP '2026-06-05 11:30:00');

INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'LD', 'MILKY LD 120 GAUGE', '210', 160.000, 120.00, 'Milky LD 120 gauge', 4, 'TRK-LD-003', TIMESTAMP '2026-06-08 09:45:00');

INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'LD', 'COLORED LS150 GAUGE', '305', 190.000, 130.00, 'Colored LD 150 gauge', 3, 'TRK-LD-004', TIMESTAMP '2026-06-12 13:00:00');

-- ═══════════════════════════════════════════════════════════════
-- INKS (dimensionless — sku_dim = '-')
-- ═══════════════════════════════════════════════════════════════
INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'POLYGLOSS', 'POLYGLOSS ARSR BLACK', '-', 25.000, 420.00, 'Black ink 25kg drum', 2, 'TRK-INK-001', TIMESTAMP '2026-06-01 08:00:00');

INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'POLYGLOSS', 'POLYGLOSS WHITE', '-', 50.000, 380.00, 'White ink 50kg drum', 1, 'TRK-INK-002', TIMESTAMP '2026-06-04 10:30:00');

INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'EXOPP', 'EXOPP ARSR BLUE', '-', 20.000, 450.00, 'Blue ink 20kg drum', 3, 'TRK-INK-003', TIMESTAMP '2026-06-06 09:00:00');

INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'VINTOP', 'VINTOP ARSR YELLOW', '-', 15.000, 460.00, 'Yellow ink 15kg can', 4, 'TRK-INK-004', TIMESTAMP '2026-06-09 11:15:00');

INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'SARJOPP', 'SARJOPP ARSR GREEN', '-', 20.000, 440.00, 'Green ink 20kg drum', 2, 'TRK-INK-005', TIMESTAMP '2026-06-11 14:00:00');

-- ═══════════════════════════════════════════════════════════════
-- SOLVENTS (dimensionless — sku_dim = '-')
-- ═══════════════════════════════════════════════════════════════
INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'SOLVENT', 'ETHYL ACETATE', '-', 200.000, 85.00, 'EA 200kg barrel', 1, 'TRK-SOL-001', TIMESTAMP '2026-06-02 07:30:00');

INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'SOLVENT', 'TOLUENE', '-', 180.000, 78.00, 'Toluene 180kg barrel', 2, 'TRK-SOL-002', TIMESTAMP '2026-06-05 08:00:00');

INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'SOLVENT', 'IPA', '-', 50.000, 95.00, 'IPA 50kg can', 3, 'TRK-SOL-003', TIMESTAMP '2026-06-08 12:30:00');

-- ═══════════════════════════════════════════════════════════════
-- ADHESIVES (dimensionless — sku_dim = '-')
-- ═══════════════════════════════════════════════════════════════
INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'ADHESIVE', 'HEXABOND GL-585', '-', 30.000, 320.00, 'GL-585 adhesive 30kg pail', 2, 'TRK-ADH-001', TIMESTAMP '2026-06-03 09:00:00');

INSERT INTO inventory (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_cost_price, sku_desc, sku_units, tracking_id, entry_date)
VALUES (inventory_seq.NEXTVAL, 'ADHESIVE', 'HEXABOND GL-75HL', '-', 25.000, 350.00, 'GL-75HL adhesive 25kg pail', 1, 'TRK-ADH-002', TIMESTAMP '2026-06-07 15:45:00');

COMMIT;
