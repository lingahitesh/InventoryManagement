-- Migration 015: Multi-valued customer fields
-- Shipping addresses as separate table
-- Emails and contacts stored as comma-separated in existing columns (simple approach)

-- Shipping addresses table (multiple per customer)
CREATE TABLE customer_shipping_addresses (
    address_id    NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id   NUMBER NOT NULL,
    address       VARCHAR2(500) NOT NULL,
    pincode       NUMBER(6),
    city          VARCHAR2(200),
    state         VARCHAR2(200),
    is_default    NUMBER(1) DEFAULT 0,
    CONSTRAINT fk_csa_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE
);

-- Rename existing address/pincode/city/state in customers to billing_*
-- Actually keep them as billing address fields (they already serve that purpose)
-- The new table handles shipping addresses separately
