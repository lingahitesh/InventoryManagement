-- Migration 024: Add terms_of_payment to orders table (moved from dispatch_items)
-- Stores payment terms in days (numeric, NOT NULL, default 30)

ALTER TABLE orders ADD (payment_mode NUMBER(5));

-- Migrate existing data from dispatch_items
UPDATE orders o SET payment_mode = (
    SELECT MIN(TO_NUMBER(di.payment_mode))
    FROM dispatch_items di
    WHERE di.order_id = o.order_id AND di.payment_mode IS NOT NULL
)
WHERE EXISTS (
    SELECT 1 FROM dispatch_items di
    WHERE di.order_id = o.order_id AND di.payment_mode IS NOT NULL
);

-- Default NULLs to 30
UPDATE orders SET payment_mode = 30 WHERE payment_mode IS NULL;

-- Rename to terms_of_payment
ALTER TABLE orders RENAME COLUMN payment_mode TO terms_of_payment;

-- Add NOT NULL constraint
ALTER TABLE orders MODIFY (terms_of_payment NOT NULL);

COMMIT;
