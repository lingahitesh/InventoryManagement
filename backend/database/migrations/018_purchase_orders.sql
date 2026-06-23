-- Migration 018: Purchase Orders (inbound stock orders from suppliers)
-- A purchase order records items ordered from a supplier/vendor.
-- When items "arrive" they get added to inventory.

CREATE TABLE purchase_orders (
    po_id          NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    supplier_name  VARCHAR2(200) NOT NULL,
    supplier_contact VARCHAR2(500),
    supplier_gst   VARCHAR2(20),
    supplier_email VARCHAR2(500),
    billing_address VARCHAR2(500),
    shipping_address VARCHAR2(500),
    tracking_id    VARCHAR2(100),
    order_date     TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    status         VARCHAR2(20) DEFAULT 'pending',  -- pending, partial, completed
    notes          VARCHAR2(500)
);

CREATE TABLE purchase_order_items (
    poi_id         NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    po_id          NUMBER NOT NULL,
    sku_type       VARCHAR2(50) NOT NULL,
    sku_subtype    VARCHAR2(500),
    sku_dim        VARCHAR2(50),
    sku_quantity   NUMBER(12,3) NOT NULL,  -- kg per unit
    sku_units      NUMBER DEFAULT 1 NOT NULL,
    sku_cost_price NUMBER(9,2),
    sku_desc       VARCHAR2(100),
    arrived        NUMBER(1) DEFAULT 0,   -- 0=pending, 1=arrived
    inventory_sku_id NUMBER,              -- set when added to inventory
    CONSTRAINT fk_poi_po FOREIGN KEY (po_id) REFERENCES purchase_orders(po_id) ON DELETE CASCADE
);

-- Saved billing addresses for purchase orders
CREATE TABLE po_billing_addresses (
    addr_id   NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    address   VARCHAR2(500) NOT NULL
);

-- Pre-populate company shipping addresses
INSERT INTO po_billing_addresses (address) VALUES ('3/B, PORTUGUESE CHURCH STREET 2ND FLOOR, KOLKATA 700001');
COMMIT;
