-- Migration 006: Create dispatch tables
-- Run once against the database

CREATE TABLE dispatches (
    dispatch_id       NUMBER PRIMARY KEY,
    tracking_id       VARCHAR2(100) NOT NULL,
    dispatched_through VARCHAR2(200) NOT NULL,
    dispatch_doc_no   VARCHAR2(100),
    delivery_note_date DATE,
    buyer_order_no    VARCHAR2(100),
    buyer_order_date  DATE,
    other_references  VARCHAR2(500),
    payment_mode      VARCHAR2(200) NOT NULL,
    delivery_date     DATE,
    total_quantity    NUMBER(12,3),
    created_at        TIMESTAMP DEFAULT SYSTIMESTAMP
);

CREATE SEQUENCE dispatch_seq START WITH 1 INCREMENT BY 1 NOCACHE;

-- Links dispatches to orders (many-to-many, with partial qty support)
CREATE TABLE dispatch_items (
    dispatch_item_id  NUMBER PRIMARY KEY,
    dispatch_id       NUMBER NOT NULL,
    order_id          NUMBER NOT NULL,
    order_item_id     NUMBER NOT NULL,
    units_dispatched  NUMBER NOT NULL,
    CONSTRAINT fk_di_dispatch FOREIGN KEY (dispatch_id) REFERENCES dispatches(dispatch_id),
    CONSTRAINT fk_di_order    FOREIGN KEY (order_id)    REFERENCES orders(order_id),
    CONSTRAINT fk_di_item     FOREIGN KEY (order_item_id) REFERENCES order_items(item_id)
);

CREATE SEQUENCE dispatch_item_seq START WITH 1 INCREMENT BY 1 NOCACHE;
